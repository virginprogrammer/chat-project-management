# Getting Started

Quick start guide for the Teams/Slack Project Manager application.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** 18.0.0 or higher
- **npm** 9.0.0 or higher
- **Docker** and **Docker Compose**
- **Git**

## Quick Start (Development)

### 1. Clone the Repository

```bash
git clone <repository-url>
cd chat-project-management
```

### 2. Install Dependencies

```bash
npm run install:all
```

This will install dependencies for both backend and frontend.

### 3. Start Database Services

```bash
npm run docker:up
```

This starts PostgreSQL and Redis using Docker Compose.

### 4. Configure Environment Variables

**Backend:**
```bash
cd backend
cp .env.example .env
# Edit .env with your configuration (you can use defaults for local development)
```

**Frontend:**
```bash
cd frontend
cp .env.example .env
# Edit .env if needed (defaults work for local development)
```

### 5. Set Up Database

```bash
cd backend
npx prisma generate
npx prisma migrate dev
```

### 6. Start Development Servers

**Option A: Start both backend and frontend together**
```bash
# From project root
npm run dev
```

**Option B: Start separately**
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### 7. Access the Application

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3000/api
- **API Documentation:** http://localhost:3000/api/docs

## Project Structure

```
chat-project-management/
├── backend/              # NestJS backend application
│   ├── prisma/          # Database schema and migrations
│   ├── src/
│   │   ├── modules/     # Feature modules
│   │   │   ├── auth/
│   │   │   ├── teams/
│   │   │   ├── slack/
│   │   │   ├── transcription/
│   │   │   ├── nlp/
│   │   │   ├── projects/
│   │   │   └── messages/
│   │   ├── database/    # Database configuration
│   │   └── common/      # Shared utilities
│   └── test/
├── frontend/            # React frontend application
│   ├── src/
│   │   ├── components/  # Reusable components
│   │   ├── pages/       # Page components
│   │   ├── store/       # Redux store
│   │   ├── services/    # API services
│   │   └── utils/       # Utilities
│   └── public/
├── docker/              # Docker configurations
├── docs/                # Documentation
└── .github/             # GitHub Actions workflows
```

## Available Scripts

### Root Level

```bash
npm run install:all      # Install all dependencies
npm run dev             # Start both backend and frontend
npm run build           # Build both applications
npm run test            # Run all tests
npm run lint            # Lint all code
npm run docker:up       # Start Docker services
npm run docker:down     # Stop Docker services
```

### Backend

```bash
npm run dev             # Start development server
npm run build           # Build for production
npm run start:prod      # Start production server
npm run test            # Run tests
npm run lint            # Lint code
npm run migrate         # Run database migrations
npm run prisma:studio   # Open Prisma Studio
```

### Frontend

```bash
npm run dev             # Start development server
npm run build           # Build for production
npm run preview         # Preview production build
npm run test            # Run tests
npm run lint            # Lint code
```

## Next Steps

### 1. Configure Integrations

To connect with Microsoft Teams and Slack, you'll need to:

**Microsoft Teams:**
1. Register an app in Azure Active Directory
2. Configure API permissions
3. Add credentials to `backend/.env`

**Slack:**
1. Create a Slack app
2. Configure OAuth & Permissions
3. Add credentials to `backend/.env`

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed integration setup.

### 2. Set Up AI Services

**Azure Speech Services (for transcription):**
1. Create Azure Speech resource
2. Add credentials to `backend/.env`

**OpenAI (for NLP):**
1. Get OpenAI API key
2. Add to `backend/.env`

### 3. Configure Storage

**AWS S3 (for audio files):**
1. Create S3 bucket
2. Create IAM user with S3 access
3. Add credentials to `backend/.env`

## Development Workflow

### Making Changes

1. Create a new branch
   ```bash
   git checkout -b feature/your-feature
   ```

2. Make your changes

3. Test your changes
   ```bash
   npm run test
   npm run lint
   ```

4. Commit and push
   ```bash
   git add .
   git commit -m "Your commit message"
   git push origin feature/your-feature
   ```

5. Create a pull request

### Database Changes

When you modify the Prisma schema:

1. Update `backend/prisma/schema.prisma`

2. Create migration
   ```bash
   cd backend
   npx prisma migrate dev --name your_migration_name
   ```

3. Generate Prisma Client
   ```bash
   npx prisma generate
   ```

## Troubleshooting

### Port Already in Use

If you get port already in use errors:

```bash
# Find process using port 3000 (backend)
lsof -i :3000
kill -9 <PID>

# Find process using port 5173 (frontend)
lsof -i :5173
kill -9 <PID>
```

### Database Connection Issues

1. Ensure Docker services are running:
   ```bash
   docker-compose ps
   ```

2. Check database URL in `backend/.env`

3. Reset database:
   ```bash
   cd backend
   npx prisma migrate reset
   ```

### Module Not Found Errors

```bash
# Clean install
rm -rf node_modules backend/node_modules frontend/node_modules
npm run install:all
```

### Prisma Issues

```bash
cd backend
npx prisma generate
npx prisma migrate dev
```

## Common Tasks

### Reset Database

```bash
cd backend
npx prisma migrate reset
```

### View Database

```bash
cd backend
npx prisma studio
```

This opens a GUI at http://localhost:5555

### Clear Redis Cache

```bash
docker-compose exec redis redis-cli FLUSHALL
```

## Resources

- [Full Architecture](./ARCHITECTURE.md)
- [API Documentation](./docs/api.md)
- [Deployment Guide](./docs/deployment.md)
- [NestJS Documentation](https://docs.nestjs.com/)
- [React Documentation](https://react.dev/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Material-UI Documentation](https://mui.com/)

## Getting Help

If you encounter issues:

1. Check the documentation in the `docs/` directory
2. Review existing GitHub issues
3. Create a new issue with:
   - Description of the problem
   - Steps to reproduce
   - Error messages
   - Environment details

## What's Next?

Now that you have the foundation set up, the next phases are:

- **Phase 2:** Implement Teams & Slack connectors
- **Phase 3:** Add audio transcription
- **Phase 4:** Integrate NLP for entity extraction
- **Phase 5:** Complete backend API
- **Phase 6:** Build frontend dashboard
- **Phase 7:** Testing and optimization
- **Phase 8:** Production deployment

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the complete roadmap.
