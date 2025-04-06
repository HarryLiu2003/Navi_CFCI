# Navi CFCI Frontend

A Next.js application for the Navi CFCI platform that provides a user interface for transcript analysis, result visualization, and user authentication.

## Key Features

*   User dashboard for managing interviews.
*   Transcript upload interface.
*   Interactive display of analysis results (problem areas, synthesis, transcript linking).
*   User registration and login (via NextAuth).

(See [../docs/architecture.md](../docs/architecture.md) for how this fits into the overall system).

## Local Development

### Running with Docker Compose (Recommended)

Run the full stack from the project root:

```bash
# From project root
docker compose up
```
Access the frontend at http://localhost:3000.

### Running Standalone (Alternative)

```bash
# From this directory (frontend/)
npm install
npm run dev
```
Access at http://localhost:3000. Requires backend services (especially API Gateway) to be running and accessible at the URL specified in `.env`.

## Environment Variables (.env)

Create `.env` from `.env.example`.

*   `NEXTAUTH_SECRET`: **Required.** Secret for NextAuth session/JWT handling. **Must match** `JWT_SECRET` in `api_gateway/.env` locally.
*   `NEXTAUTH_URL`: URL for NextAuth callbacks (e.g., `http://localhost:3000` locally).
*   `NEXT_PUBLIC_API_URL`: **Required.** URL of the API Gateway the frontend will call.
    *   Local: `http://localhost:8000` (when running via Docker Compose)
    *   Production: The Cloud Run URL of the deployed API Gateway.
*   `NODE_ENV`: `development` or `production`. Used by Next.js build process (was `NEXT_PUBLIC_ENV`).
*   `DATABASE_URL`: **Required.** Connection string for Prisma (used by NextAuth Prisma Adapter).

(See [../docs/deployment_guide.md](../docs/deployment_guide.md) for production environment variables and secret management).

## Testing

```bash
# Run unit/integration tests within the Docker container (recommended - requires Jest setup)
docker exec -it navi_cfci-frontend-1 npm test

# Run tests locally (requires Jest setup)
npm test

# Run E2E tests with Cypress within Docker
docker exec -it navi_cfci-frontend-1 npm run cy:run

# Open Cypress runner locally
npm run cy:open
```

(See [../docs/testing_strategy.md](../docs/testing_strategy.md) for overall testing info).

## Deployment

This application is typically deployed to **Vercel**.
Refer to the central [Deployment Guide](../docs/deployment_guide.md) for detailed instructions.
