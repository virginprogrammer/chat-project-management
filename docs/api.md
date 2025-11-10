# API Documentation

Base URL: `http://localhost:3000/api` (development)

Interactive API documentation is available at `/api/docs` when the backend is running.

## Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Endpoints

### Health & Status

#### GET /
Health check endpoint

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-10T12:00:00.000Z",
  "service": "teams-slack-project-manager"
}
```

#### GET /status
System status endpoint

**Response:**
```json
{
  "status": "operational",
  "version": "1.0.0",
  "uptime": 12345,
  "memory": {...},
  "environment": "development"
}
```

### Projects

#### GET /projects
Get all projects

**Query Parameters:**
- `status` (optional): Filter by status (planning, in-progress, completed, on-hold)
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Pagination offset

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Project Name",
    "description": "Project description",
    "status": "in-progress",
    "deadline": "2024-12-31T00:00:00.000Z",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-10T00:00:00.000Z"
  }
]
```

#### GET /projects/:id
Get project by ID

**Response:**
```json
{
  "id": "uuid",
  "name": "Project Name",
  "description": "Project description",
  "status": "in-progress",
  "deadline": "2024-12-31T00:00:00.000Z",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-10T00:00:00.000Z"
}
```

#### POST /projects
Create a new project

**Request Body:**
```json
{
  "name": "New Project",
  "description": "Project description",
  "status": "planning",
  "deadline": "2024-12-31T00:00:00.000Z"
}
```

#### PUT /projects/:id
Update a project

**Request Body:**
```json
{
  "name": "Updated Project Name",
  "status": "in-progress",
  "deadline": "2024-12-31T00:00:00.000Z"
}
```

#### DELETE /projects/:id
Delete a project

#### GET /projects/:id/timeline
Get project timeline events

**Response:**
```json
[
  {
    "id": "uuid",
    "projectId": "uuid",
    "eventType": "status_change",
    "description": "Status changed to in-progress",
    "timestamp": "2024-01-10T00:00:00.000Z",
    "sourceMessageId": "uuid"
  }
]
```

#### GET /projects/:id/tasks
Get project tasks

**Response:**
```json
[
  {
    "id": "uuid",
    "projectId": "uuid",
    "title": "Task title",
    "description": "Task description",
    "assignee": "John Doe",
    "status": "todo",
    "priority": "high",
    "dueDate": "2024-01-15T00:00:00.000Z"
  }
]
```

#### GET /projects/:id/requirements
Get project requirements

### Messages

#### GET /messages
Get messages

**Query Parameters:**
- `projectId` (optional): Filter by project
- `source` (optional): Filter by source (teams, slack)
- `channelId` (optional): Filter by channel
- `startDate` (optional): Filter by date range start
- `endDate` (optional): Filter by date range end
- `limit` (optional): Number of results
- `offset` (optional): Pagination offset

**Response:**
```json
[
  {
    "id": "uuid",
    "source": "teams",
    "sourceId": "message-id",
    "channelId": "channel-id",
    "channelName": "General",
    "authorId": "user-id",
    "authorName": "John Doe",
    "content": "Message content",
    "messageType": "chat",
    "timestamp": "2024-01-10T12:00:00.000Z",
    "projectId": "uuid"
  }
]
```

#### GET /messages/:id
Get message by ID

#### POST /messages/search
Search messages

**Request Body:**
```json
{
  "query": "search term",
  "projectId": "uuid",
  "source": "teams",
  "startDate": "2024-01-01T00:00:00.000Z",
  "endDate": "2024-01-31T00:00:00.000Z"
}
```

### Recordings & Transcriptions

#### GET /recordings
Get audio recordings

**Query Parameters:**
- `status` (optional): Filter by transcription status
- `source` (optional): Filter by source

**Response:**
```json
[
  {
    "id": "uuid",
    "source": "teams",
    "sourceId": "meeting-id",
    "meetingTitle": "Weekly Standup",
    "fileUrl": "https://...",
    "storagePath": "s3://...",
    "durationSeconds": 3600,
    "transcriptionStatus": "completed",
    "timestamp": "2024-01-10T12:00:00.000Z"
  }
]
```

#### GET /recordings/:id/transcription
Get transcription for a recording

**Response:**
```json
{
  "id": "uuid",
  "audioRecordingId": "uuid",
  "content": "Full transcription text...",
  "speakers": [
    {
      "name": "Speaker 1",
      "segments": [
        {
          "start": 0,
          "end": 10,
          "text": "Hello everyone"
        }
      ]
    }
  ],
  "language": "en",
  "confidenceScore": 0.95
}
```

#### POST /recordings/:id/retranscribe
Retry transcription for a recording

### Analytics

#### GET /analytics/project/:id
Get analytics for a project

**Response:**
```json
{
  "projectId": "uuid",
  "messageCount": 150,
  "meetingCount": 5,
  "taskCount": 12,
  "completedTasks": 8,
  "requirementCount": 20,
  "activeParticipants": 6,
  "activityByDay": {...}
}
```

#### GET /analytics/deadlines
Get upcoming deadlines across all projects

**Response:**
```json
[
  {
    "projectId": "uuid",
    "projectName": "Project Name",
    "deadline": "2024-01-15T00:00:00.000Z",
    "daysRemaining": 5,
    "status": "in-progress"
  }
]
```

#### GET /analytics/team-activity
Get team activity statistics

### Authentication (Future Implementation)

#### POST /auth/login
Login with email and password

#### POST /auth/register
Register new user

#### POST /auth/teams/oauth
Initiate Teams OAuth flow

#### GET /auth/teams/callback
Teams OAuth callback

#### POST /auth/slack/oauth
Initiate Slack OAuth flow

#### GET /auth/slack/callback
Slack OAuth callback

### Webhooks

#### POST /webhooks/teams
Microsoft Teams webhook endpoint (internal)

#### POST /webhooks/slack
Slack Events API webhook endpoint (internal)

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [...]
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

## Rate Limiting

API requests are rate limited to:
- 100 requests per minute per IP (unauthenticated)
- 1000 requests per minute per user (authenticated)

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1641811200
```

## Pagination

List endpoints support pagination:

**Query Parameters:**
- `limit`: Number of items per page (default: 50, max: 100)
- `offset`: Number of items to skip

**Response Headers:**
```
X-Total-Count: 500
Link: </api/projects?offset=50&limit=50>; rel="next"
```

## WebSocket Events (Future)

Real-time updates will be available via WebSocket connection:

```javascript
const socket = io('http://localhost:3000', {
  auth: { token: 'your-jwt-token' }
});

socket.on('project:updated', (data) => {
  console.log('Project updated:', data);
});

socket.on('message:new', (data) => {
  console.log('New message:', data);
});
```
