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
  mockSlackChannels,
  mockSlackUsers,
  mockSlackMessages,
} from './fixtures/slack-messages.fixture';

describe('Slack Messages E2E', () => {
  let app: INestApplication;
  let userId: string;
  let authToken: string;
  let mockSlackApi: MockSlackAPI;

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
      email: 'slack-test@example.com',
      name: 'Slack Test User',
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

  describe('POST /admin/sync/slack', () => {
    it('should retrieve Slack messages and store them in the database', async () => {
      // Mock Slack API responses
      mockSlackApi
        .mockConversationsList(mockSlackChannels)
        .mockConversationsHistory(
          mockSlackChannels[0].id,
          mockSlackMessages,
        );

      // Mock user info requests
      mockSlackMessages.forEach((msg: any) => {
        const user = mockSlackUsers.find((u) => u.id === msg.user);
        if (user) {
          mockSlackApi.mockUsersInfo(msg.user, user);
        }
      });

      // Trigger Slack sync
      const syncResponse = await request(app.getHttpServer())
        .post('/admin/sync/slack')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      // Verify sync was successful
      expect(syncResponse.body.success).toBe(true);
      expect(syncResponse.body.totalMessages).toBeGreaterThan(0);

      // Verify messages were stored in database
      const prisma = getPrismaClient();
      const messagesInDb = await prisma.message.findMany({
        where: { source: 'slack' },
      });

      expect(messagesInDb.length).toBe(mockSlackMessages.length);

      // Verify message content
      const firstMessage = messagesInDb.find(
        (m) => m.sourceId === mockSlackMessages[0].ts,
      );
      expect(firstMessage).toBeDefined();
      expect(firstMessage?.content).toContain('Project Beta');
      expect(firstMessage?.authorName).toBe('Alice Johnson');
      expect(firstMessage?.channelName).toBe('general');
    });

    it('should handle duplicate messages correctly (upsert)', async () => {
      // Mock Slack API responses
      mockSlackApi
        .mockConversationsList(mockSlackChannels)
        .mockConversationsHistory(
          mockSlackChannels[0].id,
          mockSlackMessages,
        );

      // Mock user info
      mockSlackMessages.forEach((msg: any) => {
        const user = mockSlackUsers.find((u) => u.id === msg.user);
        if (user) {
          mockSlackApi.mockUsersInfo(msg.user, user);
        }
      });

      // First sync
      await request(app.getHttpServer())
        .post('/admin/sync/slack')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      const prisma = getPrismaClient();
      const messagesAfterFirstSync = await prisma.message.count({
        where: { source: 'slack' },
      });

      // Reset mocks and sync again
      mockSlackApi.cleanup();
      mockSlackApi = new MockSlackAPI();
      mockSlackApi
        .mockConversationsList(mockSlackChannels)
        .mockConversationsHistory(
          mockSlackChannels[0].id,
          mockSlackMessages,
        );

      mockSlackMessages.forEach((msg: any) => {
        const user = mockSlackUsers.find((u) => u.id === msg.user);
        if (user) {
          mockSlackApi.mockUsersInfo(msg.user, user);
        }
      });

      // Second sync
      await request(app.getHttpServer())
        .post('/admin/sync/slack')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      const messagesAfterSecondSync = await prisma.message.count({
        where: { source: 'slack' },
      });

      // Should have same count (upserted, not duplicated)
      expect(messagesAfterSecondSync).toBe(messagesAfterFirstSync);
    });

    it('should skip bot messages during sync', async () => {
      // Create messages with bot messages
      const messagesWithBots = [
        ...mockSlackMessages,
        {
          type: 'message',
          user: 'U12345678',
          text: 'Regular message',
          ts: '1736528400.000600',
          bot_id: 'B12345678', // This should be skipped
        },
      ];

      mockSlackApi
        .mockConversationsList(mockSlackChannels)
        .mockConversationsHistory(
          mockSlackChannels[0].id,
          messagesWithBots,
        );

      mockSlackMessages.forEach((msg: any) => {
        const user = mockSlackUsers.find((u) => u.id === msg.user);
        if (user) {
          mockSlackApi.mockUsersInfo(msg.user, user);
        }
      });

      await request(app.getHttpServer())
        .post('/admin/sync/slack')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      const prisma = getPrismaClient();
      const messagesInDb = await prisma.message.count({
        where: { source: 'slack' },
      });

      // Should only have non-bot messages
      expect(messagesInDb).toBe(mockSlackMessages.length);
    });
  });

  describe('GET /messages', () => {
    beforeEach(async () => {
      // Setup: Sync Slack messages
      mockSlackApi
        .mockConversationsList(mockSlackChannels)
        .mockConversationsHistory(
          mockSlackChannels[0].id,
          mockSlackMessages,
        );

      mockSlackMessages.forEach((msg: any) => {
        const user = mockSlackUsers.find((u) => u.id === msg.user);
        if (user) {
          mockSlackApi.mockUsersInfo(msg.user, user);
        }
      });

      await request(app.getHttpServer())
        .post('/admin/sync/slack')
        .set('Authorization', `Bearer ${authToken}`);
    });

    it('should retrieve all Slack messages', async () => {
      const response = await request(app.getHttpServer())
        .get('/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      // Verify Slack messages are present
      const slackMessages = response.body.filter(
        (msg: any) => msg.source === 'slack',
      );
      expect(slackMessages.length).toBe(mockSlackMessages.length);
    });

    it('should filter messages by source=SLACK', async () => {
      const response = await request(app.getHttpServer())
        .get('/messages?source=slack')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);

      // All returned messages should be from Slack
      response.body.forEach((msg: any) => {
        expect(msg.source).toBe('slack');
      });

      expect(response.body.length).toBe(mockSlackMessages.length);
    });

    it('should filter messages by channel ID', async () => {
      const response = await request(app.getHttpServer())
        .get(`/messages?channelId=${mockSlackChannels[0].id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);

      // All messages should be from the specified channel
      response.body.forEach((msg: any) => {
        expect(msg.channelId).toBe(mockSlackChannels[0].id);
      });
    });

    it('should filter messages by author ID', async () => {
      const authorId = mockSlackMessages[0].user;

      const response = await request(app.getHttpServer())
        .get(`/messages?authorId=${authorId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);

      // All messages should be from the specified author
      response.body.forEach((msg: any) => {
        expect(msg.authorId).toBe(authorId);
      });
    });
  });

  describe('GET /messages/statistics', () => {
    beforeEach(async () => {
      // Setup: Sync Slack messages
      mockSlackApi
        .mockConversationsList(mockSlackChannels)
        .mockConversationsHistory(
          mockSlackChannels[0].id,
          mockSlackMessages,
        );

      mockSlackMessages.forEach((msg: any) => {
        const user = mockSlackUsers.find((u) => u.id === msg.user);
        if (user) {
          mockSlackApi.mockUsersInfo(msg.user, user);
        }
      });

      await request(app.getHttpServer())
        .post('/admin/sync/slack')
        .set('Authorization', `Bearer ${authToken}`);
    });

    it('should return statistics for Slack messages', async () => {
      const response = await request(app.getHttpServer())
        .get('/messages/statistics?source=slack')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.totalMessages).toBe(mockSlackMessages.length);
      expect(response.body.bySource).toBeDefined();
      expect(response.body.bySource.slack).toBe(mockSlackMessages.length);
    });
  });

  describe('Dashboard Verification', () => {
    beforeEach(async () => {
      // Setup: Sync Slack messages
      mockSlackApi
        .mockConversationsList(mockSlackChannels)
        .mockConversationsHistory(
          mockSlackChannels[0].id,
          mockSlackMessages,
        );

      mockSlackMessages.forEach((msg: any) => {
        const user = mockSlackUsers.find((u) => u.id === msg.user);
        if (user) {
          mockSlackApi.mockUsersInfo(msg.user, user);
        }
      });

      await request(app.getHttpServer())
        .post('/admin/sync/slack')
        .set('Authorization', `Bearer ${authToken}`);
    });

    it('should verify Slack messages appear in dashboard data (unprocessed)', async () => {
      // Get all messages (dashboard view)
      const messagesResponse = await request(app.getHttpServer())
        .get('/messages')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify unprocessed Slack messages are visible
      const slackMessages = messagesResponse.body.filter(
        (msg: any) => msg.source === 'slack',
      );

      expect(slackMessages.length).toBeGreaterThan(0);

      // Verify message data is intact and visible
      slackMessages.forEach((msg: any) => {
        expect(msg.id).toBeDefined();
        expect(msg.content).toBeDefined();
        expect(msg.authorName).toBeDefined();
        expect(msg.timestamp).toBeDefined();
        expect(msg.source).toBe('slack');
      });

      // Get system stats (dashboard overview)
      const statsResponse = await request(app.getHttpServer())
        .get('/admin/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(statsResponse.body.messages.slack).toBe(mockSlackMessages.length);
      expect(statsResponse.body.messages.total).toBeGreaterThanOrEqual(
        mockSlackMessages.length,
      );
    });

    it('should verify Slack messages can be searched', async () => {
      const searchResponse = await request(app.getHttpServer())
        .post('/messages/search')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query: 'dashboard' })
        .expect(201);

      expect(Array.isArray(searchResponse.body)).toBe(true);

      // Should find messages containing "dashboard"
      const foundMessages = searchResponse.body.filter(
        (msg: any) =>
          msg.content.toLowerCase().includes('dashboard') &&
          msg.source === 'slack',
      );

      expect(foundMessages.length).toBeGreaterThan(0);
    });

    it('should verify Slack messages with mentions are stored correctly', async () => {
      const response = await request(app.getHttpServer())
        .get('/messages?source=slack')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Find message with mention
      const messageWithMention = response.body.find((msg: any) =>
        msg.content.includes('@carol.davis'),
      );

      expect(messageWithMention).toBeDefined();
      expect(messageWithMention.content).toContain('backend API endpoints');
    });
  });
});
