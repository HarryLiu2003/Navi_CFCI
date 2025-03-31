# Developer Guide for Navi CFCI

This document explains the development workflow and architecture of the Navi CFCI platform.

## Development Philosophy

The project uses two different approaches for development and production:

1. **Local Development**: Docker Compose orchestrates all services (frontend + backend)
2. **Production**: Hybrid deployment with Vercel (frontend) and Google Cloud Run (backend)

This hybrid approach gives us the best of both worlds:
- Simple local development where everything runs together
- Optimized production deployment using specialized platforms

## Getting Started

### Prerequisites

- Docker and Docker Compose (for local development)
- Google Gemini API Key (for Interview Analysis service)
- OpenAI API Key (for Sprint1 Deprecated service)
- Node.js 18+ (optional, for frontend-only development)
- Python 3.9+ (optional, for backend-only development)

### Initial Setup

```bash
# Clone the repository
git clone [repository-url]
cd Navi_CFCI

# Set up environment variables
cp .env.example .env
cp services/api_gateway/.env.example services/api_gateway/.env
cp services/interview_analysis/.env.example services/interview_analysis/.env
cp services/sprint1_deprecated/.env.example services/sprint1_deprecated/.env
cp frontend/.env.example frontend/.env

# Configure your API keys and other settings in each .env file
# Required: Add your Google Gemini API key to services/interview_analysis/.env
# Required: Add your OpenAI API key to services/sprint1_deprecated/.env
```

## Development Workflows

### Option 1: Full-Stack Development with Docker (Recommended)

For most development tasks, use Docker Compose to run the entire stack:

```bash
# Start all services with hot reload
docker compose up
```

This will start:
- Frontend (Next.js) on port 3000
- API Gateway on port 8000
- Interview Analysis service on port 8001
- Sprint1 Deprecated service on port 8002

Any code changes will trigger hot reloading.

### Useful Docker Commands

```bash
# Start services in background
docker compose up -d

# Stop all services
docker compose down

# View logs for all services
docker compose logs -f

# View logs for a specific service
docker compose logs -f interview_analysis

# Run only specific services
docker compose up api_gateway interview_analysis
```

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

## Environment Variables

The project uses multiple `.env` files for configuration:

### Root `.env` (Docker Compose Configuration)

```
# Service Ports
API_GATEWAY_PORT=8000
INTERVIEW_ANALYSIS_PORT=8001
SPRINT1_DEPRECATED_PORT=8002
FRONTEND_PORT=3000
```

### API Gateway Service `.env`

```
# Service Configuration
SERVICE_INTERVIEW_ANALYSIS=http://interview_analysis:8001
SERVICE_SPRINT1_DEPRECATED=http://sprint1_deprecated:8002

# CORS Settings
CORS_ORIGINS=http://localhost:3000
```

### Interview Analysis Service `.env`

```
# API Keys
GEMINI_API_KEY=your-gemini-api-key-here

# Service Configuration
MODEL_NAME=gemini-pro
MAX_TOKENS=8192
```

### Sprint1 Deprecated Service `.env`

```
# API Keys
OPENAI_API_KEY=your-openai-api-key-here

# Service Configuration
MODEL_NAME=gpt-3.5-turbo
```

### Frontend `.env`

```
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_ENV=development
```

## Testing

For testing with Docker (with containers already running):

```bash
# Run all tests for a specific service
docker exec -it navi_cfci-interview_analysis-1 pytest
docker exec -it navi_cfci-frontend-1 npm test

# Run frontend tests
docker exec -it navi_cfci-frontend-1 npm test

# Run backend tests for a specific service
docker exec -it navi_cfci-interview_analysis-1 pytest

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

For detailed testing information, see [Testing Guide](docs/testing.md).

## Common Development Tasks

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

### Working with Docker

#### Rebuilding Containers

If you update dependencies (package.json, requirements.txt):

```bash
# Rebuild a specific service
docker compose build interview_analysis

# Rebuild all services
docker compose build
```

#### Accessing Container Shell

```bash
# Access shell in a running container
docker exec -it navi_cfci-interview_analysis-1 bash
```

## Deployment

For production deployment instructions, see [Deployment Guide](docs/deployment.md) 