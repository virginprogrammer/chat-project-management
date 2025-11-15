import * as nock from 'nock';

/**
 * Mock Microsoft Graph API responses
 */
export class MockTeamsAPI {
  private scope: nock.Scope;

  constructor() {
    this.scope = nock('https://graph.microsoft.com');
  }

  /**
   * Mock channel messages endpoint
   */
  mockGetChannelMessages(teamId: string, channelId: string, messages: any[]) {
    this.scope.get(`/v1.0/teams/${teamId}/channels/${channelId}/messages`).query(true).reply(200, {
      '@odata.context': 'https://graph.microsoft.com/v1.0/$metadata#Collection(chatMessage)',
      '@odata.count': messages.length,
      value: messages,
    });

    return this;
  }

  /**
   * Mock teams list endpoint
   */
  mockGetTeams(teams: any[]) {
    this.scope.get('/v1.0/me/joinedTeams').reply(200, {
      value: teams,
    });

    return this;
  }

  /**
   * Mock channels list endpoint
   */
  mockGetChannels(teamId: string, channels: any[]) {
    this.scope.get(`/v1.0/teams/${teamId}/channels`).reply(200, {
      value: channels,
    });

    return this;
  }

  /**
   * Mock meeting recording download
   */
  mockGetRecording(recordingUrl: string, audioBuffer: Buffer) {
    const url = new URL(recordingUrl);
    nock(url.origin).get(url.pathname).query(true).reply(200, audioBuffer, {
      'Content-Type': 'audio/mp4',
    });

    return this;
  }

  /**
   * Mock call recordings list
   */
  mockGetCallRecordings(recordings: any[]) {
    this.scope.get('/v1.0/me/onlineMeetings').query(true).reply(200, {
      value: recordings,
    });

    return this;
  }

  /**
   * Clean up all mocks
   */
  cleanup() {
    nock.cleanAll();
  }
}

/**
 * Mock Slack Web API responses
 */
export class MockSlackAPI {
  private scope: nock.Scope;

  constructor() {
    this.scope = nock('https://slack.com');
  }

  /**
   * Mock conversations.history endpoint
   */
  mockConversationsHistory(channelId: string, messages: any[]) {
    this.scope.post('/api/conversations.history').reply(200, {
      ok: true,
      messages,
      has_more: false,
    });

    return this;
  }

  /**
   * Mock conversations.list endpoint
   */
  mockConversationsList(channels: any[]) {
    this.scope.post('/api/conversations.list').reply(200, {
      ok: true,
      channels,
    });

    return this;
  }

  /**
   * Mock users.info endpoint
   */
  mockUsersInfo(userId: string, user: any) {
    this.scope.post('/api/users.info').reply(200, {
      ok: true,
      user,
    });

    return this;
  }

  /**
   * Mock files.list endpoint
   */
  mockFilesList(files: any[]) {
    this.scope.post('/api/files.list').reply(200, {
      ok: true,
      files,
    });

    return this;
  }

  /**
   * Mock file download
   */
  mockFileDownload(downloadUrl: string, fileBuffer: Buffer) {
    const url = new URL(downloadUrl);
    nock(url.origin).get(url.pathname).query(true).reply(200, fileBuffer, {
      'Content-Type': 'audio/mpeg',
    });

    return this;
  }

  /**
   * Clean up all mocks
   */
  cleanup() {
    nock.cleanAll();
  }
}

/**
 * Mock AWS S3 SDK
 */
export function mockS3Upload() {
  return jest.fn().mockImplementation(() => ({
    promise: jest.fn().mockResolvedValue({
      Location: 'https://test-bucket.s3.amazonaws.com/test-file.mp3',
      ETag: '"mock-etag"',
      Bucket: 'test-chat-pm-recordings',
      Key: 'test-file.mp3',
    }),
  }));
}

/**
 * Mock Azure Speech Service
 */
export function mockAzureSpeech(transcriptionText: string) {
  return {
    recognizing: jest.fn(),
    recognized: jest.fn((callback) => {
      // Simulate recognition result
      setTimeout(() => {
        callback(null, {
          result: {
            text: transcriptionText,
            reason: 3, // ResultReason.RecognizedSpeech
          },
        });
      }, 100);
    }),
    canceled: jest.fn(),
    sessionStarted: jest.fn(),
    sessionStopped: jest.fn(),
    startContinuousRecognitionAsync: jest.fn((successCallback) => {
      successCallback();
    }),
    stopContinuousRecognitionAsync: jest.fn((successCallback) => {
      successCallback();
    }),
  };
}

/**
 * Mock OpenAI API
 */
export class MockOpenAI {
  private scope: nock.Scope;

  constructor() {
    this.scope = nock('https://api.openai.com');
  }

  /**
   * Mock chat completions endpoint
   */
  mockChatCompletion(response: any) {
    this.scope.post('/v1/chat/completions').reply(200, {
      id: 'chatcmpl-mock',
      object: 'chat.completion',
      created: Date.now(),
      model: 'gpt-4',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: JSON.stringify(response),
          },
          finish_reason: 'stop',
        },
      ],
    });

    return this;
  }

  /**
   * Clean up all mocks
   */
  cleanup() {
    nock.cleanAll();
  }
}

/**
 * Clean up all HTTP mocks
 */
export function cleanupAllMocks() {
  nock.cleanAll();
}
