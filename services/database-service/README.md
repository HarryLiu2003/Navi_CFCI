# Navi CFCI Database Service

This service provides a centralized RESTful API layer for database operations for the Navi CFCI platform, using Prisma ORM connected to a PostgreSQL database (Supabase).

## Core Responsibilities

*   Provide CRUD API endpoints for core data models (Interviews, Users, etc.).
*   Interact with the PostgreSQL database via Prisma.
*   Handle database-specific logic and validation.
*   Ensure secure database connections (using Supabase pooler recommended settings).

(See [../../docs/data_storage.md](../../docs/data_storage.md) for schema details and Supabase setup).
(See [../../docs/architecture.md](../../docs/architecture.md) for how this service fits into the overall system).

## API Endpoints

The service exposes REST API endpoints under `/`. Key endpoints include:

*   `GET /interviews`: Get interviews (paginated, requires `userId` query param for authorization).
*   `GET /interviews/:id`: Get interview by ID (requires `userId` query param for authorization).
*   `POST /interviews`: Create a new interview (expects `userId` in body).
*   `PUT /interviews/:id`: Update an existing interview.
*   `DELETE /interviews/:id`: Delete an interview.
*   `GET /`: Health check.

(Authorization checks based on `userId` are performed within the endpoint handlers).

## Environment Variables (.env)

Create `.env` from `.env.example`. Key variables:

*   `DATABASE_URL`: **Required.** The connection string for the PostgreSQL database (Supabase Transaction Pooler URL recommended).
*   `PORT`: Port for the service API (defaults to 5001 locally).
*   `NODE_ENV`: Set to `development` or `production`.
*   `CORS_ORIGINS`: Comma-separated list of allowed origins for API requests (e.g., `http://api_gateway:8000` internally, Cloud Run URLs in prod).

(See [../../docs/deployment_guide.md](../../docs/deployment_guide.md) for production environment variables and secret management).

## Local Development & Testing

### Running with Docker Compose (Recommended)

Run the full stack from the project root:
```bash
docker compose up
```
This service will be available internally at `http://database:5001`.

### Running Standalone (Alternative)

Requires a running PostgreSQL database accessible via the `DATABASE_URL` in `.env`.

```bash
# From this directory (services/database)
npm install
npx prisma generate # If needed
npx prisma db push # Or migrate dev/deploy
npm run dev
```
Service runs on http://localhost:5001.

### Running Tests

```bash
# Run tests within the Docker container (recommended - requires test setup)
docker compose exec navi_cfci-database-1 npm test

# Run tests locally (requires local setup and test setup)
npm test
```

(See [../../docs/testing_strategy.md](../../docs/testing_strategy.md) for overall testing info).

## Schema Management

*   Schema defined in `prisma/schema.prisma`.
*   Apply changes locally: `npx prisma migrate dev --name <migration_name>`.
*   Apply existing migrations in CI/Prod: `npx prisma migrate deploy`.
*   Generate client: `npx prisma generate`.

## Testing

Currently, this service **lacks automated tests**. 

**Recommended Actions:**
*   Implement unit tests for repository functions using a testing framework like Jest, potentially mocking the Prisma client.
*   Implement API integration tests to verify endpoint behavior.

(See the main [Testing Strategy](../../docs/testing_strategy.md) for project guidelines). 