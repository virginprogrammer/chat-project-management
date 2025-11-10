# Deployment Guide

This guide covers deploying the Teams/Slack Project Manager application to production.

## Prerequisites

- Docker and Docker Compose installed
- PostgreSQL 15+ database
- Redis 7+ cache server
- Azure account (for Teams integration and Speech Services)
- Slack workspace admin access
- OpenAI API key
- AWS S3 or Azure Blob Storage account

## Environment Variables

### Backend Environment Variables

Create a `.env` file in the `backend` directory with the following variables:

```env
# Application
NODE_ENV=production
PORT=3000
APP_URL=https://your-api-domain.com
FRONTEND_URL=https://your-frontend-domain.com

# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Redis
REDIS_URL=redis://host:6379

# JWT
JWT_SECRET=your-secure-random-secret
JWT_EXPIRATION=7d

# Microsoft Teams
TEAMS_CLIENT_ID=your_client_id
TEAMS_CLIENT_SECRET=your_client_secret
TEAMS_TENANT_ID=your_tenant_id
TEAMS_REDIRECT_URI=https://your-api-domain.com/api/auth/teams/callback

# Slack
SLACK_CLIENT_ID=your_client_id
SLACK_CLIENT_SECRET=your_client_secret
SLACK_SIGNING_SECRET=your_signing_secret
SLACK_REDIRECT_URI=https://your-api-domain.com/api/auth/slack/callback

# Azure Speech Services
AZURE_SPEECH_KEY=your_key
AZURE_SPEECH_REGION=your_region

# OpenAI
OPENAI_API_KEY=your_key
OPENAI_MODEL=gpt-4

# AWS S3
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_S3_BUCKET=your_bucket
AWS_REGION=us-east-1
```

### Frontend Environment Variables

Create a `.env.production` file in the `frontend` directory:

```env
VITE_API_URL=https://your-api-domain.com/api
VITE_APP_NAME=Teams/Slack Project Manager
```

## Deployment Options

### Option 1: Docker Compose (Recommended for Single Server)

1. **Prepare the server**
   ```bash
   # Install Docker and Docker Compose
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh
   ```

2. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd chat-project-management
   ```

3. **Configure environment variables**
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env.production
   # Edit the files with your production values
   ```

4. **Update docker-compose.yml**
   - Uncomment the backend and frontend services
   - Update environment variables

5. **Deploy**
   ```bash
   docker-compose up -d
   ```

6. **Run database migrations**
   ```bash
   docker-compose exec backend npm run migrate:deploy
   ```

7. **Set up reverse proxy (Nginx)**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       return 301 https://$server_name$request_uri;
   }

   server {
       listen 443 ssl http2;
       server_name your-domain.com;

       ssl_certificate /path/to/cert.pem;
       ssl_certificate_key /path/to/key.pem;

       location / {
           proxy_pass http://localhost:5173;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }

       location /api {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

### Option 2: Kubernetes

1. **Create Kubernetes manifests**
   - See `k8s/` directory for example manifests

2. **Deploy to cluster**
   ```bash
   kubectl apply -f k8s/
   ```

### Option 3: Cloud Platform Specific

#### AWS

**Backend (ECS with Fargate)**
1. Build and push Docker image to ECR
2. Create ECS task definition
3. Create ECS service
4. Configure Application Load Balancer

**Frontend (S3 + CloudFront)**
1. Build frontend: `npm run build`
2. Upload to S3
3. Configure CloudFront distribution

**Database**
- Use RDS for PostgreSQL
- Use ElastiCache for Redis

#### Azure

**Backend (App Service)**
1. Create App Service plan
2. Deploy from Docker image or Git
3. Configure environment variables

**Frontend (Static Web Apps)**
1. Build and deploy to Azure Static Web Apps
2. Configure API integration

**Database**
- Use Azure Database for PostgreSQL
- Use Azure Cache for Redis

#### Google Cloud

**Backend (Cloud Run)**
1. Build and push to Container Registry
2. Deploy to Cloud Run
3. Configure environment variables

**Frontend (Firebase Hosting or Cloud Storage)**
1. Build frontend
2. Deploy to Firebase Hosting or Cloud Storage + Cloud CDN

**Database**
- Use Cloud SQL for PostgreSQL
- Use Memorystore for Redis

## Database Migration

Always run migrations before deploying new code:

```bash
# Development
npm run migrate

# Production (in backend directory)
npx prisma migrate deploy
```

## Health Checks

The application provides health check endpoints:

- Backend: `GET /api` - Returns application status
- Backend: `GET /api/status` - Returns detailed system status

Configure your load balancer or orchestrator to use these endpoints.

## Monitoring

### Recommended Tools

- **Application Monitoring**: New Relic, Datadog, or Application Insights
- **Logging**: ELK Stack (Elasticsearch, Logstash, Kibana) or CloudWatch
- **Metrics**: Prometheus + Grafana
- **Error Tracking**: Sentry

### Key Metrics to Monitor

- API response times
- Database query performance
- Redis cache hit rate
- Transcription job success rate
- NLP processing time
- Memory usage
- CPU usage
- Disk space

## Backup Strategy

### Database Backups

1. **Automated daily backups**
   ```bash
   # PostgreSQL backup script
   pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql
   ```

2. **Upload to S3/Azure Blob**
   ```bash
   aws s3 cp backup-*.sql s3://your-backup-bucket/
   ```

3. **Retention policy**: Keep daily backups for 30 days, weekly for 3 months

### Audio Files Backup

- S3/Azure Blob already provides durability
- Enable versioning on storage bucket
- Set up lifecycle policies

## Security Checklist

- [ ] Use HTTPS for all communication
- [ ] Set strong JWT secret
- [ ] Enable database SSL connection
- [ ] Restrict database access to application only
- [ ] Use environment variables for secrets (never commit)
- [ ] Enable CORS only for your frontend domain
- [ ] Set up rate limiting
- [ ] Configure firewall rules
- [ ] Enable security headers
- [ ] Regular security updates
- [ ] Implement audit logging
- [ ] Use secrets management (AWS Secrets Manager, Azure Key Vault)

## Scaling Considerations

### Horizontal Scaling

- Backend: Multiple instances behind load balancer
- Background jobs: Multiple worker instances
- Redis: Cluster mode for high availability

### Vertical Scaling

- Increase server resources based on load
- Monitor and adjust as needed

### Database Scaling

- Read replicas for read-heavy operations
- Connection pooling
- Query optimization
- Partitioning for large tables

## Troubleshooting

### Backend won't start

1. Check environment variables
2. Verify database connection
3. Check logs: `docker-compose logs backend`

### Frontend can't connect to backend

1. Verify CORS settings
2. Check API_URL in frontend environment
3. Verify network/firewall rules

### Database migration fails

1. Check database connection
2. Verify migration files
3. Run migrations manually: `npx prisma migrate resolve --applied <migration_name>`

### Transcription jobs failing

1. Check Azure Speech Services credentials
2. Verify audio file format
3. Check Redis connection
4. Review job queue status

## Rollback Procedure

1. **Identify the issue**
2. **Rollback to previous version**
   ```bash
   # Docker
   docker-compose down
   git checkout <previous-commit>
   docker-compose up -d
   ```

3. **Or use tagged version**
   ```bash
   docker pull your-registry/backend:v1.0.0
   docker pull your-registry/frontend:v1.0.0
   ```

4. **Run database rollback if needed**
   ```bash
   npx prisma migrate resolve --rolled-back <migration_name>
   ```

## CI/CD Integration

The project includes GitHub Actions workflows:

- `.github/workflows/ci.yml` - Runs tests on PR/push
- `.github/workflows/deploy.yml` - Deploys to production

Configure secrets in GitHub repository settings:
- Docker registry credentials
- Cloud provider credentials
- Environment variables

## Support

For deployment issues:
1. Check application logs
2. Review this documentation
3. Check GitHub Issues
4. Contact support team
