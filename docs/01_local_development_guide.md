# Local Development Guide

This guide provides comprehensive instructions for setting up and running the Navi CFCI platform locally using Docker Compose.

## Prerequisites

*   **Docker & Docker Compose:** Ensure they are installed and running.
*   **Git:** For cloning the repository.
*   **Secrets/Credentials:** You will need access to:
    *   Supabase Database Connection URLs (Transaction Pooler & Session Pooler).
    *   Google Gemini API Key.
    *   A shared JWT Secret (can be generated).
    *   (Optional) OpenAI API Key if testing the deprecated service.

## 1. Clone the Repository

```bash
git clone [repository-url] # Replace with actual URL
cd Navi_CFCI
```

## 2. Configure Environment Variables (.env files)

This is the most crucial setup step. You need to create and populate `.env` files for the root directory and each service.

**Action:** Copy the corresponding `.env.example` file to `.env` in each required location and **edit the `.env` file** to insert the correct values (secrets, URLs, keys).

**Required Files & Key Variables:**

1.  **Root Directory (`./.env`)**
    *   Copy from: `.env.example`
    *   Purpose: General development settings (not heavily used currently).

2.  **Frontend (`frontend/.env`)**
    *   Copy from: `frontend/.env.example`
    *   `NEXT_PUBLIC_API_URL=http://localhost:8000`: Points to the local API Gateway.
    *   `DATABASE_URL`: **Required** for NextAuth Prisma Adapter. Use the **Transaction Pooler URL** (Port 6543) from Supabase. (See Database URLs Explained below).
    *   `NEXTAUTH_URL=http://localhost:3000`: Standard NextAuth setting.
    *   `NEXTAUTH_SECRET`: **Critical.** Must be a secure, unique secret string (e.g., generate with `openssl rand -hex 32`). **This exact value must also be used for `JWT_SECRET` in the API Gateway `.env` file.**
    *   `NODE_ENV=development`

3.  **Database Service (`services/database-service/.env`)**
    *   Copy from: `services/database-service/.env.example`
    *   `DATABASE_URL`: **Required.** Use the **Transaction Pooler URL** (Port 6543) from Supabase. This is used by the Prisma Client at runtime.
    *   `MIGRATE_DATABASE_URL`: **Required.** Use the **Session Pooler URL or Direct Connection URL** (Port 5432) from Supabase. This is used by the `entrypoint.sh` script for running `prisma migrate deploy` on container startup.
    *   `NODE_ENV=development`
    *   `PORT=5001`

4.  **Interview Analysis Service (`services/interview_analysis/.env`)**
    *   Copy from: `services/interview_analysis/.env.example`
    *   `GEMINI_API_KEY`: **Required.** Your Google Gemini API Key.
    *   `LOG_LEVEL=INFO` (or `DEBUG` for more logs)
    *   `NODE_ENV=development`
    *   `DATABASE_API_URL=http://database-service:5001`: Uses the Docker service name to connect to the Database Service API.

5.  **API Gateway Service (`services/api_gateway/.env`)**
    *   Copy from: `services/api_gateway/.env.example`
    *   `LOG_LEVEL=INFO` (or `DEBUG`)
    *   `NODE_ENV=development`
    *   `SERVICE_INTERVIEW_ANALYSIS=http://interview_analysis:8001`: Docker service name.
    *   `SERVICE_DATABASE=http://database-service:5001`: Docker service name.
    *   `SERVICE_SPRINT1_DEPRECATED=http://sprint1_deprecated:8002`: Docker service name.
    *   `CORS_ORIGINS=http://localhost:3000`: Allows requests from the local frontend.
    *   `DEBUG=true`: Enables FastAPI debug mode.
    *   `JWT_SECRET`: **Critical.** Must be the **exact same secret** used for `NEXTAUTH_SECRET` in `frontend/.env`.
    *   `ENABLE_DEV_AUTH=true`: Enables fallback authentication for easier local API testing (see `docs/04_authentication.md`).
    *   `DEVELOPMENT_USER_ID=dev-user-docker-123`: The fallback user ID if dev auth is enabled.

6.  **(Optional) Sprint1 Deprecated Service (`services/sprint1_deprecated/.env`)**
    *   Copy from: `services/sprint1_deprecated/.env.example`
    *   `OPENAI_API_KEY`: Required only if testing this service.

### Database URLs Explained (Transaction vs. Migration)

You need two different connection URLs from your Supabase project:

*   **Transaction Pooler URL (`DATABASE_URL`, Port 6543):**
    *   **Used By:** The running Database Service application (via Prisma Client) and the Frontend (via NextAuth Prisma Adapter).
    *   **Purpose:** Optimized for handling many short-lived connections from serverless environments or application servers. It pools connections efficiently.
    *   **Requires:** Prisma Client needs specific options (`?pgbouncer=true&prepared_statements=false`) appended in the code (`database-service/src/client.ts`), but you typically use the base pooler URL in the `.env` file.
*   **Session Pooler URL or Direct Connection URL (`MIGRATE_DATABASE_URL`, Port 5432):**
    *   **Used By:** Prisma CLI commands, specifically `prisma migrate deploy`, which is run automatically by the `database-service` container's `entrypoint.sh` script during local development startup.
    *   **Purpose:** Provides a persistent connection needed for schema modifications during migrations. Transaction pooling can interfere with these operations.
    *   **Note:** Use the Session Pooler URL provided by Supabase if available, otherwise use the Direct Connection URL. Ensure it points to the correct port (usually 5432).

**Make sure you obtain both URLs from your Supabase project settings and place them in the correct `.env` variables.**

## 3. Initialize Database (Automatic on First Run)

When you run `docker compose up` for the first time (or after clearing volumes), the `database-service` container will automatically:

1.  Start.
2.  Execute its `entrypoint.sh` script.
3.  Run `npx prisma migrate deploy` using the `MIGRATE_DATABASE_URL` from its `.env` file.

This ensures the database schema defined in `services/database-service/prisma/schema.prisma` is applied to your development database.

**Note on Schema Changes:** If *you* modify the `schema.prisma` file later, you need to generate a *new* migration file first before the `entrypoint.sh` script can apply it on the next startup:

```bash
# Inside the services/database-service directory
docker compose run --rm database-service sh -c 'DATABASE_URL=$MIGRATE_DATABASE_URL npm run prisma:migrate:dev'
# Follow the prompts to name your migration.
```

## 4. Run the Application

```bash
# From the project root directory (Navi_CFCI)
docker compose up --build

# Use --build the first time or after changing dependencies (package.json, requirements.txt, etc.)
# For subsequent runs, 'docker compose up' is usually sufficient.
```

This command builds the Docker images for each service (if they don't exist or `--build` is used) and starts all the containers defined in `docker-compose.yml`.

## 5. Access Services

*   **Frontend:** [http://localhost:3000](http://localhost:3000)
*   **API Gateway Docs (Swagger UI):** [http://localhost:8000/docs](http://localhost:8000/docs)
*   **API Gateway Docs (ReDoc):** [http://localhost:8000/redoc](http://localhost:8000/redoc)

You can now use the frontend application, register a new user, log in, and interact with the backend services via the API Gateway.

## 6. Stopping the Application

```bash
# From the project root directory
docker compose down

# To remove volumes (e.g., node_modules) as well:
docker compose down -v
```

## 7. Common Tasks & Troubleshooting

*   **Viewing Logs:** `docker compose logs -f` (all services) or `docker compose logs -f <service_name>` (e.g., `docker compose logs -f api_gateway`).
*   **Rebuilding Specific Service:** `docker compose build <service_name>` (e.g., `docker compose build frontend`).
*   **Attaching to a Container:** `docker compose exec <service_name> bash` (e.g., `docker compose exec database-service bash`).
*   **Database Issues:** Ensure `DATABASE_URL` and `MIGRATE_DATABASE_URL` are correct in `services/database-service/.env`. Check Supabase project status.
*   **Authentication Issues:** Verify `NEXTAUTH_SECRET` in `frontend/.env` exactly matches `JWT_SECRET` in `services/api_gateway/.env`.
*   **Connection Errors (Service-to-Service):** Ensure Docker networking is up. Check service names used in `.env` files (e.g., `http://database-service:5001`).
*   **Resetting Docker:** If things are severely broken, `docker compose down -v` followed by `docker compose up --build` often helps.