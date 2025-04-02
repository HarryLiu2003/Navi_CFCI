# Navi CFCI Database Service

This service provides a centralized database layer for the Navi CFCI platform using Prisma ORM with PostgreSQL.

## Features

- TypeScript-based Prisma ORM for database access
- RESTful API for database operations (available on port 5001)
- Support for PostgreSQL databases with PgBouncer connection pooling
- Cross-Origin Resource Sharing (CORS) configuration for multiple environments

## Port Allocation

This service runs on port 5001, following the project's port allocation pattern:
- Data services: 5000-5099 (database service uses 5001)

## Database Connection

### Prisma with PgBouncer

This service uses Prisma ORM with PgBouncer connection pooling for optimal database performance:

- PgBouncer is configured automatically via connection URL parameters
- Prepared statements are disabled to ensure compatibility with PgBouncer
- Connection pooling is handled at the database level for better resource utilization
- The service automatically adds required parameters to the DATABASE_URL

Example connection URL structure:
```
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

## Service-Specific CORS Configuration

The service includes a CORS configuration in `src/api/server.ts`:

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
  - Query parameters: `limit` (default: 10, max: 100), `offset` (default: 0)
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
  created_at       DateTime  @default(now())
  title            String
  problem_count    Int
  transcript_length Int
  analysis_data    Json
  project_id       String?
  interviewer      String?
  interview_date   DateTime?
  user             User?     @relation(fields: [userId], references: [id], onDelete: SetNull)
  userId           String?

  @@map("interviews")
}
```

## Using in Other Services

This service can be used:

1. Via REST API (for the interview_analysis service)
2. Directly as a TypeScript package (for the frontend) 