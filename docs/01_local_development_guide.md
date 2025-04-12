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
    *   Run `cp services/database-service/.env.example services/database-service/.env`
    *   Run `cp services/interview_analysis/.env.example services/interview_analysis/.env`
    *   Run `cp services/sprint1_deprecated/.env.example services/sprint1_deprecated/.env`
    *   Run `cp frontend/.env.example frontend/.env`
    *   **Edit the new `.env` files** to add required secrets/keys:
        *   `services/database-service/.env`: Add `DATABASE_URL` (Transaction Pooler URL, port 6543) and `MIGRATE_DATABASE_URL` (Session Pooler URL, port 5432).
        *   `services/interview_analysis/.env`: `GEMINI_API_KEY`. Also set `DATABASE_API_URL=http://database-service:5001` (use service name).
        *   `frontend/.env`: 
            *   `NEXTAUTH_SECRET`: (Must match `JWT_SECRET` in api_gateway)
            *   `NEXTAUTH_URL=http://localhost:3000`
            *   `NEXT_PUBLIC_API_URL=http://localhost:8000`
            *   `DATABASE_URL`: (Supabase Transaction Pooler URL, port 6543) - **Required by NextAuth Prisma Adapter**.
        *   `services/api_gateway/.env`: `JWT_SECRET` (**Must match** `NEXTAUTH_SECRET` above). Also set `ENABLE_DEV_AUTH=true`, `DEVELOPMENT_USER_ID=dev-user-docker-123`, `CORS_ORIGINS=http://localhost:3000`, `SERVICE_DATABASE=http://database-service:5001`, `SERVICE_INTERVIEW_ANALYSIS=http://interview_analysis:8001`.
        *   `services/sprint1_deprecated/.env`: `OPENAI_API_KEY` (if using this deprecated service).
3.  **Install Dependencies:** Run `npm install` (or equivalent) in both `frontend/` and `services/database-service/` (and potentially other service directories if they have separate dependencies, although Docker typically handles this).
4.  **Prepare Prisma for Frontend (NextAuth Adapter):**
    *   **Ensure Schema:** Verify that `frontend/prisma/schema.prisma` exists and is **identical** to `services/database-service/prisma/schema.prisma`. If missing, copy it from `services/database-service/prisma/`.
    *   **Generate Client:** Run Prisma generate within the frontend directory:
        ```bash
        # Run from project root
        cd frontend
        npx prisma generate 
        cd .. 
        # OR if running via Docker already (less common during initial setup):
        # docker compose run --rm frontend sh -c "npx prisma generate"
        ```
5.  **Initialize Database (Handled Automatically on Start):**
    *   Database migrations (`npx prisma migrate deploy`) are applied automatically by the `services/database-service/entrypoint.sh` script using the `MIGRATE_DATABASE_URL` when the `database-service` starts via `docker compose up`.
    *   **Note:** You only need to *manually generate* new migrations using `migrate dev` when the schema changes (see section 3 below).
6.  **Run:** `docker compose up --build` (Use `--build` first time or after changes).
7.  **Access Services:**
    *   Frontend UI: http://localhost:3000
    *   API Gateway (Docs): http://localhost:8000/docs
8.  **Register/Login:** Use the frontend UI.

## 2. Development Workflow

*   **Hot Reloading:** Most services (`frontend`, `api_gateway`, `interview_analysis`, `database-service`) are configured for hot-reloading within Docker. Changes to source code should automatically restart the relevant service container.
*   **Viewing Logs:**
    *   All services: `docker compose logs -f`
    *   Specific service: `docker compose logs -f api_gateway`
*   **Stopping Services:** `docker compose down`
*   **Rebuilding Images:** `docker compose build` or `docker compose up --build`.

## 3. Common Development Tasks

### Managing Database Schema (Prisma)

*   **IMPORTANT:** Always modify the schema in **`services/database-service/prisma/schema.prisma`** as the source of truth.

1.  **Modify Schema:** Edit `services/database-service/prisma/schema.prisma`.
2.  **Generate & Apply Migration:** Run the following command from the **project root**. This script (`prisma:migrate:dev` in the root `package.json`) automatically:
    *   Copies the schema to `frontend/prisma/`.
    *   Generates the Prisma client for `database-service`.
    *   Generates the Prisma client for `frontend`.
    *   Runs `prisma migrate dev` against the database service using the correct `MIGRATE_DATABASE_URL`.
    ```bash
    # Use '-- --name' to pass the migration name argument
    npm run prisma:migrate:dev -- --name <your_migration_name>
    ```
3.  **Manually Apply/Reset Migrations (If Needed):** Run these from the **project root**:
    ```bash
    # Apply existing migrations
    npm run prisma:migrate:deploy
    
    # Reset database (destructive!)
    npm run prisma:migrate:reset
    ```
    *(These root scripts also ensure the correct `MIGRATE_DATABASE_URL` is used)*
4.  **Generate Clients Only:** If you only need to regenerate clients after manually syncing the schema or pulling changes, run from the **project root**:
    ```bash
    npm run prisma:sync
    ```

### Running Service-Specific Tests

Use `