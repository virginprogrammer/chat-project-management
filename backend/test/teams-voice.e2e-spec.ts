import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import {
  setupTestDatabase,
  teardownTestDatabase,
  createTestUser,
  createTeamsIntegration,
  getPrismaClient,
} from './helpers/database.helper';
import { generateTestToken } from './helpers/auth.helper';
import { MockTeamsAPI } from './helpers/mock-services.helper';
import {
  mockTeamsMeetings,
  mockTeamsRecordings,
  mockRecording001Transcription,
  getMockAudioBuffer,
} from './fixtures/teams-recordings.fixture';

describe('Teams Voice/Recordings E2E', () => {
  let app: INestApplication;
  let userId: string;
  let authToken: string;
  let mockTeamsApi: MockTeamsAPI;
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
      email: 'teams-voice-test@example.com',
      name: 'Teams Voice Test User',
    });
    userId = user.id;
    authToken = generateTestToken(userId, user.email);

    // Create Teams integration
    await createTeamsIntegration(userId);

    // Initialize mock API
    mockTeamsApi = new MockTeamsAPI();
  });

  afterAll(async () => {
    await teardownTestDatabase();
    await app.close();
  });

  beforeEach(() => {
    // Reset mocks before each test
    mockTeamsApi.cleanup();
    mockTeamsApi = new MockTeamsAPI();
  });

  describe('POST /transcription/upload', () => {
    it('should upload Teams recording and create database entry', async () => {
      const audioBuffer = getMockAudioBuffer();

      const response = await request(app.getHttpServer())
        .post('/transcription/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('source', 'teams')
        .field('sourceId', mockTeamsRecordings[0].id)
        .field('meetingTitle', mockTeamsMeetings[0].subject)
        .attach('file', audioBuffer, 'recording.wav')
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.recording).toBeDefined();
      expect(response.body.recording.source).toBe('teams');
      expect(response.body.recording.sourceId).toBe(mockTeamsRecordings[0].id);

      // Verify recording was stored in database
      const prisma = getPrismaClient();
      const recordingInDb = await prisma.audioRecording.findFirst({
        where: {
          source: 'teams',
          sourceId: mockTeamsRecordings[0].id,
        },
      });

      expect(recordingInDb).toBeDefined();
      expect(recordingInDb?.meetingTitle).toBe(mockTeamsMeetings[0].subject);
      expect(recordingInDb?.transcriptionStatus).toBe('pending');
    });

    it('should handle multiple Teams recordings', async () => {
      const audioBuffer = getMockAudioBuffer();

      // Upload first recording
      await request(app.getHttpServer())
        .post('/transcription/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('source', 'teams')
        .field('sourceId', mockTeamsRecordings[0].id)
        .field('meetingTitle', mockTeamsMeetings[0].subject)
        .attach('file', audioBuffer, 'recording1.wav')
        .expect(201);

      // Upload second recording
      await request(app.getHttpServer())
        .post('/transcription/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('source', 'teams')
        .field('sourceId', mockTeamsRecordings[1].id)
        .field('meetingTitle', mockTeamsMeetings[1].subject)
        .attach('file', audioBuffer, 'recording2.wav')
        .expect(201);

      // Verify both recordings are in database
      const prisma = getPrismaClient();
      const recordings = await prisma.audioRecording.findMany({
        where: { source: 'teams' },
      });

      expect(recordings.length).toBe(2);
    });
  });

  describe('Transcription Processing', () => {
    let recordingId: string;

    beforeEach(async () => {
      // Upload a recording first
      const audioBuffer = getMockAudioBuffer();

      const response = await request(app.getHttpServer())
        .post('/transcription/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('source', 'teams')
        .field('sourceId', mockTeamsRecordings[0].id)
        .field('meetingTitle', mockTeamsMeetings[0].subject)
        .attach('file', audioBuffer, 'recording.wav');

      recordingId = response.body.recording.id;
    });

    it('should process transcription and store result', async () => {
      // Mock the transcribeAudio method to avoid calling Azure Speech
      jest
        .spyOn(transcriptionService as any, 'transcribeAudio')
        .mockResolvedValue({
          text: mockRecording001Transcription,
          language: 'en-US',
          confidence: 0.95,
        });

      // Manually trigger transcription processing
      await transcriptionService.processTranscription(recordingId);

      // Verify transcription was created
      const prisma = getPrismaClient();
      const transcription = await prisma.transcription.findFirst({
        where: { audioRecordingId: recordingId },
      });

      expect(transcription).toBeDefined();
      expect(transcription?.content).toContain('Project Alpha');
      expect(transcription?.language).toBe('en-US');
      expect(transcription?.confidenceScore).toBe(0.95);

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
        .mockRejectedValue(new Error('Azure Speech API error'));

      // Attempt transcription
      await expect(
        transcriptionService.processTranscription(recordingId),
      ).rejects.toThrow();

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
      // Upload some recordings
      const audioBuffer = getMockAudioBuffer();

      for (const [index, recording] of mockTeamsRecordings.entries()) {
        await request(app.getHttpServer())
          .post('/transcription/upload')
          .set('Authorization', `Bearer ${authToken}`)
          .field('source', 'teams')
          .field('sourceId', recording.id)
          .field('meetingTitle', mockTeamsMeetings[index].subject)
          .attach('file', audioBuffer, `recording${index}.wav`);
      }
    });

    it('should retrieve all Teams recordings', async () => {
      const response = await request(app.getHttpServer())
        .get('/transcription/recordings')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.recordings).toBeDefined();
      expect(Array.isArray(response.body.recordings)).toBe(true);

      const teamsRecordings = response.body.recordings.filter(
        (rec: any) => rec.source === 'teams',
      );

      expect(teamsRecordings.length).toBe(mockTeamsRecordings.length);
    });

    it('should filter recordings by status', async () => {
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
      const audioBuffer = getMockAudioBuffer();

      const response = await request(app.getHttpServer())
        .post('/transcription/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('source', 'teams')
        .field('sourceId', mockTeamsRecordings[0].id)
        .field('meetingTitle', mockTeamsMeetings[0].subject)
        .attach('file', audioBuffer, 'recording.wav');

      recordingId = response.body.recording.id;
    });

    it('should retrieve specific recording with transcription', async () => {
      // Mock and process transcription
      jest
        .spyOn(transcriptionService as any, 'transcribeAudio')
        .mockResolvedValue({
          text: mockRecording001Transcription,
          language: 'en-US',
          confidence: 0.95,
        });

      await transcriptionService.processTranscription(recordingId);

      // Get recording
      const response = await request(app.getHttpServer())
        .get(`/transcription/recordings/${recordingId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.recording).toBeDefined();
      // The getTranscription method returns transcription with audioRecording included
      expect(response.body.recording.audioRecording).toBeDefined();
      expect(response.body.recording.content).toContain('Project Alpha');
    });
  });

  describe('Dashboard Verification', () => {
    beforeEach(async () => {
      // Upload and process recordings
      const audioBuffer = getMockAudioBuffer();

      for (const [index, recording] of mockTeamsRecordings.entries()) {
        const uploadResponse = await request(app.getHttpServer())
          .post('/transcription/upload')
          .set('Authorization', `Bearer ${authToken}`)
          .field('source', 'teams')
          .field('sourceId', recording.id)
          .field('meetingTitle', mockTeamsMeetings[index].subject)
          .attach('file', audioBuffer, `recording${index}.wav`);

        const recId = uploadResponse.body.recording.id;

        // Mock and process transcription
        const transcriptionText =
          index === 0
            ? mockRecording001Transcription
            : 'Sprint review transcription text';

        jest
          .spyOn(transcriptionService as any, 'transcribeAudio')
          .mockResolvedValue({
            text: transcriptionText,
            language: 'en-US',
            confidence: 0.9,
          });

        await transcriptionService.processTranscription(recId);
      }
    });

    it('should verify Teams recordings appear in dashboard (unprocessed)', async () => {
      const response = await request(app.getHttpServer())
        .get('/transcription/recordings')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const teamsRecordings = response.body.recordings.filter(
        (rec: any) => rec.source === 'teams',
      );

      expect(teamsRecordings.length).toBeGreaterThan(0);

      // Verify recording data is visible
      teamsRecordings.forEach((rec: any) => {
        expect(rec.id).toBeDefined();
        expect(rec.meetingTitle).toBeDefined();
        expect(rec.transcriptionStatus).toBe('completed');
        expect(rec.source).toBe('teams');
      });
    });

    it('should verify Teams transcriptions are searchable', async () => {
      const prisma = getPrismaClient();

      // Get all transcriptions
      const transcriptions = await prisma.transcription.findMany({
        include: {
          audioRecording: true,
        },
      });

      const teamsTranscriptions = transcriptions.filter(
        (t) => t.audioRecording.source === 'teams',
      );

      expect(teamsTranscriptions.length).toBeGreaterThan(0);

      // Verify content is searchable
      const withProjectAlpha = teamsTranscriptions.find((t) =>
        t.content.includes('Project Alpha'),
      );

      expect(withProjectAlpha).toBeDefined();
      expect(withProjectAlpha?.audioRecording.meetingTitle).toBe(
        mockTeamsMeetings[0].subject,
      );
    });

    it('should verify system stats include Teams recordings', async () => {
      const response = await request(app.getHttpServer())
        .get('/admin/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.recordings).toBeGreaterThanOrEqual(
        mockTeamsRecordings.length,
      );
      expect(response.body.transcriptions).toBeGreaterThanOrEqual(
        mockTeamsRecordings.length,
      );
    });

    it('should allow retry of failed transcriptions', async () => {
      // Create a recording that will fail
      const audioBuffer = getMockAudioBuffer();

      const uploadResponse = await request(app.getHttpServer())
        .post('/transcription/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('source', 'teams')
        .field('sourceId', 'recording-failed-001')
        .field('meetingTitle', 'Failed Meeting')
        .attach('file', audioBuffer, 'failed.wav');

      const recordingId = uploadResponse.body.recording.id;

      // Mock transcription to fail
      jest
        .spyOn(transcriptionService as any, 'transcribeAudio')
        .mockRejectedValueOnce(new Error('Transcription failed'));

      // Process transcription (will fail)
      await expect(
        transcriptionService.processTranscription(recordingId),
      ).rejects.toThrow();

      // Verify status is failed
      let prisma = getPrismaClient();
      let recording = await prisma.audioRecording.findUnique({
        where: { id: recordingId },
      });
      expect(recording?.transcriptionStatus).toBe('failed');

      // Retry transcription (mock success this time)
      jest
        .spyOn(transcriptionService as any, 'transcribeAudio')
        .mockResolvedValueOnce({
          text: 'Retried transcription text',
          language: 'en-US',
          confidence: 0.85,
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
