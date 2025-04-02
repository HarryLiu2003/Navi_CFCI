# Navi CFCI Database Service

This service provides a centralized database layer for the Navi CFCI platform using Prisma ORM with PostgreSQL.

## Features

- TypeScript-based Prisma ORM for database access
- RESTful API for database operations (available on port 5001)
- Support for PostgreSQL databases
- Cross-Origin Resource Sharing (CORS) configuration for multiple environments

## Port Allocation

This project follows a port allocation pattern where:
- Frontend UI services: 3000-3099
- Backend API services: 8000-8099  
- Data services: 5000-5099 (database service uses 5001)

## Deployment Patterns

### Local Development with Docker

For local development, this service runs in a Docker container as defined in the root docker-compose.yml file:
- The service is accessible to other containers at http://database:5001
- The service is accessible from the host machine at http://localhost:5001
- The PostgreSQL database runs in a separate container

### Production Deployment

For production, this service follows the project's deployment pattern:
1. The frontend is deployed to Vercel
2. Backend services (including this database service) are deployed to Google Cloud Run
3. PostgreSQL database is hosted as a managed service (Cloud SQL or Supabase)

Configuration for production deployment:
- Update the CORS allowed origins in src/api/server.ts with your production domains
- Deploy the service to Google Cloud Run
- Configure the DATABASE_URL environment variable to point to your production database
- Update other services to point to the deployed database service URL

## CORS Configuration

The service includes a robust CORS configuration that supports both development and production environments:

```javascript
const allowedOrigins = [
  // Development origins
  'http://localhost:3000',           // Frontend (local)
  'http://localhost:8000',           // API Gateway (local)
  'http://frontend:3000',            // Frontend (Docker)
  'http://api_gateway:8000',         // API Gateway (Docker)
  
  // Production origins - replace with your actual domains
  'https://navi-cfci.vercel.app',    // Vercel frontend
  'https://api-gateway-xxxx-uc.a.run.app'  // Cloud Run API Gateway
];
```

To add new allowed origins:
1. Edit the `allowedOrigins` array in src/api/server.ts
2. Rebuild and redeploy the service

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- A PostgreSQL database (local or cloud-hosted)

### Installation

1. Clone the repository
2. Navigate to the services/database directory
3. Install dependencies:

```bash
npm install
```

4. Configure environment variables:

Copy `.env.example` to `.env` and update the `DATABASE_URL` to point to your PostgreSQL instance.

5. Generate Prisma client:

```bash
npm run generate
```

### Running the Service

For development:

```bash
npm run dev
```

For production:

```bash
npm run build
npm start
```

## API Endpoints

The service exposes the following REST API endpoints:

### Interviews

- `GET /interviews` - Get all interviews (paginated)
- `GET /interviews/:id` - Get interview by ID
- `POST /interviews` - Create a new interview
- `PUT /interviews/:id` - Update an existing interview
- `DELETE /interviews/:id` - Delete an interview

## Database Schema

The current schema includes:

### Interview

```prisma
model Interview {
  id               String    @id @default(uuid())
  title            String
  createdAt        DateTime  @default(now()) @map("created_at")
  updatedAt        DateTime  @updatedAt @map("updated_at")
  problemCount     Int       @map("problem_count")
  transcriptLength Int       @map("transcript_length")
  analysisData     Json      @map("analysis_data")
  projectId        String?   @map("project_id")
  interviewer      String?
  interviewDate    DateTime? @map("interview_date")

  @@map("interviews")
}
```

## Using in Other Services

This service can be used:

1. Via REST API (for the interview_analysis service)
2. Directly as a TypeScript package (for the frontend) 