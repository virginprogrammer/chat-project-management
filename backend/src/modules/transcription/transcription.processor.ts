import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { TranscriptionService } from './transcription.service';

@Processor('transcription')
export class TranscriptionProcessor {
  private readonly logger = new Logger(TranscriptionProcessor.name);

  constructor(private transcriptionService: TranscriptionService) {}

  @Process('transcribe')
  async handleTranscription(job: Job) {
    const { recordingId } = job.data;

    this.logger.log(`Starting transcription job for recording: ${recordingId}`);

    try {
      // Update progress
      await job.progress(10);

      // Process transcription
      await this.transcriptionService.processTranscription(recordingId);

      // Update progress to 100%
      await job.progress(100);

      this.logger.log(`Transcription job completed for recording: ${recordingId}`);
      return { success: true, recordingId };
    } catch (error) {
      this.logger.error(`Transcription job failed for recording: ${recordingId}`, error);
      throw error;
    }
  }
}
