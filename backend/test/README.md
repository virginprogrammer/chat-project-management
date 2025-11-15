# E2E Test Suite

This directory contains end-to-end (e2e) tests for the Chat Project Management system, covering Teams and Slack integrations including message retrieval, voice/audio transcription, and dashboard verification.

## Overview

The e2e test suite validates the complete data flow from external platforms (Microsoft Teams and Slack) through to the project management dashboard, ensuring data is correctly retrieved, processed, stored, and displayed.

## Test Coverage

### 1. Teams Messages E2E (`teams-messages.e2e-spec.ts`)
Tests the complete Teams message integration flow:
- ✅ Retrieves messages from Teams channels via Microsoft Graph API
- ✅ Stores messages in database with proper metadata
- ✅ Handles duplicate messages (upsert logic)
- ✅ Verifies messages are accessible via REST API
- ✅ Tests filtering by source, channel, date range
- ✅ Validates messages appear in dashboard (unprocessed state OK)
- ✅ Tests message search functionality

### 2. Slack Messages E2E (`slack-messages.e2e-spec.ts`)
Tests the complete Slack message integration flow:
- ✅ Retrieves messages from Slack channels via Web API
- ✅ Stores messages with correct source identifier
- ✅ Handles bot message filtering
- ✅ Verifies message deduplication
- ✅ Tests API filtering and queries
- ✅ Validates dashboard visibility
- ✅ Tests message mentions handling

### 3. Teams Voice/Recordings E2E (`teams-voice.e2e-spec.ts`)
Tests Teams audio recording and transcription flow:
- ✅ Uploads Teams meeting recordings
- ✅ Stores audio files in S3 (mocked)
- ✅ Creates AudioRecording database entries
- ✅ Processes transcription via Azure Speech Services (mocked)
- ✅ Stores transcription results
- ✅ Handles transcription failures and retries
- ✅ Verifies recordings appear in dashboard
- ✅ Tests transcription searchability

### 4. Slack Voice/Recordings E2E (`slack-voice.e2e-spec.ts`)
Tests Slack audio file and transcription flow:
- ✅ Uploads Slack audio files (MP3 format)
- ✅ Processes audio through transcription pipeline
- ✅ Differentiates between Teams and Slack sources
- ✅ Validates transcription content
- ✅ Tests retry mechanisms
- ✅ Verifies dashboard integration
- ✅ Tests system statistics

## Architecture

### Test Infrastructure

```
backend/test/
├── fixtures/              # Mock data for tests
│   ├── teams-messages.fixture.ts
│   ├── slack-messages.fixture.ts
│   ├── teams-recordings.fixture.ts
│   └── slack-recordings.fixture.ts
├── helpers/               # Test utilities
│   ├── api-client.helper.ts
│   ├── auth.helper.ts
│   ├── database.helper.ts
│   ├── fixtures.helper.ts
│   └── mock-services.helper.ts
├── teams-messages.e2e-spec.ts
├── slack-messages.e2e-spec.ts
├── teams-voice.e2e-spec.ts
├── slack-voice.e2e-spec.ts
├── jest-e2e.json          # E2E Jest configuration
└── README.md              # This file
```

### Key Components

#### Fixtures
Mock data that simulates real API responses from Teams and Slack:
- **Teams Messages**: Microsoft Graph API channel message format
- **Slack Messages**: Slack Web API conversation history format
- **Teams Recordings**: Meeting recording metadata and audio buffers
- **Slack Audio**: File metadata and MP3 audio buffers

#### Helpers
Reusable utilities for testing:
- **Database Helper**: Setup/teardown, user/integration creation
- **Auth Helper**: JWT token generation for authenticated requests
- **API Client Helper**: Supertest wrapper for API requests
- **Mock Services Helper**: HTTP mocking for external APIs (nock)

#### Mocking Strategy
External services are mocked to avoid dependencies:
- **Microsoft Graph API**: Mocked with nock
- **Slack Web API**: Mocked with nock
- **AWS S3**: SDK methods mocked with Jest
- **Azure Speech Services**: Transcription mocked with Jest
- **OpenAI API**: Mocked with nock (if NLP tests added)

## Running Tests

### Prerequisites

1. **PostgreSQL** database (test instance)
2. **Redis** server (for Bull queues)
3. **Node.js 18+**
4. **Environment variables** (see `.env.test`)

### Local Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Setup test database
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

### Run All E2E Tests

```bash
npm run test:e2e
```

### Run Specific Test Suites

```bash
# Teams messages only
npm run test:e2e -- teams-messages.e2e-spec.ts

# Slack messages only
npm run test:e2e -- slack-messages.e2e-spec.ts

# Teams voice only
npm run test:e2e -- teams-voice.e2e-spec.ts

# Slack voice only
npm run test:e2e -- slack-voice.e2e-spec.ts
```

### Run with Coverage

```bash
npm run test:e2e -- --coverage
```

### Watch Mode

```bash
npm run test:e2e -- --watch
```

## Environment Configuration

Create a `.env.test` file in the `backend/` directory:

```env
# Database
DATABASE_URL="postgresql://testuser:testpass@localhost:5432/chat_pm_test?schema=public"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=1

# JWT
JWT_SECRET=test-secret-key-for-e2e-tests-only
JWT_EXPIRES_IN=1h

# Microsoft Teams (Mock values)
TEAMS_CLIENT_ID=test-teams-client-id
TEAMS_CLIENT_SECRET=test-teams-client-secret
TEAMS_REDIRECT_URI=http://localhost:3000/api/auth/teams/callback

# Slack (Mock values)
SLACK_CLIENT_ID=test-slack-client-id
SLACK_CLIENT_SECRET=test-slack-client-secret
SLACK_REDIRECT_URI=http://localhost:3000/api/auth/slack/callback

# AWS S3 (Mock)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=test-access-key
AWS_SECRET_ACCESS_KEY=test-secret-key
S3_BUCKET=test-chat-pm-recordings

# Azure Speech (Mock)
AZURE_SPEECH_KEY=test-azure-speech-key
AZURE_SPEECH_REGION=eastus

# OpenAI (Mock)
OPENAI_API_KEY=test-openai-api-key
OPENAI_MODEL=gpt-4

# Server
PORT=3001
```

## CI/CD Integration

E2E tests run automatically in GitHub Actions:

```yaml
- name: Run backend e2e tests
  working-directory: backend
  run: npm run test:e2e
  env:
    DATABASE_URL: postgresql://test:test@localhost:5432/teams_slack_pm_test
    # ... (see .github/workflows/ci.yml for full config)
```

The CI pipeline:
1. ✅ Starts PostgreSQL and Redis services
2. ✅ Runs database migrations
3. ✅ Executes unit tests
4. ✅ **Executes e2e tests**
5. ✅ Builds Docker images

## Test Patterns

### Typical Test Flow

```typescript
describe('Feature E2E', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    // Setup test database
    await setupTestDatabase();

    // Create NestJS test module
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Create test user and auth token
    const user = await createTestUser();
    authToken = generateTestToken(user.id, user.email);
  });

  afterAll(async () => {
    await teardownTestDatabase();
    await app.close();
  });

  it('should perform end-to-end operation', async () => {
    // 1. Setup: Mock external API
    mockExternalAPI.mockResponse(data);

    // 2. Action: Trigger operation via API
    const response = await request(app.getHttpServer())
      .post('/api/endpoint')
      .set('Authorization', `Bearer ${authToken}`)
      .send(payload);

    // 3. Assert: Verify response
    expect(response.status).toBe(201);

    // 4. Assert: Verify database state
    const dbRecord = await prisma.findUnique(...);
    expect(dbRecord).toBeDefined();

    // 5. Assert: Verify dashboard visibility
    const dashboardResponse = await request(app.getHttpServer())
      .get('/api/dashboard')
      .set('Authorization', `Bearer ${authToken}`);
    expect(dashboardResponse.body).toContainEqual(...);
  });
});
```

### Database Cleanup

Tests use transactions or manual cleanup:

```typescript
beforeEach(async () => {
  await cleanDatabase(); // Deletes all test data
});
```

### API Mocking Example

```typescript
import { MockTeamsAPI } from './helpers/mock-services.helper';

const mockApi = new MockTeamsAPI();

mockApi
  .mockGetTeams(mockTeams)
  .mockGetChannels(teamId, mockChannels)
  .mockGetChannelMessages(teamId, channelId, mockMessages);

// Cleanup after test
mockApi.cleanup();
```

## Dashboard Verification Strategy

All tests verify that data appears in the dashboard in **unprocessed state**:

1. **Data Retrieval**: External APIs return data
2. **Data Storage**: Data saved to database
3. **API Accessibility**: Data queryable via REST endpoints
4. **Dashboard Visibility**: Data appears in dashboard queries
5. **Unprocessed OK**: NLP processing not required for test pass

This ensures the core integration works before complex NLP processing.

## Troubleshooting

### Tests Failing Locally

**Database Connection Issues:**
```bash
# Ensure PostgreSQL is running
psql -U testuser -d chat_pm_test

# Re-run migrations
npx prisma migrate deploy
```

**Redis Connection Issues:**
```bash
# Ensure Redis is running
redis-cli ping

# Check port
redis-cli -h localhost -p 6379 ping
```

**Port Conflicts:**
```bash
# Change PORT in .env.test
PORT=3002
```

### Mock Not Working

**Nock not intercepting:**
```typescript
// Ensure nock is imported before making requests
import * as nock from 'nock';

// Check nock scope
console.log(nock.pendingMocks()); // Should be empty after test
```

**Jest mock not applied:**
```typescript
// Use spyOn for existing methods
jest.spyOn(service, 'method').mockResolvedValue(value);

// Clear mocks between tests
jest.clearAllMocks();
```

### Database State Issues

**Data persisting between tests:**
```typescript
// Ensure cleanup runs
afterEach(async () => {
  await cleanDatabase();
});

// Or use transactions (if supported)
```

### Timeout Errors

**Increase test timeout:**
```typescript
it('long running test', async () => {
  // Test code
}, 30000); // 30 seconds
```

**Or in jest-e2e.json:**
```json
{
  "testTimeout": 30000
}
```

## Adding New E2E Tests

### 1. Create Fixture Data

```typescript
// test/fixtures/my-feature.fixture.ts
export const mockData = {
  // Mock API response data
};
```

### 2. Create Test File

```typescript
// test/my-feature.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';

describe('My Feature E2E', () => {
  // Setup, tests, teardown
});
```

### 3. Add Mocks (if needed)

```typescript
// In helpers/mock-services.helper.ts
export class MockMyServiceAPI {
  mockEndpoint(data: any) {
    nock('https://api.example.com')
      .get('/endpoint')
      .reply(200, data);
  }
}
```

### 4. Update README

Add your new test to the coverage list above.

## Best Practices

1. ✅ **Isolate tests**: Each test should be independent
2. ✅ **Clean state**: Reset database between tests
3. ✅ **Mock external APIs**: Don't hit real services
4. ✅ **Verify database state**: Check data was stored correctly
5. ✅ **Test dashboard visibility**: Ensure UI can access data
6. ✅ **Handle async properly**: Use async/await, not callbacks
7. ✅ **Meaningful assertions**: Test the important behavior
8. ✅ **Descriptive test names**: Explain what's being tested
9. ✅ **Group related tests**: Use describe blocks
10. ✅ **Document complex logic**: Add comments for clarity

## Performance Considerations

- Tests run **sequentially** (maxWorkers: 1) to avoid DB conflicts
- Each test suite takes ~10-30 seconds
- Total e2e suite: ~2-5 minutes
- Mock services avoid network latency
- Database cleanup is fast (DELETE operations)

## Future Enhancements

Potential additions to the e2e test suite:

- [ ] NLP processing verification (entity extraction)
- [ ] Project auto-creation from messages
- [ ] Task and requirement extraction tests
- [ ] Timeline event generation tests
- [ ] Webhook subscription tests
- [ ] Real-time message sync tests
- [ ] Multi-user collaboration tests
- [ ] Permission and access control tests

## Contributing

When adding new e2e tests:

1. Follow existing patterns
2. Add fixtures for new data sources
3. Mock all external services
4. Verify dashboard integration
5. Update this README
6. Ensure tests pass in CI

## Support

For issues or questions:
- Check troubleshooting section above
- Review existing test files for examples
- Check Jest and NestJS testing documentation
- Create an issue in the repository

---

**Last Updated**: 2025-01-15
**Test Coverage**: 4 test suites, 50+ test cases
**Platforms**: Teams (Messages & Voice), Slack (Messages & Voice)
