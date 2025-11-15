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
  mockTeams,
  mockChannels,
  mockTeamsMessages,
} from './fixtures/teams-messages.fixture';

describe('Teams Messages E2E', () => {
  let app: INestApplication;
  let userId: string;
  let authToken: string;
  let mockTeamsApi: MockTeamsAPI;

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

    // Create test user and integration
    const user = await createTestUser({
      email: 'teams-test@example.com',
      name: 'Teams Test User',
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

  describe('POST /admin/sync/teams', () => {
    it('should retrieve Teams messages and store them in the database', async () => {
      // Mock Graph API responses
      mockTeamsApi
        .mockGetTeams(mockTeams)
        .mockGetChannels(mockTeams[0].id, mockChannels)
        .mockGetChannelMessages(
          mockTeams[0].id,
          mockChannels[0].id,
          mockTeamsMessages,
        );

      // Trigger Teams sync
      const syncResponse = await request(app.getHttpServer())
        .post('/admin/sync/teams')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      // Verify sync was successful
      expect(syncResponse.body.success).toBe(true);
      expect(syncResponse.body.totalMessages).toBeGreaterThan(0);

      // Verify messages were stored in database
      const prisma = getPrismaClient();
      const messagesInDb = await prisma.message.findMany({
        where: { source: 'teams' },
      });

      expect(messagesInDb.length).toBe(mockTeamsMessages.length);

      // Verify message content
      const firstMessage = messagesInDb.find(
        (m) => m.sourceId === mockTeamsMessages[0].id,
      );
      expect(firstMessage).toBeDefined();
      expect(firstMessage?.content).toContain('user authentication');
      expect(firstMessage?.authorName).toBe('John Doe');
      expect(firstMessage?.channelName).toBe('General');
    });

    it('should handle duplicate messages correctly (upsert)', async () => {
      // Mock Graph API responses
      mockTeamsApi
        .mockGetTeams(mockTeams)
        .mockGetChannels(mockTeams[0].id, mockChannels)
        .mockGetChannelMessages(
          mockTeams[0].id,
          mockChannels[0].id,
          mockTeamsMessages,
        );

      // First sync
      await request(app.getHttpServer())
        .post('/admin/sync/teams')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      const prisma = getPrismaClient();
      const messagesAfterFirstSync = await prisma.message.count({
        where: { source: 'teams' },
      });

      // Reset mocks and sync again
      mockTeamsApi.cleanup();
      mockTeamsApi = new MockTeamsAPI();
      mockTeamsApi
        .mockGetTeams(mockTeams)
        .mockGetChannels(mockTeams[0].id, mockChannels)
        .mockGetChannelMessages(
          mockTeams[0].id,
          mockChannels[0].id,
          mockTeamsMessages,
        );

      // Second sync
      await request(app.getHttpServer())
        .post('/admin/sync/teams')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      const messagesAfterSecondSync = await prisma.message.count({
        where: { source: 'teams' },
      });

      // Should have same count (upserted, not duplicated)
      expect(messagesAfterSecondSync).toBe(messagesAfterFirstSync);
    });
  });

  describe('GET /messages', () => {
    beforeEach(async () => {
      // Setup: Sync Teams messages
      mockTeamsApi
        .mockGetTeams(mockTeams)
        .mockGetChannels(mockTeams[0].id, mockChannels)
        .mockGetChannelMessages(
          mockTeams[0].id,
          mockChannels[0].id,
          mockTeamsMessages,
        );

      await request(app.getHttpServer())
        .post('/admin/sync/teams')
        .set('Authorization', `Bearer ${authToken}`);
    });

    it('should retrieve all Teams messages', async () => {
      const response = await request(app.getHttpServer())
        .get('/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      // Verify Teams messages are present
      const teamsMessages = response.body.filter(
        (msg: any) => msg.source === 'teams',
      );
      expect(teamsMessages.length).toBe(mockTeamsMessages.length);
    });

    it('should filter messages by source=TEAMS', async () => {
      const response = await request(app.getHttpServer())
        .get('/messages?source=teams')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);

      // All returned messages should be from Teams
      response.body.forEach((msg: any) => {
        expect(msg.source).toBe('teams');
      });

      expect(response.body.length).toBe(mockTeamsMessages.length);
    });

    it('should filter messages by channel ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/messages?channelId=${mockChannels[0].id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);

      // All messages should be from the specified channel
      response.body.forEach((msg: any) => {
        expect(msg.channelId).toBe(mockChannels[0].id);
      });
    });

    it('should filter messages by date range', async () => {
      const startDate = '2025-01-10T00:00:00Z';
      const endDate = '2025-01-11T23:59:59Z';

      const response = await request(app.getHttpServer())
        .get(`/messages?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);

      // Verify messages are within date range
      response.body.forEach((msg: any) => {
        const msgDate = new Date(msg.timestamp);
        expect(msgDate >= new Date(startDate)).toBe(true);
        expect(msgDate <= new Date(endDate)).toBe(true);
      });
    });
  });

  describe('GET /messages/statistics', () => {
    beforeEach(async () => {
      // Setup: Sync Teams messages
      mockTeamsApi
        .mockGetTeams(mockTeams)
        .mockGetChannels(mockTeams[0].id, mockChannels)
        .mockGetChannelMessages(
          mockTeams[0].id,
          mockChannels[0].id,
          mockTeamsMessages,
        );

      await request(app.getHttpServer())
        .post('/admin/sync/teams')
        .set('Authorization', `Bearer ${authToken}`);
    });

    it('should return statistics for Teams messages', async () => {
      const response = await request(app.getHttpServer())
        .get('/messages/statistics?source=teams')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.totalMessages).toBe(mockTeamsMessages.length);
      expect(response.body.bySource).toBeDefined();
      expect(response.body.bySource.teams).toBe(mockTeamsMessages.length);
    });
  });

  describe('Dashboard Verification', () => {
    beforeEach(async () => {
      // Setup: Sync Teams messages
      mockTeamsApi
        .mockGetTeams(mockTeams)
        .mockGetChannels(mockTeams[0].id, mockChannels)
        .mockGetChannelMessages(
          mockTeams[0].id,
          mockChannels[0].id,
          mockTeamsMessages,
        );

      await request(app.getHttpServer())
        .post('/admin/sync/teams')
        .set('Authorization', `Bearer ${authToken}`);
    });

    it('should verify Teams messages appear in dashboard data (unprocessed)', async () => {
      // Get all messages (dashboard view)
      const messagesResponse = await request(app.getHttpServer())
        .get('/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify unprocessed Teams messages are visible
      const teamsMessages = messagesResponse.body.filter(
        (msg: any) => msg.source === 'teams',
      );

      expect(teamsMessages.length).toBeGreaterThan(0);

      // Verify message data is intact and visible
      teamsMessages.forEach((msg: any) => {
        expect(msg.id).toBeDefined();
        expect(msg.content).toBeDefined();
        expect(msg.authorName).toBeDefined();
        expect(msg.timestamp).toBeDefined();
        expect(msg.source).toBe('teams');
      });

      // Get system stats (dashboard overview)
      const statsResponse = await request(app.getHttpServer())
        .get('/admin/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(statsResponse.body.messages.teams).toBe(mockTeamsMessages.length);
      expect(statsResponse.body.messages.total).toBeGreaterThanOrEqual(
        mockTeamsMessages.length,
      );
    });

    it('should verify Teams messages can be searched', async () => {
      const searchResponse = await request(app.getHttpServer())
        .post('/messages/search')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query: 'authentication' })
        .expect(201);

      expect(Array.isArray(searchResponse.body)).toBe(true);

      // Should find messages containing "authentication"
      const foundMessages = searchResponse.body.filter(
        (msg: any) =>
          msg.content.toLowerCase().includes('authentication') &&
          msg.source === 'teams',
      );

      expect(foundMessages.length).toBeGreaterThan(0);
    });
  });
});
