/**
 * Mock Teams data for e2e testing
 */

export const mockTeams = [
  {
    id: 'team-001',
    displayName: 'Engineering Team',
    description: 'Main engineering team workspace',
  },
  {
    id: 'team-002',
    displayName: 'Product Team',
    description: 'Product management and design',
  },
];

export const mockChannels = [
  {
    id: 'channel-001',
    displayName: 'General',
    description: 'General team discussions',
  },
  {
    id: 'channel-002',
    displayName: 'Project Alpha',
    description: 'Discussions about Project Alpha',
  },
];

export const mockTeamsMessages = [
  {
    id: '1234567890123',
    createdDateTime: '2025-01-10T10:00:00Z',
    lastModifiedDateTime: '2025-01-10T10:00:00Z',
    messageType: 'message',
    subject: null,
    summary: null,
    importance: 'normal',
    body: {
      contentType: 'html',
      content:
        '<p>We need to implement the user authentication feature for Project Alpha by next week.</p>',
    },
    from: {
      user: {
        id: 'user-001',
        displayName: 'John Doe',
        userIdentityType: 'aadUser',
      },
    },
    attachments: [],
    mentions: [],
    reactions: [],
  },
  {
    id: '1234567890124',
    createdDateTime: '2025-01-10T11:30:00Z',
    lastModifiedDateTime: '2025-01-10T11:30:00Z',
    messageType: 'message',
    subject: null,
    summary: null,
    importance: 'normal',
    body: {
      contentType: 'html',
      content:
        '<p>The database schema for Project Alpha has been finalized. We can start development.</p>',
    },
    from: {
      user: {
        id: 'user-002',
        displayName: 'Jane Smith',
        userIdentityType: 'aadUser',
      },
    },
    attachments: [],
    mentions: [],
    reactions: [],
  },
  {
    id: '1234567890125',
    createdDateTime: '2025-01-11T09:15:00Z',
    lastModifiedDateTime: '2025-01-11T09:15:00Z',
    messageType: 'message',
    subject: null,
    summary: null,
    importance: 'high',
    body: {
      contentType: 'html',
      content:
        '<p>Task: Create API endpoints for user registration and login. Assigned to @John Doe. Due: Jan 15.</p>',
    },
    from: {
      user: {
        id: 'user-003',
        displayName: 'Bob Johnson',
        userIdentityType: 'aadUser',
      },
    },
    attachments: [],
    mentions: [
      {
        id: 0,
        mentionText: 'John Doe',
        mentioned: {
          user: {
            id: 'user-001',
            displayName: 'John Doe',
          },
        },
      },
    ],
    reactions: [],
  },
  {
    id: '1234567890126',
    createdDateTime: '2025-01-12T14:00:00Z',
    lastModifiedDateTime: '2025-01-12T14:00:00Z',
    messageType: 'message',
    subject: null,
    summary: null,
    importance: 'normal',
    body: {
      contentType: 'html',
      content:
        '<p>Meeting notes from Project Alpha standup: All tasks are on track. Frontend integration will start next Monday.</p>',
    },
    from: {
      user: {
        id: 'user-002',
        displayName: 'Jane Smith',
        userIdentityType: 'aadUser',
      },
    },
    attachments: [],
    mentions: [],
    reactions: [],
  },
];

export const mockTeamsMessagesResponse = {
  '@odata.context': 'https://graph.microsoft.com/v1.0/$metadata#Collection(chatMessage)',
  '@odata.count': mockTeamsMessages.length,
  value: mockTeamsMessages,
};

export default {
  mockTeams,
  mockChannels,
  mockTeamsMessages,
  mockTeamsMessagesResponse,
};
