# Navi CFCI - Interview Analysis Platform

A microservices-based platform for analyzing and processing interview transcripts, built with FastAPI and Next.js.

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
cp services/interview_analysis/.env.example services/interview_analysis/.env
cp services/sprint1_deprecated/.env.example services/sprint1_deprecated/.env
cp frontend/.env.example frontend/.env

# Edit each .env file with your API keys
# Required: Add your Google Gemini API key to services/interview_analysis/.env
# Required: Add your OpenAI API key to services/sprint1_deprecated/.env
```

3. Run locally with Docker:
```bash
# Start all services using Docker Compose
docker compose up
```

4. Access at:
- Frontend: http://localhost:3000
- API Gateway: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Architecture Overview

This project uses a hybrid approach:
- **Local Development**: Docker Compose for all services (optimized for development)
- **Production**: Google Cloud Run (backend) and Vercel (frontend)

### Components

- **API Gateway**: Routes requests to appropriate microservices
- **Interview Analysis**: Processes interview transcripts using Google's Gemini AI
- **Sprint1 Deprecated**: Legacy functionality for backward compatibility
- **Frontend**: Next.js web application

## Project Structure
```
Navi_CFCI/
├── services/
│   ├── api_gateway/         # API Gateway service (FastAPI)
│   ├── interview_analysis/  # Main analysis service (FastAPI)
│   └── sprint1_deprecated/  # Legacy functionality (FastAPI)
├── frontend/                # Next.js frontend application
├── docker-compose.yml       # Docker compose for local development
├── .env.example             # Root env vars for Docker Compose
└── docs/                    # Project documentation
    ├── project_guide.md     # Main project guide
    ├── architecture.md      # Architecture documentation
    ├── testing.md           # Testing guidelines
    └── deployment.md        # Deployment instructions
```

## Documentation

For detailed information about the project, refer to these guides:

- [Project Guide](docs/project_guide.md) - Main documentation entry point
- [Architecture Guide](docs/architecture.md) - System design and components
- [Development Guide](DEVELOPMENT.md) - Development workflow details
- [Testing Guide](docs/testing.md) - Testing approaches and practices
- [Deployment Guide](docs/deployment.md) - Production deployment instructions

## Key Commands

```bash
# Start all services
docker compose up

# Start services in background
docker compose up -d

# Stop all services
docker compose down

# View logs
docker compose logs -f

# Run tests in containers
docker exec -it navi_cfci-interview_analysis-1 pytest
docker exec -it navi_cfci-frontend-1 npm test
```

## Prerequisites
- Docker and Docker Compose
- Google Gemini API Key (for Interview Analysis service)
- OpenAI API Key (for Sprint1 Deprecated service)
- Python 3.9+ (optional, for local backend development outside Docker)
- Node.js 18+ (optional, for local frontend development outside Docker)

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

For more detailed troubleshooting, see the [Development Guide](DEVELOPMENT.md).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.