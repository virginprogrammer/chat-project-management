/**
 * Mock Slack data for e2e testing
 */

export const mockSlackChannels = [
  {
    id: 'C12345678',
    name: 'general',
    is_channel: true,
    is_group: false,
    is_im: false,
    created: 1609459200,
    is_archived: false,
    is_general: true,
    is_member: true,
    is_private: false,
    is_mpim: false,
    topic: {
      value: 'Company-wide announcements and general discussion',
      creator: 'U87654321',
      last_set: 1609459200,
    },
    purpose: {
      value: 'General team discussions',
      creator: 'U87654321',
      last_set: 1609459200,
    },
    num_members: 15,
  },
  {
    id: 'C23456789',
    name: 'project-beta',
    is_channel: true,
    is_group: false,
    is_im: false,
    created: 1609545600,
    is_archived: false,
    is_general: false,
    is_member: true,
    is_private: false,
    is_mpim: false,
    topic: {
      value: 'Project Beta development and planning',
      creator: 'U12345678',
      last_set: 1609545600,
    },
    purpose: {
      value: 'Coordinate Project Beta work',
      creator: 'U12345678',
      last_set: 1609545600,
    },
    num_members: 8,
  },
];

export const mockSlackUsers = [
  {
    id: 'U12345678',
    name: 'alice.johnson',
    real_name: 'Alice Johnson',
    profile: {
      email: 'alice@example.com',
      display_name: 'Alice',
      real_name: 'Alice Johnson',
    },
  },
  {
    id: 'U87654321',
    name: 'bob.williams',
    real_name: 'Bob Williams',
    profile: {
      email: 'bob@example.com',
      display_name: 'Bob',
      real_name: 'Bob Williams',
    },
  },
  {
    id: 'U11111111',
    name: 'carol.davis',
    real_name: 'Carol Davis',
    profile: {
      email: 'carol@example.com',
      display_name: 'Carol',
      real_name: 'Carol Davis',
    },
  },
];

export const mockSlackMessages = [
  {
    type: 'message',
    user: 'U12345678',
    text: 'Starting work on Project Beta. The main goal is to implement the new dashboard UI.',
    ts: '1736510400.000100',
    team: 'T12345678',
    channel: 'C23456789',
    event_ts: '1736510400.000100',
  },
  {
    type: 'message',
    user: 'U87654321',
    text: 'Great! I\'ve reviewed the design mockups. They look solid. When are we planning to start development?',
    ts: '1736514000.000200',
    team: 'T12345678',
    channel: 'C23456789',
    event_ts: '1736514000.000200',
  },
  {
    type: 'message',
    user: 'U12345678',
    text: 'We can start development next Monday. @carol.davis will handle the backend API endpoints.',
    ts: '1736517600.000300',
    team: 'T12345678',
    channel: 'C23456789',
    event_ts: '1736517600.000300',
  },
  {
    type: 'message',
    user: 'U11111111',
    text: 'Sounds good! I\'ll work on the user authentication endpoints first. Target completion: Jan 20.',
    ts: '1736521200.000400',
    team: 'T12345678',
    channel: 'C23456789',
    event_ts: '1736521200.000400',
  },
  {
    type: 'message',
    user: 'U87654321',
    text: 'Requirement: The dashboard should load in under 2 seconds and support real-time updates.',
    ts: '1736524800.000500',
    team: 'T12345678',
    channel: 'C23456789',
    event_ts: '1736524800.000500',
  },
];

export const mockSlackMessagesResponse = {
  ok: true,
  messages: mockSlackMessages,
  has_more: false,
  pin_count: 0,
  response_metadata: {
    next_cursor: '',
  },
};

export default {
  mockSlackChannels,
  mockSlackUsers,
  mockSlackMessages,
  mockSlackMessagesResponse,
};
