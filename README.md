# Navi CFCI - Interview Analysis Platform

A microservices-based platform for analyzing and processing interview transcripts, built with FastAPI, Next.js, and Supabase.

## Features

- **Interview Analysis**: Process VTT interview transcripts to extract insights
- **Problem Area Identification**: Automatically identify key issues from interviews
- **User Authentication**: Secure login, registration and personalized dashboards
- **Interactive Visualization**: View analysis results in a user-friendly interface

## Architecture Overview

Navi CFCI uses a microservices architecture with a hybrid deployment approach:

1. **Local Development**: Docker Compose orchestrates all services (frontend + backend)
2. **Production**: Hybrid deployment with Vercel (frontend) and Google Cloud Run (backend)

The project consists of the following components:
- **Frontend**: Next.js 15.1.7 application with React 18
- **API Gateway**: FastAPI service that routes requests to microservices
- **Interview Analysis**: FastAPI service using Google Gemini AI
- **Sprint1 Deprecated**: Legacy service using OpenAI GPT-4
- **Database**: Prisma ORM with PostgreSQL (Supabase)

## Prerequisites

- Docker and Docker Compose
- Supabase Account
- Google Gemini API Key
- OpenAI API Key
- Node.js 18+ (optional for local development outside Docker)
- Python 3.9+ (optional for local development outside Docker)

## Quick Start 🚀

1. Clone the repository:
```bash
git clone [repository-url]
cd Navi_CFCI
```

2. Set up environment variables:
```bash
# Copy all environment files
cp .env.example .env
cp services/api_gateway/.env.example services/api_gateway/.env
cp services/database/.env.example services/database/.env
cp services/interview_analysis/.env.example services/interview_analysis/.env
cp services/sprint1_deprecated/.env.example services/sprint1_deprecated/.env
cp frontend/.env.example frontend/.env

# Add required API keys:
# - Google Gemini API key to services/interview_analysis/.env (uses Gemini 2.0 Flash)
# - OpenAI API key to services/sprint1_deprecated/.env (uses GPT-4)
# - Add a secure NEXTAUTH_SECRET to frontend/.env
```

3. Set up Supabase:
- See [Data Storage Documentation](docs/data_storage.md) for detailed instructions
- Configure database connection in services/database/.env

4. Initialize the database:
```bash
cd services/database
npm install
npx prisma generate
npx prisma migrate deploy
cd ../..
```

5. Run locally with Docker:
```bash
docker compose up
```

6. Access the application:
- Frontend: http://localhost:3000
- API Documentation: http://localhost:8000/docs

7. Create a user account:
- Visit http://localhost:3000/auth/signin
- Register with your email and password
- Sign in to access the dashboard

## Development Workflows

### Option 1: Full-Stack Development with Docker (Recommended)

For most development tasks, use Docker Compose to run the entire stack:

```bash
docker compose up
```

This will start all services with the following access points:

#### Browser Access (from your computer)
- Frontend: http://localhost:3000
- API Gateway: http://localhost:8000
- API Documentation: http://localhost:8000/docs

#### Service-to-Service Communication (within Docker)
- Database Service: http://database:5001
- Interview Analysis: http://interview_analysis:8001
- Sprint1 Deprecated: http://sprint1_deprecated:8002
- API Gateway: http://api_gateway:8000

Note: You don't need to manually change any URLs when running in Docker. The environment variables and Docker Compose configuration handle the routing automatically.

### Option 2: Frontend-Only Development (Alternative)

If you're only working on the frontend and prefer to run it directly:

```bash
cd frontend
npm install
npm run dev
```

The frontend will connect to the API Gateway at the URL specified in `frontend/.env`.

### Option 3: Backend-Only Development (Alternative)

For backend development without Docker (not recommended):

```bash
# Example for running the interview_analysis service directly
cd services/interview_analysis
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

## Common Development Tasks

### Prisma Schema Synchronization

When updating the database schema:

1. Make changes to `services/database/prisma/schema.prisma` (source of truth)
2. Run migration: `cd services/database && npx prisma migrate dev`
3. Sync schema to frontend: `npm run sync-schema` (from project root)
4. Rebuild frontend: `docker compose build frontend && docker compose up -d frontend`

**IMPORTANT**: Always keep schemas synchronized to avoid runtime errors.

### Adding a New API Endpoint

1. Decide which service should handle the endpoint
2. Add the endpoint in the service's `app/api/routes.py` file
3. Add any necessary services or utilities
4. Update the API Gateway's proxy configuration if needed

### Adding a New Frontend Component

1. Create the component in `frontend/src/components`
2. Use functional React components with TypeScript
3. Add styles using Tailwind CSS
4. Import and use the component where needed

## Useful Commands

```bash
# Start services
docker compose up

# Start in background
docker compose up -d

# Stop services
docker compose down

# View logs for all services
docker compose logs -f

# View logs for a specific service
docker compose logs -f interview_analysis

# Run only specific services
docker compose up api_gateway interview_analysis

# Rebuild containers after dependency changes
docker compose build

# Database commands
cd services/database
npm run migrate:deploy    # Deploy migrations
npm run generate         # Generate Prisma client

# Schema synchronization
npm run sync-schema      # Sync Prisma schema from database to frontend

# Run tests with Docker
docker exec -it navi_cfci-interview_analysis-1 pytest
docker exec -it navi_cfci-frontend-1 npm test
```

## Testing

For testing with Docker (with containers already running):

```bash
# Run all tests for a specific service
docker exec -it navi_cfci-interview_analysis-1 pytest
docker exec -it navi_cfci-frontend-1 npm test

# Run tests with coverage
docker exec -it navi_cfci-interview_analysis-1 pytest --cov=app

# Run frontend end-to-end tests
docker exec -it navi_cfci-frontend-1 npm run cy:run
```

For local testing (without Docker):

```bash
# Run frontend tests
cd frontend
npm test

# Run backend tests for a specific service
cd services/interview_analysis
pytest

# Run tests with coverage
pytest --cov=app

# Run frontend end-to-end tests
cd frontend
npm run cy:open
```

## Troubleshooting

### Common Issues

1. **API Connection Errors**
   - Check that all services are running: `docker compose ps`
   - Verify API Gateway is accessible at http://localhost:8000/docs
   - Check service logs: `docker compose logs api_gateway`

2. **Missing API Keys**
   - Error message: "API key not configured"
   - Solution: Add your API keys to the respective .env files:
     - Gemini API key in `services/interview_analysis/.env`
     - OpenAI API key in `services/sprint1_deprecated/.env`

3. **Docker Container Conflicts**
   - Error: "Port is already allocated"
   - Solution: Stop other containers or change ports in `.env`

4. **Hot Reload Not Working**
   - Check that volume mounts are working correctly
   - Verify that the appropriate development target is used in docker-compose.yml

## Documentation

For detailed information, refer to:
- [Documentation Index](docs/README.md) - Overview of all documentation
- [1. Project Guide](docs/1_project_guide.md) - Architecture and service overview
- [2. Architecture](docs/2_architecture.md) - Detailed system architecture
- [3. Data Storage](docs/3_data_storage.md) - Database setup and schema
- [4. Testing](docs/4_testing.md) - Testing procedures
- [5. Deployment](docs/5_deployment.md) - Production deployment