# Navi CFCI - Interview Analysis Platform

A microservices-based platform using Next.js, FastAPI, Python, and Prisma/PostgreSQL for analyzing user interview transcripts with AI.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

Navi CFCI helps product teams extract meaningful insights from user interviews by:

*   Processing VTT and TXT transcript files.
*   Using AI (primarily Google Gemini) to identify problem areas, key demands, and generate a synthesis.
*   Extracting participant names based on transcript structure.
*   Providing a dashboard to view, filter, and manage analysis results and projects.
*   Allowing assignment of interviews to projects.
*   Integrating with user authentication.

## Architecture

The platform uses a microservices architecture deployed in a hybrid model:

*   **Frontend:** Next.js (React) application served via Vercel.
*   **API Gateway:** FastAPI (Python) service routing requests, running on Google Cloud Run.
*   **Backend Services:** FastAPI (Python) microservices for specific tasks (e.g., Interview Analysis using Gemini, Database interactions), running on Google Cloud Run.
*   **Database:** PostgreSQL managed via Prisma, hosted on Supabase.
*   **Local Development:** Fully containerized using Docker Compose.

(See [docs/architecture.md](docs/02_architecture.md) for more details)

## Quick Start (Local Development via Docker)

This is the recommended way to run the entire application locally.

**Prerequisites:**

*   Docker & Docker Compose
*   Git
*   Access credentials (see details below)

**Steps:**

1.  **Clone:** `git clone [repository-url] && cd Navi_CFCI`
2.  **Configure `.env` Files:**
    *   Run `cp .env.example .env`
    *   Run `cp services/api_gateway/.env.example services/api_gateway/.env`
    *   Run `cp services/database/.env.example services/database/.env`
    *   Run `cp services/interview_analysis/.env.example services/interview_analysis/.env`
    *   Run `cp services/sprint1_deprecated/.env.example services/sprint1_deprecated/.env`
    *   Run `cp frontend/.env.example frontend/.env`
    *   **Edit the new `.env` files** to add required secrets/keys:
        *   `services/database/.env`: Add `DATABASE_URL` (Transaction Pooler, port 6543) and `MIGRATE_DATABASE_URL` (Session Pooler, port 5432) from Supabase.
        *   `services/interview_analysis/.env`: `GEMINI_API_KEY`
        *   `services/sprint1_deprecated/.env`: `OPENAI_API_KEY` (if using this deprecated service)
        *   `frontend/.env` & `services/api_gateway/.env`: Generate a secure shared secret and set it for both `NEXTAUTH_SECRET` (frontend) and `JWT_SECRET` (gateway). Example: `openssl rand -hex 32`.
3.  **Initialize Database (Handled Automatically):**
    *   Database migrations (`prisma migrate deploy`) are applied automatically by `services/database/entrypoint.sh` when services start via `docker compose up`.
4.  **Run:** `docker compose up --build` (use `--build` on first run or after dependency changes)
5.  **Access:**
    *   Frontend: http://localhost:3000
    *   API Gateway Docs (Local): http://localhost:8000/docs
6.  **Register/Login:** Use the frontend UI to create an account and sign in.

(See [docs/local_development_guide.md](docs/local_development_guide.md) for detailed setup and troubleshooting)

## Documentation Hub

Find more detailed information in the `/docs` directory:

*   [**docs/README.md**](docs/README.md): Index and overview of documentation.
*   [**docs/01_local_development_guide.md**](docs/01_local_development_guide.md): Comprehensive guide for local setup and common tasks.
*   [**docs/02_architecture.md**](docs/02_architecture.md): In-depth system design.
*   [**docs/03_data_storage.md**](docs/03_data_storage.md): Database schema and Prisma setup.
*   [**docs/04_authentication.md**](docs/04_authentication.md): User and service authentication flow.
*   [**docs/05_testing_strategy.md**](docs/05_testing_strategy.md): Overview of testing approaches.
*   [**docs/06_deployment_guide.md**](docs/06_deployment_guide.md): Instructions for deploying to Vercel and Google Cloud Run.

## Contributing

Please refer to the project guide and development workflow documentation before contributing.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.