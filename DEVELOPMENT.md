# Developer Guide for Navi CFCI

This document explains the development workflow and architecture of the Navi CFCI platform.

## Development Philosophy

The project uses two different approaches for development and production:

1. **Local Development**: Docker Compose orchestrates all services (frontend + backend)
2. **Production**: Hybrid deployment with Vercel (frontend) and Google Cloud Run (backend)

This hybrid approach gives us the best of both worlds:
- Simple local development where everything runs together
- Optimized production deployment using specialized platforms

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

# Rebuild containers after dependency changes
docker compose build
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