# Refactoring API Calls to Eliminate `NEXT_PUBLIC_API_URL`

## Current State: Hybrid Approach

Currently, the frontend application uses two different methods for communicating with backend APIs:

1.  **Internal Next.js API Routes (BFF Pattern):**
    *   **Functions:** `analyzeTranscript`, `getInterviews`, `getInterviewById` (in `lib/api.ts`).
    *   **Mechanism:** Client-side code calls internal Next.js API routes (e.g., `/api/analyze-transcript`, `/api/interviews`). These server-side routes within the Next.js app handle authentication/session checks and then proxy the request to the actual API Gateway endpoint using a server-side environment variable (ideally `API_GATEWAY_URL`, though this might need explicit setup).
    *   **Pros:** Aligns with the Backend-for-Frontend pattern, enhances security by not exposing the main API Gateway URL directly to the browser, allows for server-side logic/aggregation, more consistent architecture.

2.  **Direct Client-Side Calls:**
    *   **Functions:** `preprocessTranscript`, `summarizeTranscript`, `extractKeywords` (in `lib/api.ts`).
    *   **Mechanism:** These functions use the `apiRequest` helper, which constructs the target URL using `API_CONFIG.API_URL`. This `API_CONFIG.API_URL` is configured using the `process.env.NEXT_PUBLIC_API_URL` environment variable.
    *   **Implication:** The `fetch` request originates *directly from the user's browser* and targets the API Gateway URL. This necessitates the `NEXT_PUBLIC_` prefix on the environment variable so that the browser's JavaScript can access it.
    *   **Cons:** Inconsistent with the BFF pattern used elsewhere, exposes the API Gateway URL to the client-side, slightly increases the security surface area.

## The Problem

The reliance on `NEXT_PUBLIC_API_URL` for the second set of functions forces us to expose the API Gateway URL publicly, which is not ideal for consistency and security compared to the BFF pattern.

## Refactoring Plan: Transition to Internal API Routes

To achieve a consistent and more secure architecture, we should refactor the direct client-side calls (`preprocessTranscript`, `summarizeTranscript`, `extractKeywords`) to use internal Next.js API routes.

**Steps:**

1.  **Introduce Server-Side Gateway URL:**
    *   Ensure a non-public environment variable, `API_GATEWAY_URL`, is defined in `.env.local` and production environments (e.g., Vercel). This variable holds the base URL of the actual API Gateway (e.g., `http://localhost:8000` or `https://api-gateway-....run.app`). **Do not** prefix it with `NEXT_PUBLIC_`.

2.  **Create New Internal API Routes:**
    *   Create the following files within `src/pages/api/`:
        *   `preprocess.ts` (handles requests to `/api/preprocess`)
        *   `summarize.ts` (handles requests to `/api/summarize`)
        *   `keywords.ts` (handles requests to `/api/keywords`)

3.  **Implement API Route Logic:**
    *   Inside each new API route (`preprocess.ts`, etc.):
        *   Verify the HTTP method (e.g., `POST`).
        *   Handle file uploads from the incoming request (e.g., using `formidable` or similar parsing libraries, as Next.js API routes don't automatically parse `multipart/form-data`).
        *   Perform session/authentication checks if necessary (mirroring other protected routes like `/api/analyze-transcript`).
        *   Construct the *actual* target API Gateway endpoint URL using `process.env.API_GATEWAY_URL` and the specific path (e.g., `${process.env.API_GATEWAY_URL}/api/sprint1_deprecated/preprocess`).
        *   Use `fetch` *within the API route* to forward the request (including the parsed file) to the target API Gateway endpoint.
        *   Receive the response from the API Gateway.
        *   Send the relevant status code and JSON data back to the original client-side caller.
        *   Implement robust error handling.

4.  **Update Frontend (`lib/api.ts`):**
    *   Modify the `preprocessTranscript`, `summarizeTranscript`, and `extractKeywords` functions.
    *   Remove the usage of the `apiRequest` helper.
    *   Change the `fetch` calls to target the *new internal API routes* (e.g., `/api/preprocess`, `/api/summarize`, `/api/keywords`), similar to how `analyzeTranscript` is implemented. Ensure `credentials: 'include'` is used if the API routes perform session checks.

5.  **Testing:**
    *   Thoroughly test the functionality associated with the refactored functions.
    *   Use browser developer tools (Network tab) to verify that requests now go to the internal `/api/...` routes and not directly to the API Gateway URL from the browser.
    *   Verify that the internal routes correctly proxy requests to the actual API Gateway.

6.  **Cleanup (Optional but Recommended):**
    *   Once confident that no client-side code uses `API_CONFIG.API_URL`:
        *   Remove the `NEXT_PUBLIC_API_URL` environment variable from all `.env` files and hosting provider settings (e.g., Vercel).
        *   Remove the `API_URL` key from the `API_CONFIG` object in `lib/api.ts`.
        *   If the `apiRequest` helper function is no longer used, remove it.

By following this plan, all API communication will be consistently routed through the Next.js backend, eliminating the need for `NEXT_PUBLIC_API_URL` and improving the application's architecture.
