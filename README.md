# Teams/Slack Project Management System

AI-powered project management system that aggregates chat messages and meeting recordings from Microsoft Teams and Slack, processes them using NLP, and provides a web-based dashboard for tracking project progress.

## Features

- 🔗 **Multi-Platform Integration**: Connect to both Microsoft Teams and Slack
- 🎤 **Audio Transcription**: Automatic conversion of meeting recordings to text with speaker identification
- 🤖 **AI-Powered Analysis**: Extract projects, tasks, deadlines, and requirements from conversations
- 📊 **Real-time Dashboard**: Track project progress, status, and deadlines
- 📅 **Timeline Visualization**: See project evolution through conversations
- 🔍 **Advanced Search**: Full-text search across all messages and transcriptions
- 🔐 **Secure**: OAuth 2.0 authentication, encryption at rest and in transit

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed system architecture and design.

### System Components

- **Data Collection Layer**: Teams & Slack connectors
- **Processing Layer**: Audio transcription and NLP entity extraction
- **Storage Layer**: PostgreSQL, Redis, S3/Blob storage
- **API Layer**: REST/GraphQL backend
- **Frontend Layer**: React web application

## Tech Stack

### Backend
- Node.js 18+ with NestJS
- PostgreSQL 15+
- Redis 7+
- TypeScript

### Frontend
- React 18+
- TypeScript
- Material-UI
- Redux Toolkit

### AI/ML
- Azure Speech Services (speech-to-text)
- OpenAI GPT-4 API (NLP)

## Prerequisites

- Node.js 18.0.0 or higher
- Docker and Docker Compose
- PostgreSQL 15+
- Redis 7+
- Microsoft Azure account (for Teams integration)
- Slack workspace admin access
- OpenAI API key

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd chat-project-management
npm run install:all
```

### 2. Environment Configuration

Create `.env` files in both backend and frontend directories. See `.env.example` files for required variables.

**Backend (.env)**:
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/teams_slack_pm
REDIS_URL=redis://localhost:6379

# Microsoft Teams
TEAMS_CLIENT_ID=your_client_id
TEAMS_CLIENT_SECRET=your_client_secret
TEAMS_TENANT_ID=your_tenant_id

# Slack
SLACK_CLIENT_ID=your_client_id
SLACK_CLIENT_SECRET=your_client_secret
SLACK_SIGNING_SECRET=your_signing_secret

# AI Services
AZURE_SPEECH_KEY=your_key
AZURE_SPEECH_REGION=your_region
OPENAI_API_KEY=your_key

# Storage
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_S3_BUCKET=your_bucket

# JWT
JWT_SECRET=your_jwt_secret
```

### 3. Start Services with Docker

```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Run database migrations
npm run db:migrate
```

### 4. Start Development Servers

```bash
# Start both backend and frontend
npm run dev
```

- Backend API: http://localhost:3000
- Frontend: http://localhost:5173

## Development

### Project Structure

```
.
├── backend/                # NestJS backend application
│   ├── src/
│   │   ├── modules/       # Feature modules
│   │   │   ├── auth/      # Authentication
│   │   │   ├── teams/     # Microsoft Teams integration
│   │   │   ├── slack/     # Slack integration
│   │   │   ├── transcription/  # Audio processing
│   │   │   ├── nlp/       # Natural language processing
│   │   │   ├── projects/  # Project management
│   │   │   └── messages/  # Message handling
│   │   ├── database/      # Database configuration
│   │   └── common/        # Shared utilities
│   └── test/
├── frontend/              # React frontend application
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── store/         # Redux store
│   │   ├── services/      # API services
│   │   └── utils/         # Utilities
│   └── public/
├── docker/                # Docker configurations
├── docs/                  # Additional documentation
└── .github/              # GitHub Actions workflows
```

### Available Scripts

```bash
# Development
npm run dev                 # Start both backend and frontend
npm run dev --workspace=backend   # Start only backend
npm run dev --workspace=frontend  # Start only frontend

# Building
npm run build              # Build both applications

# Testing
npm run test               # Run all tests
npm run test:coverage      # Run tests with coverage

# Linting
npm run lint               # Lint all code
npm run lint:fix           # Fix linting issues

# Database
npm run db:migrate         # Run migrations
npm run db:seed            # Seed database

# Docker
npm run docker:up          # Start Docker services
npm run docker:down        # Stop Docker services
```

## Integration Setup

### Microsoft Teams

1. Register app in Azure Active Directory
2. Configure API permissions:
   - `Chat.Read.All`
   - `OnlineMeetings.Read.All`
   - `CallRecords.Read.All`
3. Add redirect URI: `http://localhost:3000/api/auth/teams/callback`
4. Copy Client ID, Secret, and Tenant ID to `.env`

### Slack

1. Create a Slack app at https://api.slack.com/apps
2. Configure OAuth & Permissions:
   - `channels:history`
   - `channels:read`
   - `files:read`
   - `groups:history`
3. Enable Events API and subscribe to `message` events
4. Add redirect URI: `http://localhost:3000/api/auth/slack/callback`
5. Copy credentials to `.env`

## Deployment

See [docs/deployment.md](./docs/deployment.md) for production deployment instructions.

## Testing

```bash
# Run all tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run specific test suite
npm run test --workspace=backend -- auth
```

## Documentation

- [Architecture](./ARCHITECTURE.md) - System architecture and design
- [API Documentation](./docs/api.md) - API endpoints and usage
- [Database Schema](./docs/database.md) - Database structure
- [Deployment Guide](./docs/deployment.md) - Production deployment
- [Contributing](./docs/contributing.md) - Contribution guidelines

## Security

- OAuth 2.0 for platform integrations
- JWT for API authentication
- Encryption at rest and in transit
- Regular security audits
- GDPR compliant

## Roadmap

- [x] Phase 1: Foundation setup
- [ ] Phase 2: Data collection (Teams/Slack)
- [ ] Phase 3: Audio transcription
- [ ] Phase 4: NLP processing
- [ ] Phase 5: Backend API
- [ ] Phase 6: Frontend dashboard
- [ ] Phase 7: Testing & optimization
- [ ] Phase 8: Production deployment

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](./docs/contributing.md) for details.

## License

MIT

## Support

For issues and questions:
- Create an issue in the GitHub repository
- Check the documentation in the `docs/` directory
