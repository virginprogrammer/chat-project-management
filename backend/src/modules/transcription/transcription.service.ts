import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../common/storage/storage.service';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

interface TranscriptionResult {
  text: string;
  speakers?: Array<{
    name: string;
    segments: Array<{
      start: number;
      end: number;
      text: string;
    }>;
  }>;
  language: string;
  confidence: number;
}

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name);
  private speechConfig: sdk.SpeechConfig;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private storageService: StorageService,
    @InjectQueue('transcription') private transcriptionQueue: Queue,
  ) {
    // Initialize Azure Speech Config
    const subscriptionKey = this.configService.get('AZURE_SPEECH_KEY');
    const region = this.configService.get('AZURE_SPEECH_REGION');

    if (subscriptionKey && region) {
      this.speechConfig = sdk.SpeechConfig.fromSubscription(subscriptionKey, region);
      this.speechConfig.speechRecognitionLanguage = 'en-US';
      this.speechConfig.requestWordLevelTimestamps();
      this.logger.log('Azure Speech Services initialized');
    } else {
      this.logger.warn('Azure Speech Services not configured');
    }
  }

  /**
   * Create audio recording entry
   */
  async createRecording(
    source: string,
    sourceId: string,
    meetingTitle: string,
    fileUrl: string,
    durationSeconds?: number,
  ) {
    return this.prisma.audioRecording.create({
      data: {
        source,
        sourceId,
        meetingTitle,
        fileUrl,
        durationSeconds,
        transcriptionStatus: 'pending',
        timestamp: new Date(),
      },
    });
  }

  /**
   * Upload and process audio recording
   */
  async uploadAndProcessRecording(
    source: string,
    sourceId: string,
    meetingTitle: string,
    audioBuffer: Buffer,
    contentType: string,
  ) {
    try {
      // Generate storage key
      const extension = this.storageService.getExtensionFromMimeType(contentType);
      const storageKey = this.storageService.generateRecordingKey(source, sourceId, extension);

      // Upload to S3
      const fileUrl = await this.storageService.uploadFile(storageKey, audioBuffer, contentType);

      // Create recording entry
      const recording = await this.createRecording(source, sourceId, meetingTitle, fileUrl);

      // Queue transcription job
      await this.queueTranscription(recording.id);

      return recording;
    } catch (error) {
      this.logger.error('Failed to upload and process recording', error);
      throw error;
    }
  }

  /**
   * Queue transcription job
   */
  async queueTranscription(recordingId: string) {
    try {
      // Update status to pending
      await this.prisma.audioRecording.update({
        where: { id: recordingId },
        data: { transcriptionStatus: 'pending' },
      });

      // Add to queue
      await this.transcriptionQueue.add(
        'transcribe',
        { recordingId },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: false,
          removeOnFail: false,
        },
      );

      this.logger.log(`Transcription job queued for recording: ${recordingId}`);
    } catch (error) {
      this.logger.error(`Failed to queue transcription: ${recordingId}`, error);
      throw error;
    }
  }

  /**
   * Process transcription (called by queue processor)
   */
  async processTranscription(recordingId: string): Promise<void> {
    this.logger.log(`Processing transcription for recording: ${recordingId}`);

    try {
      // Update status to processing
      await this.prisma.audioRecording.update({
        where: { id: recordingId },
        data: { transcriptionStatus: 'processing' },
      });

      // Get recording details
      const recording = await this.prisma.audioRecording.findUnique({
        where: { id: recordingId },
      });

      if (!recording) {
        throw new Error(`Recording not found: ${recordingId}`);
      }

      // Download audio file
      const storageKey = this.extractStorageKey(recording.storagePath || recording.fileUrl);
      const audioBuffer = await this.storageService.downloadFile(storageKey);

      // Transcribe audio
      const result = await this.transcribeAudio(audioBuffer);

      // Store transcription
      await this.prisma.transcription.create({
        data: {
          audioRecordingId: recordingId,
          content: result.text,
          speakers: result.speakers ? JSON.parse(JSON.stringify(result.speakers)) : null,
          language: result.language,
          confidenceScore: result.confidence,
        },
      });

      // Update recording status
      await this.prisma.audioRecording.update({
        where: { id: recordingId },
        data: { transcriptionStatus: 'completed' },
      });

      this.logger.log(`Transcription completed for recording: ${recordingId}`);
    } catch (error) {
      this.logger.error(`Transcription failed for recording: ${recordingId}`, error);

      // Update status to failed
      await this.prisma.audioRecording.update({
        where: { id: recordingId },
        data: { transcriptionStatus: 'failed' },
      });

      throw error;
    }
  }

  /**
   * Transcribe audio using Azure Speech Services
   */
  private async transcribeAudio(audioBuffer: Buffer): Promise<TranscriptionResult> {
    return new Promise((resolve, reject) => {
      try {
        if (!this.speechConfig) {
          reject(new Error('Azure Speech Services not configured'));
          return;
        }

        // Create push stream from buffer
        const pushStream = sdk.AudioInputStream.createPushStream();
        pushStream.write(audioBuffer);
        pushStream.close();

        const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
        const recognizer = new sdk.SpeechRecognizer(this.speechConfig, audioConfig);

        let fullText = '';
        let totalConfidence = 0;
        let recognitionCount = 0;

        recognizer.recognized = (s, e) => {
          if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
            fullText += e.result.text + ' ';

            // Calculate confidence (if available)
            if (e.result.properties) {
              const confidence = parseFloat(
                e.result.properties.getProperty(
                  sdk.PropertyId.SpeechServiceResponse_JsonResult,
                  '{"NBest":[{"Confidence":0.5}]}',
                ),
              );
              totalConfidence += confidence || 0.5;
              recognitionCount++;
            }
          }
        };

        recognizer.canceled = (s, e) => {
          this.logger.error(`Recognition canceled: ${e.errorDetails}`);
          recognizer.stopContinuousRecognitionAsync();
          reject(new Error(`Recognition canceled: ${e.errorDetails}`));
        };

        recognizer.sessionStopped = (s, e) => {
          recognizer.stopContinuousRecognitionAsync();

          const avgConfidence = recognitionCount > 0 ? totalConfidence / recognitionCount : 0.5;

          resolve({
            text: fullText.trim(),
            language: 'en-US',
            confidence: avgConfidence,
          });
        };

        // Start continuous recognition
        recognizer.startContinuousRecognitionAsync(
          () => {
            this.logger.log('Recognition started');
          },
          (error) => {
            this.logger.error('Failed to start recognition', error);
            reject(error);
          },
        );
      } catch (error) {
        this.logger.error('Transcription error', error);
        reject(error);
      }
    });
  }

  /**
   * Extract storage key from URL or path
   */
  private extractStorageKey(urlOrPath: string): string {
    // If it's a full S3 URL, extract the key
    if (urlOrPath.includes('amazonaws.com')) {
      const url = new URL(urlOrPath);
      return url.pathname.substring(1); // Remove leading slash
    }
    return urlOrPath;
  }

  /**
   * Get transcription by recording ID
   */
  async getTranscription(recordingId: string) {
    return this.prisma.transcription.findFirst({
      where: { audioRecordingId: recordingId },
      include: {
        audioRecording: true,
      },
    });
  }

  /**
   * Get all recordings with transcription status
   */
  async getAllRecordings(status?: string) {
    return this.prisma.audioRecording.findMany({
      where: status ? { transcriptionStatus: status } : undefined,
      include: {
        transcriptions: true,
      },
      orderBy: { timestamp: 'desc' },
    });
  }

  /**
   * Retry failed transcription
   */
  async retryTranscription(recordingId: string) {
    const recording = await this.prisma.audioRecording.findUnique({
      where: { id: recordingId },
    });

    if (!recording) {
      throw new Error(`Recording not found: ${recordingId}`);
    }

    if (recording.transcriptionStatus !== 'failed') {
      throw new Error(`Recording is not in failed state: ${recording.transcriptionStatus}`);
    }

    await this.queueTranscription(recordingId);
  }

  /**
   * Get transcription job status
   */
  async getJobStatus(recordingId: string) {
    const recording = await this.prisma.audioRecording.findUnique({
      where: { id: recordingId },
    });

    if (!recording) {
      throw new Error(`Recording not found: ${recordingId}`);
    }

    // Get job from queue
    const jobs = await this.transcriptionQueue.getJobs(['waiting', 'active', 'completed', 'failed']);
    const job = jobs.find((j) => j.data.recordingId === recordingId);

    return {
      recordingId,
      status: recording.transcriptionStatus,
      jobState: job?.getState(),
      progress: job ? await job.progress() : 0,
      attempts: job?.attemptsMade || 0,
    };
  }
}
