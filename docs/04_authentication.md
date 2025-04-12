# Navi CFCI Authentication System

This document explains the authentication methods used in the Navi CFCI platform, focusing on user authentication and internal service communication after the JWT refactoring (April 2025).

## Authentication Flow (Standard JWT Practice)

The system now follows a standard JWT-based authentication flow:

1.  **Frontend Login:** The user logs in via the Next.js frontend using NextAuth (`CredentialsProvider`). NextAuth manages the user session using secure cookies. Based on the configuration (`strategy: 'jwt'`, top-level `secret` from `NEXTAUTH_SECRET`), NextAuth generates and stores a standard **JSON Web Signature (JWS)** token internally, signed using the `NEXTAUTH_SECRET`.
2.  **Frontend Client Request:** The React components (`page.tsx`, `[id]/page.tsx`) make requests to internal Next.js API routes (e.g., `/api/interviews`, `/api/analyze-transcript`) using `fetch`. The `credentials: 'include'` option ensures the browser sends the NextAuth session cookies along with these requests.
3.  **Frontend API Route (Server-Side - e.g., `frontend/src/app/api/...`):**
    *   Receives the request from the client with cookies.
    *   Validates the user's session using `getServerSession(authOptions)`.
    *   **Crucially:** It calls `getToken({ req, secret: process.env.NEXTAUTH_SECRET })` to get the *decoded payload* of the user's session JWT.
    *   It then **manually signs a *new*, short-lived JWS token** using the `jose` library and the same `NEXTAUTH_SECRET`. This new token contains essential user claims (`sub`, `name`, `email`, `iat`, `exp`).
    *   It prepares the onward request to the **API Gateway**.
    *   It adds the newly signed JWS token to the `Authorization: Bearer <new_signed_JWS>` header.
    *   It sends the request (using the correct internal Docker hostname or production Cloud Run URL) to the API Gateway.
4.  **API Gateway (`services/api_gateway` - Python/FastAPI):**
    *   Receives the request from the frontend server's API route.
    *   The authentication middleware (`app/middleware/auth.py`) intercepts the request.
    *   It uses `jwt.decode` (from `PyJWT`) and the shared `JWT_SECRET` (loaded from env/Secret Manager) to **strictly validate** the incoming JWS token (checks signature, expiry, required `sub` claim).
    *   If validation succeeds, the decoded payload is passed to the route handler. If validation fails (invalid signature, expired, missing claims), a `401 Unauthorized` error is typically raised by the middleware (`verify_token` dependency) or handled by the route logic (`get_optional_user` dependency followed by a check).
    *   The route handler extracts the `userId` from the validated payload's `sub` claim using `get_user_id_from_payload`.
    *   The handler calls the appropriate backend service (Database, Interview Analysis) using `call_authenticated_service`.
5.  **API Gateway -> Backend Service Communication:**
    *   **Production (Cloud Run):** `call_authenticated_service` uses **Google IAM authentication**. It fetches an OIDC token for the API Gateway's *service account* and adds it to the `Authorization: Bearer <IAM_OIDC_Token>` header of the request sent to the backend service (e.g., Database Service). The `userId` is passed as a query parameter or in the request body.
    *   **Local (Docker):** `call_authenticated_service` detects it's not in Cloud Run and makes a direct HTTP request to the backend service using its Docker network name (e.g., `http://database:5001`), without IAM OIDC tokens. The `userId` is still passed as a parameter/in the body.
6.  **Backend Services (Database, Interview Analysis):**
    *   Receive the request from the API Gateway. In production, they implicitly verify the IAM OIDC token via Cloud Run's infrastructure (if configured with `--no-allow-unauthenticated`).
    *   Extract the `userId` from the request parameters/body provided by the API Gateway.
    *   Perform actions based on the `userId`.

## Key Components & Configuration

*   **`NEXTAUTH_SECRET` / `JWT_SECRET`:** The **identical** secret key must be securely configured for:
    *   The Vercel frontend environment (`NEXTAUTH_SECRET` - linked from Secret Manager).
    *   The API Gateway Cloud Run environment (`JWT_SECRET` - linked from Secret Manager).
    *   Local development `.env` files for both `frontend` (`NEXTAUTH_SECRET`) and `api_gateway` (`JWT_SECRET`).
*   **NextAuth Config (`frontend/src/app/api/auth/[...nextauth]/route.ts`):**
    *   `session: { strategy: "jwt" }`
    *   Relies on the top-level `secret` for default JWS (HS256) signing. The `jwt: {}` block is intentionally left empty/removed.
    *   Callbacks ensure `user.id` is mapped to the `sub` claim in the token.
*   **Frontend API Routes (`frontend/src/app/api/.../route.ts`):**
    *   Use `getToken({ req, secret, raw: false })` to get the *decoded* session payload.
    *   Use `jose.SignJWT` to manually sign a *new* JWS token with relevant claims and short expiry.
    *   Send `Authorization: Bearer <new_signed_JWS>` to the API Gateway.
*   **API Gateway Middleware (`api_gateway/app/middleware/auth.py`):**
    *   Uses `jwt.decode` with the shared `JWT_SECRET` and `algorithms=['HS256']` to validate incoming JWS.
    *   `verify_token` dependency provides strict validation (requires `sub`, `exp`, valid signature/expiry).
    *   `get_optional_user` dependency attempts validation but allows controlled fallbacks *only* in development (`ENABLE_DEV_AUTH=true`).
    *   `get_user_id_from_payload` safely extracts the ID, primarily from the `sub` claim.
*   **Environment Variables:**
    *   `ENABLE_DEV_AUTH` (API Gateway): Set `true` in Docker for local fallback, `false` in Cloud Run for strict production validation.
    *   `DEVELOPMENT_USER_ID` (API Gateway): Defines the user ID for local fallbacks.

## Local Development & Testing

*   The current setup uses **Option A (Dev Fallback)**.
*   Set `ENABLE_DEV_AUTH=true` in `docker-compose.yml` for the `api_gateway`.
*   If you make direct calls (e.g., `curl`) to the local API Gateway (`localhost:8000`) without a valid `Authorization: Bearer` token, the `get_optional_user` middleware will detect the failure and substitute the `DEVELOPMENT_USER_ID` specified in `docker-compose.yml`. This allows testing endpoints locally without needing to constantly generate valid JWTs, but remember that production requires valid tokens.
*   Testing authentication failures locally requires setting `ENABLE_DEV_AUTH=false` temporarily or generating test tokens (Option B).

This standard JWT approach ensures security and aligns with common microservice patterns.