# Navi CFCI Documentation Hub

This directory contains detailed documentation for the Navi CFCI project.

## Core Guides

*   **[Local Development Guide](01_local_development_guide.md):** Comprehensive instructions for setting up and running the project locally using Docker Compose, including common tasks and troubleshooting.
*   **[Architecture](02_architecture.md):** Detailed explanation of the microservices structure, communication patterns, and data flow.
*   **[Data Storage](03_data_storage.md):** Database schema (Prisma), PostgreSQL/Supabase setup, and data access patterns.
*   **[Authentication](04_authentication.md):** Covers user login/session management (NextAuth) and internal service authentication (JWT & Google IAM).
*   **[Testing Strategy](05_testing_strategy.md):** Overview of unit, integration, and end-to-end tests, and how to run them.
*   **[Deployment Guide](06_deployment_guide.md):** Step-by-step instructions for deploying the frontend to Vercel and backend services to Google Cloud Run, including environment variables, IAM, and service account setup.

## Service-Specific Documentation

For details specific to individual services (like specific API endpoints or local service testing), refer to the `README.md` within each service's directory:

*   [Frontend README](../frontend/README.md)
*   [API Gateway README](../services/api_gateway/README.md)
*   [Interview Analysis README](../services/interview_analysis/README.md)
*   [Database Service README](../services/database/README.md)
*   [Sprint1 Deprecated README](../services/sprint1_deprecated/README.md)

## Archived / Superseded

Outdated planning documents are kept here for historical reference.

*   [Cloud Deployment Plan](archive/250402_cloud_deployment_plan.md)
*   [JWT Refactor Plan](archive/250404_refactor_plan_jwt_auth.md)