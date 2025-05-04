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
*   Access credentials for external services (Supabase DB, Google Gemini) - see setup guide.

**Setup & Run:**

For detailed instructions on cloning, configuring required `.env` files (including shared secrets and API keys), initializing the database (handled automatically on first run), and running the application using `docker compose`, please refer to the comprehensive guide:

➡️ [**docs/01_local_development_guide.md**](docs/01_local_development_guide.md)

**Important:** Before running `docker compose up` for the first time, you must manually apply database migrations. See the Local Development Guide for details.

**Access After Running:**

*   Frontend: http://localhost:3000
*   API Gateway Docs (Local): http://localhost:8000/docs

(See [docs/local_development_guide.md](docs/01_local_development_guide.md) for detailed setup and troubleshooting)

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