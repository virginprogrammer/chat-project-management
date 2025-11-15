import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import {
  setupTestDatabase,
  teardownTestDatabase,
  createTestUser,
  createSlackIntegration,
  getPrismaClient,
} from './helpers/database.helper';
import { generateTestToken } from './helpers/auth.helper';
import { MockSlackAPI } from './helpers/mock-services.helper';
import {
  mockSlackAudioFiles,
  mockSlackRecording001Transcription,
  mockSlackRecording002Transcription,
  getMockMP3Buffer,
} from './fixtures/slack-recordings.fixture';

describe('Slack Voice/Recordings E2E', () => {
  let app: INestApplication;
  let userId: string;
  let authToken: string;
  let mockSlackApi: MockSlackAPI;
  let transcriptionService: any;

  beforeAll(async () => {
    // Setup test database
    await setupTestDatabase();

    // Create test module
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    // Get transcription service for manual processing
    transcriptionService = moduleFixture.get('TranscriptionService');

    // Create test user and integration
    const user = await createTestUser({
      email: 'slack-voice-test@example.com',
      name: 'Slack Voice Test User',
    });
    userId = user.id;
    authToken = generateTestToken(userId, user.email);

    // Create Slack integration
    await createSlackIntegration(userId);

    // Initialize mock API
    mockSlackApi = new MockSlackAPI();
  });

  afterAll(async () => {
    await teardownTestDatabase();
    await app.close();
  });

  beforeEach(() => {
    // Reset mocks before each test
    mockSlackApi.cleanup();
    mockSlackApi = new MockSlackAPI();
  });

  describe('POST /transcription/upload', () => {
    it('should upload Slack audio file and create database entry', async () => {
      const audioBuffer = getMockMP3Buffer();

      const response = await request(app.getHttpServer())
        .post('/transcription/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('source', 'slack')
        .field('sourceId', mockSlackAudioFiles[0].id)
        .field('meetingTitle', mockSlackAudioFiles[0].title)
        .attach('file', audioBuffer, 'recording.mp3')
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.recording).toBeDefined();
      expect(response.body.recording.source).toBe('slack');
      expect(response.body.recording.sourceId).toBe(mockSlackAudioFiles[0].id);

      // Verify recording was stored in database
      const prisma = getPrismaClient();
      const recordingInDb = await prisma.audioRecording.findFirst({
        where: {
          source: 'slack',
          sourceId: mockSlackAudioFiles[0].id,
        },
      });

      expect(recordingInDb).toBeDefined();
      expect(recordingInDb?.meetingTitle).toBe(mockSlackAudioFiles[0].title);
      expect(recordingInDb?.transcriptionStatus).toBe('pending');
    });

    it('should handle multiple Slack audio files', async () => {
      const audioBuffer = getMockMP3Buffer();

      // Upload first file
      await request(app.getHttpServer())
        .post('/transcription/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('source', 'slack')
        .field('sourceId', mockSlackAudioFiles[0].id)
        .field('meetingTitle', mockSlackAudioFiles[0].title)
        .attach('file', audioBuffer, 'recording1.mp3')
        .expect(201);

      // Upload second file
      await request(app.getHttpServer())
        .post('/transcription/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('source', 'slack')
        .field('sourceId', mockSlackAudioFiles[1].id)
        .field('meetingTitle', mockSlackAudioFiles[1].title)
        .attach('file', audioBuffer, 'recording2.mp3')
        .expect(201);

      // Verify both recordings are in database
      const prisma = getPrismaClient();
      const recordings = await prisma.audioRecording.findMany({
        where: { source: 'slack' },
      });

      expect(recordings.length).toBe(2);
    });

    it('should accept MP3 format files from Slack', async () => {
      const mp3Buffer = getMockMP3Buffer();

      const response = await request(app.getHttpServer())
        .post('/transcription/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('source', 'slack')
        .field('sourceId', mockSlackAudioFiles[0].id)
        .field('meetingTitle', mockSlackAudioFiles[0].title)
        .attach('file', mp3Buffer, {
          filename: 'recording.mp3',
          contentType: 'audio/mpeg',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Transcription Processing', () => {
    let recordingId: string;

    beforeEach(async () => {
      // Upload an audio file first
      const audioBuffer = getMockMP3Buffer();

      const response = await request(app.getHttpServer())
        .post('/transcription/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('source', 'slack')
        .field('sourceId', mockSlackAudioFiles[0].id)
        .field('meetingTitle', mockSlackAudioFiles[0].title)
        .attach('file', audioBuffer, 'recording.mp3');

      recordingId = response.body.recording.id;
    });

    it('should process Slack audio transcription and store result', async () => {
      // Mock the transcribeAudio method
      jest.spyOn(transcriptionService as any, 'transcribeAudio').mockResolvedValue({
        text: mockSlackRecording001Transcription,
        language: 'en-US',
        confidence: 0.92,
      });

      // Manually trigger transcription processing
      await transcriptionService.processTranscription(recordingId);

      // Verify transcription was created
      const prisma = getPrismaClient();
      const transcription = await prisma.transcription.findFirst({
        where: { audioRecordingId: recordingId },
      });

      expect(transcription).toBeDefined();
      expect(transcription?.content).toContain('daily standup');
      expect(transcription?.language).toBe('en-US');
      expect(transcription?.confidenceScore).toBe(0.92);

      // Verify recording status updated
      const recording = await prisma.audioRecording.findUnique({
        where: { id: recordingId },
      });

      expect(recording?.transcriptionStatus).toBe('completed');
    });

    it('should handle transcription failures correctly', async () => {
      // Mock transcription to fail
      jest
        .spyOn(transcriptionService as any, 'transcribeAudio')
        .mockRejectedValue(new Error('Transcription service unavailable'));

      // Attempt transcription
      await expect(transcriptionService.processTranscription(recordingId)).rejects.toThrow();

      // Verify recording status is failed
      const prisma = getPrismaClient();
      const recording = await prisma.audioRecording.findUnique({
        where: { id: recordingId },
      });

      expect(recording?.transcriptionStatus).toBe('failed');
    });
  });

  describe('GET /transcription/recordings', () => {
    beforeEach(async () => {
      // Upload audio files
      const audioBuffer = getMockMP3Buffer();

      for (const audioFile of mockSlackAudioFiles) {
        await request(app.getHttpServer())
          .post('/transcription/upload')
          .set('Authorization', `Bearer ${authToken}`)
          .field('source', 'slack')
          .field('sourceId', audioFile.id)
          .field('meetingTitle', audioFile.title)
          .attach('file', audioBuffer, `${audioFile.name}`);
      }
    });

    it('should retrieve all Slack audio recordings', async () => {
      const response = await request(app.getHttpServer())
        .get('/transcription/recordings')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.recordings).toBeDefined();
      expect(Array.isArray(response.body.recordings)).toBe(true);

      const slackRecordings = response.body.recordings.filter((rec: any) => rec.source === 'slack');

      expect(slackRecordings.length).toBe(mockSlackAudioFiles.length);
    });

    it('should filter Slack recordings by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/transcription/recordings?status=pending')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.recordings).toBeDefined();

      // All returned recordings should have status 'pending'
      response.body.recordings.forEach((rec: any) => {
        expect(rec.transcriptionStatus).toBe('pending');
      });
    });
  });

  describe('GET /transcription/recordings/:id', () => {
    let recordingId: string;

    beforeEach(async () => {
      const audioBuffer = getMockMP3Buffer();

      const response = await request(app.getHttpServer())
        .post('/transcription/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('source', 'slack')
        .field('sourceId', mockSlackAudioFiles[0].id)
        .field('meetingTitle', mockSlackAudioFiles[0].title)
        .attach('file', audioBuffer, 'recording.mp3');

      recordingId = response.body.recording.id;
    });

    it('should retrieve specific Slack recording with transcription', async () => {
      // Mock and process transcription
      jest.spyOn(transcriptionService as any, 'transcribeAudio').mockResolvedValue({
        text: mockSlackRecording001Transcription,
        language: 'en-US',
        confidence: 0.93,
      });

      await transcriptionService.processTranscription(recordingId);

      // Get recording
      const response = await request(app.getHttpServer())
        .get(`/transcription/recordings/${recordingId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.recording).toBeDefined();
      expect(response.body.recording.audioRecording).toBeDefined();
      expect(response.body.recording.content).toContain('daily standup');
    });
  });

  describe('Dashboard Verification', () => {
    beforeEach(async () => {
      // Upload and process recordings
      const audioBuffer = getMockMP3Buffer();

      for (const [index, audioFile] of mockSlackAudioFiles.entries()) {
        const uploadResponse = await request(app.getHttpServer())
          .post('/transcription/upload')
          .set('Authorization', `Bearer ${authToken}`)
          .field('source', 'slack')
          .field('sourceId', audioFile.id)
          .field('meetingTitle', audioFile.title)
          .attach('file', audioBuffer, audioFile.name);

        const recId = uploadResponse.body.recording.id;

        // Mock and process transcription
        const transcriptionText =
          index === 0 ? mockSlackRecording001Transcription : mockSlackRecording002Transcription;

        jest.spyOn(transcriptionService as any, 'transcribeAudio').mockResolvedValue({
          text: transcriptionText,
          language: 'en-US',
          confidence: 0.88,
        });

        await transcriptionService.processTranscription(recId);
      }
    });

    it('should verify Slack recordings appear in dashboard (unprocessed)', async () => {
      const response = await request(app.getHttpServer())
        .get('/transcription/recordings')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const slackRecordings = response.body.recordings.filter((rec: any) => rec.source === 'slack');

      expect(slackRecordings.length).toBeGreaterThan(0);

      // Verify recording data is visible
      slackRecordings.forEach((rec: any) => {
        expect(rec.id).toBeDefined();
        expect(rec.meetingTitle).toBeDefined();
        expect(rec.transcriptionStatus).toBe('completed');
        expect(rec.source).toBe('slack');
      });
    });

    it('should verify Slack transcriptions are searchable', async () => {
      const prisma = getPrismaClient();

      // Get all transcriptions
      const transcriptions = await prisma.transcription.findMany({
        include: {
          audioRecording: true,
        },
      });

      const slackTranscriptions = transcriptions.filter((t) => t.audioRecording.source === 'slack');

      expect(slackTranscriptions.length).toBeGreaterThan(0);

      // Verify content is searchable
      const withStandup = slackTranscriptions.find((t) => t.content.includes('standup'));

      expect(withStandup).toBeDefined();
      expect(withStandup?.audioRecording.meetingTitle).toBe(mockSlackAudioFiles[0].title);
    });

    it('should verify system stats include Slack recordings', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.recordings).toBeGreaterThanOrEqual(mockSlackAudioFiles.length);
      expect(response.body.transcriptions).toBeGreaterThanOrEqual(mockSlackAudioFiles.length);
    });

    it('should differentiate between Teams and Slack recordings', async () => {
      const response = await request(app.getHttpServer())
        .get('/transcription/recordings')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const slackRecordings = response.body.recordings.filter((rec: any) => rec.source === 'slack');

      const teamsRecordings = response.body.recordings.filter((rec: any) => rec.source === 'teams');

      // Should have Slack recordings
      expect(slackRecordings.length).toBeGreaterThan(0);

      // Each recording should have correct source
      slackRecordings.forEach((rec: any) => {
        expect(rec.source).toBe('slack');
      });

      teamsRecordings.forEach((rec: any) => {
        expect(rec.source).toBe('teams');
      });
    });

    it('should verify transcriptions contain meeting context', async () => {
      const prisma = getPrismaClient();

      const transcriptions = await prisma.transcription.findMany({
        include: {
          audioRecording: true,
        },
        where: {
          audioRecording: {
            source: 'slack',
          },
        },
      });

      expect(transcriptions.length).toBeGreaterThan(0);

      // Check first transcription has standup content
      const standupTranscription = transcriptions.find((t) => t.content.includes('standup'));
      expect(standupTranscription).toBeDefined();

      // Check second transcription has client meeting content
      const clientMeetingTranscription = transcriptions.find((t) => t.content.includes('client'));
      expect(clientMeetingTranscription).toBeDefined();
    });
  });

  describe('POST /transcription/recordings/:id/retry', () => {
    it('should allow retry of failed Slack transcriptions', async () => {
      const audioBuffer = getMockMP3Buffer();

      const uploadResponse = await request(app.getHttpServer())
        .post('/transcription/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('source', 'slack')
        .field('sourceId', 'slack-failed-001')
        .field('meetingTitle', 'Failed Slack Recording')
        .attach('file', audioBuffer, 'failed.mp3');

      const recordingId = uploadResponse.body.recording.id;

      // Mock transcription to fail
      jest
        .spyOn(transcriptionService as any, 'transcribeAudio')
        .mockRejectedValueOnce(new Error('Network timeout'));

      // Process transcription (will fail)
      await expect(transcriptionService.processTranscription(recordingId)).rejects.toThrow();

      // Verify status is failed
      const prisma = getPrismaClient();
      let recording = await prisma.audioRecording.findUnique({
        where: { id: recordingId },
      });
      expect(recording?.transcriptionStatus).toBe('failed');

      // Retry transcription (mock success)
      jest.spyOn(transcriptionService as any, 'transcribeAudio').mockResolvedValueOnce({
        text: 'Retried Slack transcription text',
        language: 'en-US',
        confidence: 0.87,
      });

      const retryResponse = await request(app.getHttpServer())
        .post(`/transcription/recordings/${recordingId}/retry`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(retryResponse.body.success).toBe(true);

      // Manually process the retry
      await transcriptionService.processTranscription(recordingId);

      // Verify status is now completed
      recording = await prisma.audioRecording.findUnique({
        where: { id: recordingId },
      });
      expect(recording?.transcriptionStatus).toBe('completed');
    });
  });
});
