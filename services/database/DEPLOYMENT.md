# Database Service Deployment Guide

This guide provides instructions for deploying the database service in both development and production environments.

## Development Environment (Docker)

In development, the database service runs in a Docker container using docker-compose.

### Prerequisites

- Docker and Docker Compose installed
- Node.js 18+ (for local development outside Docker)

### Running with Docker Compose

From the project root:

```bash
docker-compose up
```

This starts all services, including:
- PostgreSQL database
- Database service on port 5001
- Other backend services
- Frontend on port 3000

### Environment Variables

Key environment variables for development:
- `DATABASE_URL` - PostgreSQL connection string
- `PORT` - Port for the database service (default: 5001)

## Production Environment (Google Cloud Run)

For production, deploy the database service to Google Cloud Run.

### Prerequisites

- Google Cloud SDK installed and configured
- Access to Google Cloud Run and Cloud SQL (or other PostgreSQL provider)
- Production PostgreSQL instance ready

### Deployment Steps

1. **Build and deploy to Cloud Run**:

```bash
# Navigate to the database service directory
cd services/database

# Build the container
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/database-service .

# Deploy to Cloud Run
gcloud run deploy database-service \
  --image gcr.io/YOUR_PROJECT_ID/database-service \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="DATABASE_URL=postgresql://username:password@host:port/database"
```

2. **Update CORS configuration**:

Before deployment, update the allowed origins in `src/api/server.ts`:

```javascript
const allowedOrigins = [
  // Development origins remain for testing
  'http://localhost:3000',
  
  // Add your production domains
  'https://your-frontend-app.vercel.app',
  'https://your-api-gateway-xxxx-uc.a.run.app'
];
```

3. **Configure other services**:

Update the `DATABASE_API_URL` in other services to point to your deployed database service:

```
DATABASE_API_URL=https://database-service-xxxx-uc.a.run.app
```

### Security Considerations

1. **Database Connection Security**:
   - Use Cloud SQL Auth Proxy for secure connections
   - Enable SSL for database connections
   - Store credentials in Secret Manager

2. **API Security**:
   - Add authentication to the database service
   - Consider removing `--allow-unauthenticated` and use service-to-service authentication
   - Implement API rate limiting

3. **Network Security**:
   - Use VPC Serverless Connector for private networking
   - Configure firewall rules appropriately
   - Consider VPC Service Controls for additional isolation

## Troubleshooting

### Common Issues

1. **CORS Errors**:
   - Verify the allowed origins include your frontend domain
   - Check that the request includes the correct origin header
   - Ensure credentials mode is properly configured

2. **Connection Issues**:
   - Verify the `DATABASE_URL` environment variable is correctly set
   - Check network connectivity to PostgreSQL
   - Verify PostgreSQL user permissions

3. **Deployment Failures**:
   - Check build logs for errors
   - Verify Cloud Run service account permissions
   - Check resource limits (memory/CPU) 