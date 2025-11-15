import { PrismaClient } from '@prisma/client';
import { hash } from 'bcrypt';

let prisma: PrismaClient;

/**
 * Get or create Prisma client for testing
 */
export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  }
  return prisma;
}

/**
 * Clean all tables in the test database
 */
export async function cleanDatabase(): Promise<void> {
  const prisma = getPrismaClient();

  // Delete in reverse order of dependencies
  await prisma.entity.deleteMany({});
  await prisma.timelineEvent.deleteMany({});
  await prisma.requirement.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.transcription.deleteMany({});
  await prisma.audioRecording.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.integration.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.user.deleteMany({});
}

/**
 * Create a test user
 */
export async function createTestUser(data?: { email?: string; name?: string; password?: string }) {
  const prisma = getPrismaClient();
  const hashedPassword = await hash(data?.password || 'testpassword', 10);

  return prisma.user.create({
    data: {
      email: data?.email || 'test@example.com',
      name: data?.name || 'Test User',
      password: hashedPassword,
    },
  });
}

/**
 * Create a Teams integration for testing
 */
export async function createTeamsIntegration(userId: string) {
  const prisma = getPrismaClient();

  return prisma.integration.create({
    data: {
      userId,
      platform: 'teams',
      accessToken: 'mock-teams-access-token',
      refreshToken: 'mock-teams-refresh-token',
      expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
      workspaceId: 'mock-tenant-id',
      workspaceName: 'Test Teams Workspace',
      isActive: true,
    },
  });
}

/**
 * Create a Slack integration for testing
 */
export async function createSlackIntegration(userId: string) {
  const prisma = getPrismaClient();

  return prisma.integration.create({
    data: {
      userId,
      platform: 'slack',
      accessToken: 'mock-slack-access-token',
      refreshToken: 'mock-slack-refresh-token',
      expiresAt: new Date(Date.now() + 3600000),
      workspaceId: 'T12345678',
      workspaceName: 'Test Slack Workspace',
      isActive: true,
    },
  });
}

/**
 * Create a test project
 */
export async function createTestProject(data?: {
  name?: string;
  description?: string;
  status?: string;
}) {
  const prisma = getPrismaClient();

  return prisma.project.create({
    data: {
      name: data?.name || 'Test Project',
      description: data?.description || 'A test project for e2e testing',
      status: data?.status || 'planning',
    },
  });
}

/**
 * Setup test database - run migrations and clean data
 */
export async function setupTestDatabase(): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.$connect();
  await cleanDatabase();
}

/**
 * Teardown test database
 */
export async function teardownTestDatabase(): Promise<void> {
  const prisma = getPrismaClient();
  await cleanDatabase();
  await prisma.$disconnect();
}

/**
 * Close database connection
 */
export async function closeDatabaseConnection(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
  }
}
