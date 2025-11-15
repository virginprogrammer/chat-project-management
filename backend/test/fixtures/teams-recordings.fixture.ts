/**
 * Mock Teams recording data for e2e testing
 */

export const mockTeamsRecordings = [
  {
    id: 'recording-001',
    createdDateTime: '2025-01-10T15:00:00Z',
    recordingContentUrl: 'https://graph.microsoft.com/v1.0/recordings/recording-001/$value',
    meetingId: 'meeting-001',
    meetingOrganizer: {
      user: {
        id: 'user-001',
        displayName: 'John Doe',
      },
    },
  },
  {
    id: 'recording-002',
    createdDateTime: '2025-01-11T10:30:00Z',
    recordingContentUrl: 'https://graph.microsoft.com/v1.0/recordings/recording-002/$value',
    meetingId: 'meeting-002',
    meetingOrganizer: {
      user: {
        id: 'user-002',
        displayName: 'Jane Smith',
      },
    },
  },
];

export const mockTeamsMeetings = [
  {
    id: 'meeting-001',
    subject: 'Project Alpha Planning Meeting',
    startDateTime: '2025-01-10T15:00:00Z',
    endDateTime: '2025-01-10T16:00:00Z',
    joinWebUrl: 'https://teams.microsoft.com/l/meetup-join/...',
    organizer: {
      identity: {
        user: {
          id: 'user-001',
          displayName: 'John Doe',
        },
      },
    },
  },
  {
    id: 'meeting-002',
    subject: 'Sprint Review',
    startDateTime: '2025-01-11T10:30:00Z',
    endDateTime: '2025-01-11T11:30:00Z',
    joinWebUrl: 'https://teams.microsoft.com/l/meetup-join/...',
    organizer: {
      identity: {
        user: {
          id: 'user-002',
          displayName: 'Jane Smith',
        },
      },
    },
  },
];

/**
 * Sample transcription text for recording-001
 */
export const mockRecording001Transcription = `
Welcome everyone to the Project Alpha planning meeting. Today we're going to discuss the upcoming sprint tasks.
First item on the agenda is the user authentication feature. John will be working on this.
The deadline for completion is January 15th. We also need to finalize the database schema.
Jane has already completed the initial design which looks great. Let's proceed with implementation.
`.trim();

/**
 * Sample transcription text for recording-002
 */
export const mockRecording002Transcription = `
Good morning team. This is our sprint review meeting. Let's go through what we accomplished this week.
The authentication endpoints are now complete and tested. The frontend integration is in progress.
We identified one blocker related to the OAuth flow that needs to be resolved.
Overall, we're on track to meet our milestone. Next sprint we'll focus on the dashboard features.
`.trim();

/**
 * Mock audio file buffer (minimal WAV file header + silence)
 * This creates a valid but minimal audio file for testing
 */
export function getMockAudioBuffer(): Buffer {
  // Minimal WAV file: 44-byte header + 1 second of silence at 8kHz, 8-bit mono
  const sampleRate = 8000;
  const duration = 1; // 1 second
  const numSamples = sampleRate * duration;
  const dataSize = numSamples;
  const fileSize = 36 + dataSize;

  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(fileSize, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // audio format (1 = PCM)
  buffer.writeUInt16LE(1, 22); // num channels (mono)
  buffer.writeUInt32LE(sampleRate, 24); // sample rate
  buffer.writeUInt32LE(sampleRate, 28); // byte rate
  buffer.writeUInt16LE(1, 32); // block align
  buffer.writeUInt16LE(8, 34); // bits per sample

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Fill with silence (128 = silence for 8-bit audio)
  buffer.fill(128, 44);

  return buffer;
}

export default {
  mockTeamsRecordings,
  mockTeamsMeetings,
  mockRecording001Transcription,
  mockRecording002Transcription,
  getMockAudioBuffer,
};
