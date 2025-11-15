/**
 * Mock Slack audio file data for e2e testing
 */

export const mockSlackAudioFiles = [
  {
    id: 'F12345ABCD',
    created: 1736510400,
    timestamp: 1736510400,
    name: 'team-standup-recording.mp3',
    title: 'Team Standup Recording',
    mimetype: 'audio/mpeg',
    filetype: 'mp3',
    pretty_type: 'MP3',
    user: 'U12345678',
    editable: false,
    size: 256000,
    mode: 'hosted',
    is_external: false,
    external_type: '',
    is_public: true,
    public_url_shared: false,
    display_as_bot: false,
    username: '',
    url_private: 'https://files.slack.com/files-pri/T12345678-F12345ABCD/team-standup-recording.mp3',
    url_private_download: 'https://files.slack.com/files-pri/T12345678-F12345ABCD/download/team-standup-recording.mp3',
    permalink: 'https://workspace.slack.com/files/U12345678/F12345ABCD/team-standup-recording.mp3',
    permalink_public: '',
    channels: ['C23456789'],
    groups: [],
    ims: [],
    comments_count: 0,
  },
  {
    id: 'F67890WXYZ',
    created: 1736596800,
    timestamp: 1736596800,
    name: 'client-meeting-audio.mp3',
    title: 'Client Meeting Recording',
    mimetype: 'audio/mpeg',
    filetype: 'mp3',
    pretty_type: 'MP3',
    user: 'U87654321',
    editable: false,
    size: 512000,
    mode: 'hosted',
    is_external: false,
    external_type: '',
    is_public: false,
    public_url_shared: false,
    display_as_bot: false,
    username: '',
    url_private: 'https://files.slack.com/files-pri/T12345678-F67890WXYZ/client-meeting-audio.mp3',
    url_private_download: 'https://files.slack.com/files-pri/T12345678-F67890WXYZ/download/client-meeting-audio.mp3',
    permalink: 'https://workspace.slack.com/files/U87654321/F67890WXYZ/client-meeting-audio.mp3',
    permalink_public: '',
    channels: ['C23456789'],
    groups: [],
    ims: [],
    comments_count: 2,
  },
];

export const mockSlackFilesListResponse = {
  ok: true,
  files: mockSlackAudioFiles,
  paging: {
    count: 100,
    total: 2,
    page: 1,
    pages: 1,
  },
};

/**
 * Sample transcription text for team standup recording
 */
export const mockSlackRecording001Transcription = `
Good morning everyone. Let's start our daily standup. Alice, what did you work on yesterday?
I completed the API integration for the user profile feature. Today I'll be working on the frontend components.
Great. Bob, your update? I finished the database migrations and started on the caching layer.
The caching implementation should be done by end of day. Any blockers? No blockers at the moment.
`.trim();

/**
 * Sample transcription text for client meeting
 */
export const mockSlackRecording002Transcription = `
Thank you for joining this meeting. We wanted to discuss the new feature requirements for the dashboard.
The client needs real-time data visualization and export capabilities. We estimate this will take two sprints.
The first sprint will focus on the real-time updates, and the second will add export functionality.
Are there any questions about the timeline? No, that sounds reasonable. Let's proceed with the plan.
`.trim();

/**
 * Mock MP3 audio file buffer
 * Creates a minimal valid MP3 file for testing
 */
export function getMockMP3Buffer(): Buffer {
  // Minimal MP3 file with ID3v2 header + one silent frame
  const header = Buffer.from([
    // ID3v2 header
    0x49, 0x44, 0x33, // "ID3"
    0x03, 0x00, // version
    0x00, // flags
    0x00, 0x00, 0x00, 0x00, // size (syncsafe integer)
  ]);

  // Minimal MP3 frame (silent)
  const frame = Buffer.from([
    0xff, 0xfb, // sync word + MPEG version + Layer
    0x90, 0x00, // bitrate + sample rate + padding
    // Additional padding to make it a valid frame
    ...new Array(100).fill(0x00),
  ]);

  return Buffer.concat([header, frame]);
}

export default {
  mockSlackAudioFiles,
  mockSlackFilesListResponse,
  mockSlackRecording001Transcription,
  mockSlackRecording002Transcription,
  getMockMP3Buffer,
};
