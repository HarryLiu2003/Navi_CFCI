# Local Development Guide

This guide provides instructions for setting up and running the Navi CFCI platform locally using Docker Compose, along with common development tasks.

## 1. Recommended Setup: Docker Compose

Using Docker Compose is the recommended way to run the entire application stack locally. It ensures consistency with the production environment and manages inter-service communication.

**Prerequisites:**

*   Docker & Docker Compose installed.
*   Git.
*   Access credentials (Supabase Connection String, Gemini API Key, JWT/NextAuth Secret).

**Steps:**

1.  **Clone Repository:** `git clone [repository-url] && cd Navi_CFCI`
2.  **Configure `.env` Files:**
    *   Run `cp .env.example .env` (if root `.env` is used).
    *   Run `cp services/api_gateway/.env.example services/api_gateway/.env`
    *   Run `cp services/database/.env.example services/database/.env`
    *   Run `cp services/interview_analysis/.env.example services/interview_analysis/.env`
    *   Run `cp services/sprint1_deprecated/.env.example services/sprint1_deprecated/.env`
    *   Run `cp frontend/.env.example frontend/.env`
    *   **Edit the new `.env` files** to add required secrets/keys:
        *   `services/database/.env`: Add `DATABASE_URL` (Transaction Pooler URL, port 6543) and `MIGRATE_DATABASE_URL` (Session Pooler URL, port 5432).
        *   `services/interview_analysis/.env`: `GEMINI_API_KEY`.
        *   `frontend/.env`: `NEXTAUTH_SECRET` (Generate a secure secret, e.g., `openssl rand -hex 32`). Also set `NEXTAUTH_URL=http://localhost:3000` and `NEXT_PUBLIC_API_URL=http://localhost:8000`.
        *   `services/api_gateway/.env`: `JWT_SECRET` (**Must match** `NEXTAUTH_SECRET` above). Also set `ENABLE_DEV_AUTH=true`, `DEVELOPMENT_USER_ID=dev-user-docker-123`, `CORS_ORIGINS=http://localhost:3000`.
3.  **Initialize Database (Handled Automatically on Start):**
    *   Database migrations (`npx prisma migrate deploy`) are applied automatically by the `services/database/entrypoint.sh` script using the `MIGRATE_DATABASE_URL` when the `database` service starts via `docker compose up`.
    *   **Note:** You only need to *manually generate* new migrations using `migrate dev` when the schema changes (see section 3 below).
4.  **Run:** `docker compose up --build` (Use `--build` first time or after changes).
5.  **Access Services:**
    *   Frontend UI: http://localhost:3000
    *   API Gateway (Docs): http://localhost:8000/docs
6.  **Register/Login:** Use the frontend UI.

## 2. Development Workflow

*   **Hot Reloading:** Most services (`frontend`, `api_gateway`, `interview_analysis`, `database`) are configured for hot-reloading within Docker. Changes to source code should automatically restart the relevant service container.
*   **Viewing Logs:**
    *   All services: `docker compose logs -f`
    *   Specific service: `docker compose logs -f api_gateway`
*   **Stopping Services:** `docker compose down`
*   **Rebuilding Images:** `docker compose build` or `docker compose up --build`.

## 3. Common Development Tasks

### Managing Database Schema (Prisma)

1.  **Modify Schema:** Edit `services/database/prisma/schema.prisma`.
2.  **Generate Migration:** `docker compose run --rm database npx prisma migrate dev --name <your_migration_name>` (This runs the command inside a temporary container).
3.  **Apply Migrations:** Migrations are usually applied automatically by `migrate dev`, but `migrate deploy` is used in the initial setup and CI/CD.
4.  **Generate Client:** `docker compose run --rm database npx prisma generate`.

### Running Service-Specific Tests

Use `docker compose exec` to run tests inside the running containers:

```bash
# API Gateway Tests
docker compose exec navi_cfci-api_gateway-1 pytest

# Interview Analysis Tests
docker compose exec navi_cfci-interview_analysis-1 pytest

# Database Service Tests
docker compose exec navi_cfci-database-1 npm test # Needs test setup

# Sprint1 Deprecated Tests
docker compose exec navi_cfci-sprint1_deprecated-1 pytest

# Frontend Tests (Jest - needs setup)
docker compose exec navi_cfci-frontend-1 npm test
docker compose exec navi_cfci-frontend-1 npm run cy:run # E2E tests
```

(See [testing_strategy.md](testing_strategy.md) for more details).

## 4. Troubleshooting Local Setup

*   **Port Conflicts:** If `docker compose up` fails with port errors, stop other applications using ports 3000, 5001, 8000, 8001, 8002.
*   **`.env` Errors:** Double-check all required secrets/keys are present and correctly formatted in the `.env` files for each service.
*   **Database Connection:** Ensure the `DATABASE_URL` is correct and Supabase is accessible. Check `docker compose logs -f database` for errors.
*   **Auth Errors:** Verify `NEXTAUTH_SECRET` and `JWT_SECRET` are identical in `frontend/.env` and `api_gateway/.env`. Check API Gateway logs for JWT validation errors if login fails.
*   **Hot Reload:** If code changes aren't reflected, ensure volumes are mounted correctly in `docker-compose.yml` and restart the specific container (`docker compose restart api_gateway`).