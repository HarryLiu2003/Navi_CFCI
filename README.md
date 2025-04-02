# Navi CFCI - Interview Analysis Platform

A microservices-based platform for analyzing and processing interview transcripts, built with FastAPI, Next.js, and Supabase.

## Features

- **Interview Analysis**: Process VTT interview transcripts to extract insights
- **Problem Area Identification**: Automatically identify key issues from interviews
- **User Authentication**: Secure login, registration and personalized dashboards
- **Interactive Visualization**: View analysis results in a user-friendly interface

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
# - Google Gemini API key to services/interview_analysis/.env
# - OpenAI API key to services/sprint1_deprecated/.env
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

## Documentation

For detailed information, refer to:
- [Development Guide](DEVELOPMENT.md) - Local development setup and workflow
- [Project Guide](docs/project_guide.md) - Architecture and service overview
- [Testing Guide](docs/testing.md) - Testing procedures
- [Deployment Guide](docs/deployment.md) - Production deployment
- [Data Storage Guide](docs/data_storage.md) - Database setup and schema

## Key Commands

```bash
# Start services
docker compose up

# Start in background
docker compose up -d

# Stop services
docker compose down

# View logs
docker compose logs -f

# Database commands
cd services/database
npm run migrate:deploy    # Deploy migrations
npm run generate         # Generate Prisma client

# Schema synchronization
npm run sync-schema      # Sync Prisma schema from database to frontend
```

## Prerequisites
- Docker and Docker Compose
- Supabase Account
- Google Gemini API Key
- OpenAI API Key
- Node.js 18+ (optional)
- Python 3.9+ (optional)