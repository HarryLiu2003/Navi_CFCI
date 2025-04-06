# Refactoring Plan: Standard JWT Authentication

2025-04-04

Transition from using the custom `X-User-ID` header for internal user identification to validating the standard `Authorization: Bearer <JWT>` header at the API Gateway. Ensure compatibility with local Docker development and Cloud Run/Vercel production, including a practical development/testing workflow.

## 1. Context

### 1.1. Current State (Pre-Refactor)

*   **User Authentication:** Handled by NextAuth in the frontend, using session cookies likely containing JWTs.
*   **Internal User Propagation:** When frontend API routes (running server-side on Vercel) call the API Gateway, they validate the user's session via cookies. They then primarily signal the user's identity to the API Gateway by sending a custom `X-User-ID` header containing the validated `session.user.id`. An `Authorization: Bearer <user_id>` header might also be sent as a fallback.
*   **API Gateway Authentication:** The API Gateway's middleware (`auth.py`) is configured to:
    *   Attempt validation of `Authorization: Bearer` tokens (but may fail if it contains only the user ID).
    *   Trust and prioritize the `X-User-ID` header (even in production) if `ALLOW_X_USER_ID_HEADER` is true.
    *   Utilize development-specific fallbacks (`ENABLE_DEV_AUTH`, `DEVELOPMENT_USER_ID`, `X-Development-Auth` header) when running locally via Docker Compose.
*   **Service-to-Service (API Gateway -> Backend):** Uses Google IAM authentication in production (API Gateway service account identity) and direct HTTP calls locally. The `userId` needed by the backend service (e.g., Database) is passed as a query parameter or in the request body.
*   **Problem Solved by Current State:** This setup successfully worked around issues related to consistently validating NextAuth-generated JWTs within the Python API Gateway environment.
*   **Reason for Refactor:** To adhere more closely to standard microservice security practices, improve maintainability, and reduce reliance on custom headers for core authentication context.

### 1.2. Target State (Post-Refactor)

*   **User Authentication:** No change (NextAuth).
*   **Internal User Propagation:** Frontend API routes will extract the raw JWT string from the validated NextAuth session. They will call the API Gateway sending *only* the standard `Authorization: Bearer <JWT_Token>` header.
*   **API Gateway Authentication:** The API Gateway's middleware (`auth.py`) will:
    *   Strictly validate the incoming JWT (signature, expiry, required claims like `sub`) using a shared `JWT_SECRET`.
    *   Reject requests with invalid/expired/malformed JWTs (401 Unauthorized).
    *   Completely ignore the `X-User-ID` header.
    *   Contain optional, clearly separated logic for development mode (`ENABLE_DEV_AUTH`) to allow testing (e.g., using a default dev user ID if *no* valid auth is provided, or recognizing specific test JWTs).
*   **Service-to-Service (API Gateway -> Backend):** No change (IAM/HTTP + `userId` param).
*   **Local Development:** Will support testing either via the development fallback mechanism OR by using generated, long-lived test JWTs.

## 2. Detailed Refactoring Steps

**Phase 1: Preparation & Configuration**

*   [x] **Step 1.1: Unify JWT Secret Management (Critical)**
    *   [x] **Prod:** Confirm Google Secret Manager (`nextauth-jwt-secret`) holds the definitive secret.
    *   [x] **Prod:** Ensure Vercel (`frontend`) `NEXTAUTH_SECRET` is set *from* Secret Manager.
    *   [x] **Prod:** Ensure API Gateway `cloudbuild.yaml` links `JWT_SECRET` *to* the same Secret Manager secret.
    *   [x] **Local:** Ensure `frontend/.env` (`NEXTAUTH_SECRET`) and `services/api_gateway/.env` (`JWT_SECRET`) contain the **identical** development secret value.
    *   [x] **Verify:** Double-check all env var names and references.

**Phase 2: Backend Refactoring (API Gateway)**

*   [x] **Step 2.1: Refactor Authentication Middleware (`api_gateway/app/middleware/auth.py`)**
    *   [x] **`verify_token`:** Modify to *only* validate `Authorization: Bearer <JWT>` strictly (signature, expiry, `sub` claim required). Remove *all* dev fallbacks.
    *   [x] **`get_optional_user`:** Modify to prioritize validating `Authorization: Bearer <JWT>`. Remove `X-User-ID` check. Implement clear `if ENABLE_DEV_AUTH:` block for development-only fallbacks (e.g., `X-Development-Auth` header check, return `DEVELOPMENT_USER_ID` payload only if no other valid auth was found).
    *   [x] **`get_user_id_from_payload`:** Simplify to primarily extract from `sub`. Keep other claim checks as secondary. Use `DEVELOPMENT_USER_ID` only if `ENABLE_DEV_AUTH` is true and no ID is found.
    *   [x] **Environment Vars:** Remove `ALLOW_X_USER_ID_HEADER` variable and usage.
*   [x] **Step 2.2: Verify API Gateway Routes (`api_gateway/app/main.py`)**
    *   [x] Confirm `get_interviews`, `get_interview_details` still use `Depends(get_optional_user)`.
    *   [x] Confirm `get_user_id_from_payload` is called correctly.
    *   [x] Confirm `userId` is passed correctly to `call_authenticated_service`.
    *   [x] Review/adjust logging for clarity.

**Phase 3: Frontend Refactoring**

*   [x] **Step 3.1: Refactor Frontend API Routes (`/api/interviews/*.ts`)**
    *   [x] In `GET` handlers, use `getToken({ req, secret: process.env.NEXTAUTH_SECRET, raw: true })` to get the raw JWT string.
    *   [x] If raw token string exists, set `headers['Authorization'] = \`Bearer ${token}\`;` for the API Gateway call.
    *   [x] Handle errors if `getToken` fails (e.g., return 401).
    *   [x] **Remove** sending `Authorization: Bearer <userId>`.
    *   [x] **Remove** sending `X-User-ID` header.
    *   [x] **Remove** sending `X-Development-Auth` header.
    *   [x] Verify `NEXTAUTH_SECRET` is available in the Vercel serverless function environment. *(User confirmed)*.
*   [x] **Step 3.2: Verify Frontend API Lib (`lib/api.ts`)**
    *   [x] Confirm `getInterviews`, `getInterviewById` call relative paths (`/api/...`).
    *   [x] Confirm they only set basic headers (`Accept`) and use `credentials: 'include'`. They should *not* handle `Authorization` headers themselves. *(Confirmed)*.

**Phase 4: Local Development Environment Update**

*   [x] **Step 4.1: Update Docker Compose (`docker-compose.yml`)**
    *   [x] `api_gateway` env: Remove `ALLOW_HEADER_PASSTHROUGH`.
    *   [x] `api_gateway` env: Decide and set `ENABLE_DEV_AUTH` (`true` for fallback chosen).
    *   [x] `api_gateway` env: Ensure `JWT_SECRET` loaded via `env_file`.
    *   [x] `frontend` env: Ensure `NEXTAUTH_SECRET` loaded via `env_file`.
    *   [x] `frontend` env: *Consider* `INTERNAL_API_URL=http://api_gateway:8000` if API routes need it. (Deferred).
*   [x] **Step 4.2: Update `.env` Files**
    *   [x] Re-verify `frontend/.env` (`NEXTAUTH_SECRET`) and `services/api_gateway/.env` (`JWT_SECRET`) have the **identical** value. *(Confirmed)*.
*   [x] **Step 4.3: Define Local Testing Strategy (Choose One)**
    *   [x] **Option A (Dev Fallback):** Keep `ENABLE_DEV_AUTH=true`. Document that direct API calls without auth will use the dev user.
    *   [ ] **Option B (Test JWTs):** Set `ENABLE_DEV_AUTH=false`. Create `generate_test_token.py` script. Document its usage for `curl`/Postman testing.

**Phase 5: Deployment Configuration Update**

*   [x] **Step 5.1: Update API Gateway Cloud Build (`cloudbuild.yaml`)**
    *   [x] In `gcloud run deploy` args:
        *   [x] Remove `ALLOW_X_USER_ID_HEADER` from `--set-env-vars`.
        *   [x] Ensure `ENABLE_DEV_AUTH=false` in `--set-env-vars`.
        *   [x] Ensure `--update-secrets=JWT_SECRET=nextauth-jwt-secret:latest` is present and correct. *(Confirmed)*.
*   [x] **Step 5.2: Verify Vercel Frontend Configuration**
    *   [x] Double-check Vercel `NEXTAUTH_SECRET` is linked to the Google Secret Manager secret. *(Confirmed)*.

**Phase 6: Testing**

*   [x] **Step 6.1: Local Docker Testing:**
    *   [x] `docker compose up --build`
    *   [x] Test UI Login
    *   [x] Test UI Interview List
    *   [x] Test UI Analysis & Detail View
    *   [x] Test Direct API Gateway calls (`curl`/Postman) based on chosen dev strategy (Step 4.3 - Option A used, dev fallback confirmed working for direct calls).
*   [x] **Step 6.2: Staging/Production Environment Testing:**
    *   [x] Deploy all changes.
    *   [x] Test UI Login
    *   [x] Test UI Interview List
    *   [x] Test UI Analysis & Detail View
    *   [x] Test Direct API calls with invalid/expired tokens (expect 401 - Confirmed: Received 401 on production).

**Phase 7: Documentation**

*   [x] **Step 7.1: Update `authentication.md`:**
    *   [x] Remove `X-User-ID` explanations.
    *   [x] Document standard JWT flow (Frontend API -> sign JWS -> Gateway -> Validate JWS).
    *   [x] Explain shared secret requirement.
    *   [x] Update local development testing section (Option A - Dev Fallback chosen).
*   [x] **Step 7.2: Update READMEs/Other Docs:** Check service READMEs for outdated auth info. (API Gateway & Frontend READMEs checked, service READMEs updated, consolidated guides created).

## 3. Rollback Considerations

*   Code changes can be reverted via git.
*   Environment variable configurations in Docker, Cloud Build, and Vercel would need to be reverted to their previous state (re-adding `ALLOW_X_USER_ID_HEADER`, adjusting `ENABLE_DEV_AUTH` if changed).
*   The primary risk involved mismatches in the `JWT_SECRET` or JWT validation logic between the frontend and API Gateway, which was resolved by manually signing JWS in frontend API routes.