# Navi CFCI Project Guide

Welcome to the Navi CFCI project! This guide serves as the central entry point for developers.

## Project Overview

Navi CFCI is an interview analysis platform that processes interview transcripts to extract insights using AI. The platform:

- Analyzes interview transcripts using Google's Gemini AI
- Identifies key themes, pain points, and insights
- Visualizes findings for product and UX teams
- Provides user authentication and personalized dashboards

## Architecture

### Service Dependencies

The Navi CFCI project consists of multiple microservices with the following dependencies:

```
         +------------+
         |            |
         |  Frontend  |
         |            |
         +-----+------+
               |
               v
        +------+-------+
        |              |
        | API Gateway  |
        |              |
        +------+-------+
               |
       +-------+--------+
       |                |
+------v------+  +------v------+
|             |  |             |
| Interview   |  | Sprint1     |
| Analysis    |  | Deprecated  |
|             |  |             |
+------+------+  +-------------+
       |
       v
+------+------+
|             |
| Database    |
| Service     |
|             |
+-------------+
```

### Components

- **Frontend**: Next.js application with NextAuth.js for authentication
- **API Gateway**: Routes requests to the appropriate backend service
- **Interview Analysis**: Provides transcript analysis with Gemini AI
- **Sprint1 Deprecated**: Legacy functionality for backward compatibility
- **Database Service**: Handles data persistence and provides Prisma ORM access

### Authentication System

The platform uses NextAuth.js integrated directly in the frontend:

- **Authentication Flow**: Email/password login with JWT token-based sessions
- **User Management**: Registration, login, and session persistence
- **Security**: Passwords hashed with PBKDF2 (SHA-512, 100k iterations)
- **Route Protection**: Middleware-based access control for authenticated routes
- **Database Integration**: Users and sessions stored in PostgreSQL via Prisma

### Deployment Architecture

#### Development Environment
- All services run in Docker containers
- Frontend connects to both API Gateway and Database Service
- Database Service connects to PostgreSQL container
- **URL Configuration**:
  - Browser access uses `localhost` ports (e.g., http://localhost:3000)
  - Service-to-service communication uses Docker service names (e.g., http://database:5001)
  - Environment variables handle the routing automatically

#### Production Environment
- Frontend deployed to Vercel
- Backend services deployed to Google Cloud Run
- Database Service deployed as a separate service on Cloud Run
- PostgreSQL hosted as a managed service (Cloud SQL or Supabase)

## Environment Variables

Critical environment variables needed for each service:

- **Root .env**: Docker Compose port configuration
  ```
  API_GATEWAY_PORT=8000
  INTERVIEW_ANALYSIS_PORT=8001
  SPRINT1_DEPRECATED_PORT=8002
  FRONTEND_PORT=3000
  ```

- **Frontend**: Authentication configuration
  ```
  NEXTAUTH_URL=http://localhost:3000
  NEXTAUTH_SECRET=your-secure-secret-key
  DATABASE_URL=postgresql://username:password@host:port/database
  ```

- **Interview Analysis**: Requires Google Gemini API key
  ```
  GEMINI_API_KEY=your-api-key-here
  ```

- **Sprint1 Deprecated**: Requires OpenAI API key
  ```
  OPENAI_API_KEY=your-api-key-here
  ```

## Documentation Structure

Our documentation is organized into focused guides for different aspects of the project:

1. [**Development Guide**](../DEVELOPMENT.md) - Local development workflow and environment setup
2. [**Testing Guide**](testing.md) - Testing approaches and practices
3. [**Deployment Guide**](deployment.md) - Production deployment instructions
4. [**Data Storage Guide**](data_storage.md) - Data storage best practices and authentication schema

### Documentation Flow

- Start with this Project Guide for an overview
- Use the Development Guide for day-to-day development tasks
- Consult the Testing Guide when writing or running tests
- Reference the Deployment Guide when ready to deploy
- Check the Data Storage Guide for database schema and authentication details

## Development Workflow

We follow a straightforward GitHub workflow:

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make changes and test locally
3. Commit with descriptive messages
4. Push your branch and open a pull request
5. After review, merge to main

## Need Help?

For a small team working on a passion project, communication is key:
- **Questions?** Open a GitHub issue with the "question" label
- **Bugs?** Report with detailed reproduction steps
- **Ideas?** Start a discussion in the issues with the "enhancement" label 