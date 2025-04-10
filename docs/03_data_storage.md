# Data Storage Guide

This document details the data storage strategy for the Navi CFCI platform, focusing on the PostgreSQL database managed via Prisma and accessed through a dedicated Database Service.

## 1. Overview

*   **Database:** PostgreSQL (hosted on Supabase).
*   **ORM:** Prisma Client (TypeScript) used within the Database Service.
*   **Access Pattern:** Backend services (API Gateway, Interview Analysis) do *not* connect directly to PostgreSQL. They interact with the database via the dedicated **Database Service** (a Node.js/Express application running on Cloud Run).
*   **Schema Definition:** The single source of truth for the database schema is `services/database/prisma/schema.prisma`.

## 2. Database Setup & Connection Strings

1.  **Create Project:** Set up a new project on [Supabase](https://supabase.com).
2.  **Connection URLs:** Due to differences in how Prisma Client (in the running app) and Prisma CLI (for migrations) interact with Supabase connection poolers, we use two different connection strings:
    *   **Application URL (`DATABASE_URL`): Transaction Pooler (Port 6543)**
        *   **Purpose:** Used by the running Database Service application via Prisma Client (`client.ts`). This pooler mode is efficient for handling potentially many short-lived connections from the application server.
        *   **Format:** `postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres`
        *   **Configuration:**
            *   *Local:* Set as `DATABASE_URL` in `services/database/.env`. The necessary parameters (`?pgbouncer=true&prepared_statements=false`) are appended programmatically by `src/client.ts`.
            *   *Production:* Store this URL in Google Secret Manager (e.g., secret named `database-connection-string`). Mount this secret as the `DATABASE_URL` environment variable in the Cloud Run service.
    *   **Migration URL (`MIGRATE_DATABASE_URL`): Session Pooler (Port 5432)**
        *   **Purpose:** Used specifically by Prisma CLI commands (`prisma migrate deploy`) executed within the `services/database/entrypoint.sh` script during container startup.
        *   **Reason:** Prisma CLI migrations can hang or fail when using the Transaction Pooler URL. The Session Mode Pooler URL (which uses port 5432, like the direct connection) provides better compatibility for these CLI commands and supports both IPv4/IPv6, avoiding potential Docker network issues seen with the direct connection's IPv6 resolution.
        *   **Format:** `postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres` (Note the different port)
        *   **Configuration:**
            *   *Local:* Set as `MIGRATE_DATABASE_URL` in `services/database/.env`.
            *   *Production:* Store this URL in Google Secret Manager (e.g., secret named `migrate-database-connection-string`). Mount this secret as the `MIGRATE_DATABASE_URL` environment variable in the Cloud Run service.
3.  **Permissions:** Ensure the `database-service` service account has the `roles/secretmanager.secretAccessor` role granted for *both* secrets (`database-connection-string` and `migrate-database-connection-string`) in Google Cloud IAM.

## 3. Prisma Configuration

*   **Schema:** Defined in `services/database/prisma/schema.prisma`. This includes models for `User`, `Session` (for NextAuth), and `Interview`.
*   **Client Generation:** Run `npx prisma generate` within the `services/database` directory after any schema changes to update the Prisma Client.
*   **Migrations:** Use `npx prisma migrate dev` (local) or `npx prisma migrate deploy` (production/CI) to apply schema changes to the database.
*   **Connection Pooling Parameters:** To ensure compatibility with Supabase PgBouncer (or any pooler), the Prisma Client in `services/database/src/client.ts` programmatically adds `?pgbouncer=true&prepared_statements=false` to the `DATABASE_URL` before creating the client instance. This prevents common pooling errors.

## 4. Database Service (`services/database`)

*   **Purpose:** Provides a secure REST API layer over the database.
*   **Technology:** Node.js, Express, TypeScript, Prisma Client.
*   **Authentication:** Runs as a private Cloud Run service (`--no-allow-unauthenticated`). It expects incoming requests (from API Gateway or Interview Analysis service) to be authenticated via Google IAM OIDC tokens.
*   **Authorization:** Includes logic to check if the `userId` provided in query parameters matches the owner of the requested resource (e.g., ensuring a user can only fetch their own interviews).
*   **API Endpoints:** Exposes standard CRUD endpoints for interviews (see `services/database/README.md` for details), e.g.:
    *   `GET /interviews` (requires `userId` query param)
    *   `GET /interviews/:id` (requires `userId` query param)
    *   `POST /interviews` (expects `userId` in body)
*   **CORS:** Configured via environment variable (`CORS_ORIGINS`) to allow requests primarily from the API Gateway's production URL and potentially `localhost` for testing.

## 5. Database Schema Models

*(Based on `prisma/schema.prisma` as of 2025-04-05)*

### `User` (`users` table)

| Field    | Type    | Description            | Notes        |
| :------- | :------ | :--------------------- | :----------- |
| `id`     | String  | Primary Key (UUID)     | `@id @default(uuid())` |
| `name`   | String? | User's display name    | Optional     |
| `email`  | String  | User's email           | `@unique`    |
| `password`| String | Hashed password       | Required     |

### `Session` (`sessions` table)

| Field        | Type    | Description            | Notes                     |
| :----------- | :------ | :--------------------- | :------------------------ |
| `id`         | String  | Primary Key (UUID)     | `@id @default(uuid())`    |
| `sessionToken`| String | Unique session token   | `@unique`                 |
| `userId`     | String  | Foreign Key to User    |                           |
| `expires`    | DateTime| Session expiry time    |                           |
| `user`       | User    | Relation to User       | `@relation(..., onDelete: Cascade)` |

**Note on Session Strategy:**

*   Currently, this application uses the `CredentialsProvider` for authentication.
*   NextAuth.js v4 requires the `session: { strategy: "jwt" }` configuration when using `CredentialsProvider`.
*   As a result, active user sessions are managed via encrypted JSON Web Tokens (JWTs) stored in client-side cookies, **not** by storing session records in this `sessions` table.
*   The `Session` model and table are kept in the schema primarily for compatibility with the `@next-auth/prisma-adapter` (which expects it) and for future flexibility.
*   **If OAuth providers (e.g., Google, GitHub) are added in the future:** You will likely need to revisit the session strategy. OAuth typically works best with the `database` session strategy, which *would* utilize this `sessions` table to link OAuth accounts to users and manage sessions server-side. This would involve removing `session: { strategy: "jwt" }` from the NextAuth options.

### `Interview` (`interviews` table)

| Field             | Type     | Description                    | Notes                     |
| :---------------- | :------- | :----------------------------- | :------------------------ |
| `id`              | String   | Primary Key (UUID)             | `@id @default(uuid())`    |
| `created_at`      | DateTime | Creation timestamp             | `@default(now())`         |
| `title`           | String   | Interview title                | Required                  |
| `problem_count`   | Int      | Num identified problem areas | Required                  |
| `transcript_length`| Int     | Num transcript chunks        | Required                  |
| `analysis_data`   | Json     | Full JSON analysis result    | Required (`jsonb`)        |
| `project_id`      | String?  | Associated project ID          | Optional                  |
| `interviewer`     | String?  | Name of interviewer            | Optional                  |
| `interview_date`  | DateTime?| Date of interview              | Optional                  |
| `userId`          | String?  | Foreign Key to User          | Optional (`onDelete: SetNull`) |
| `user`            | User?    | Relation to User               |                           |

## 6. Schema Management & Migrations

1.  Modify `services/database/prisma/schema.prisma`.
2.  **Locally:** Run `cd services/database && npx prisma migrate dev --name <migration_name>` to generate SQL migration files and apply changes.
3.  **Production/CI:** Run `cd services/database && npx prisma migrate deploy` to apply existing migration files.
4.  Generate the client: `npx prisma generate`.
5.  If schema changes affect other services (unlikely with API pattern), update relevant types/interfaces.