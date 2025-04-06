# Deployment Preparation Plan - 2025-04-06

**Goal:** Implement necessary changes to the codebase configuration and deployment documentation (`docs/06_deployment_guide.md`) to ensure consistency, robustness, and readiness for deployment based on the analysis performed on 2025-04-07. This plan excludes actions related to the `sprint1-deprecated` service.

---

## 1. Database Service Naming Consistency

*   **Context:** The directory `services/database` needs to match the service name `database-service` used in Cloud Build configurations and expected by other services.
*   [x] **Step 1.1:** Rename the directory `Navi_CFCI/services/database` to `Navi_CFCI/services/database-service`.
*   [x] **Step 1.2:** (Covered in Guide Update Section 5.1) Ensure `docs/06_deployment_guide.md` uses the correct path `services/database-service` in relevant `cd` commands.

---

## 2. Database Service Migrations & Production Startup

*   **Context:** Ensure database migrations run automatically on deployment startup using the correct production command within the `database-service` container.
*   [x] **Step 2.1:** Verify the `start` script in `Navi_CFCI/services/database-service/package.json`. Confirm it executes the compiled production code (e.g., `node dist/index.js`). Adjust if necessary.
*   [x] **Step 2.2:** Modify `Navi_CFCI/services/database-service/entrypoint.sh`.
*   [x] **Step 2.3:** Modify `Navi_CFCI/services/database-service/Dockerfile`.
*   [x] **Step 2.4:** (Covered in Guide Update Section 5.2) Ensure `docs/06_deployment_guide.md` mentions that migrations run automatically on `database-service` startup.

---

## 3. Explicit Service URL Dependency Injection

*   **Context:** Remove hardcoded default service URLs from Cloud Build files and ensure the deployment script explicitly provides the necessary URLs at build time.
*   [x] **Step 3.1:** Edit `Navi_CFCI/services/api_gateway/cloudbuild.yaml`. In the `substitutions:` block, remove the specific URL values for `_SERVICE_INTERVIEW_ANALYSIS` and `_SERVICE_DATABASE`. Leave the keys defined but without default URLs (or use placeholder text like `'MUST_BE_PROVIDED'`).
    ```yaml
    substitutions:
      _SERVICE_INTERVIEW_ANALYSIS: '' # Or remove value
      _SERVICE_DATABASE: '' # Or remove value
      # _SERVICE_SPRINT1_DEPRECATED: ... <-- Remove this line entirely
      _NODE_ENV: 'production'
      _DEBUG: 'false'
      _LOG_LEVEL: 'INFO'
      _CORS_ORIGINS: 'https://navi-cfci.vercel.app' # Keep CORS default or update as needed
      _ENABLE_DEV_AUTH: 'false'
    ```
*   [x] **Step 3.2:** Edit `Navi_CFCI/services/interview_analysis/cloudbuild.yaml`. In the `substitutions:` block, remove the specific URL value for `_DATABASE_API_URL`.
    ```yaml
    substitutions:
      _DATABASE_API_URL: '' # Or remove value
      _NODE_ENV: production
      _DEBUG: "false"
      # _CORS_ORIGINS: ... <-- Remove this line (See Section 4)
      # _API_GATEWAY_URL: ... <-- Remove this line (See Section 4)
      _LOG_LEVEL: INFO
    ```
*   [x] **Step 3.3:** (Covered in Guide Update Section 5.3) Ensure `docs/06_deployment_guide.md` includes fetching the `database-service` URL and passing it via `--substitutions` when deploying `interview-analysis`.

---

## 4. Remove Unnecessary Environment Variables

*   **Context:** Remove environment variables from backend services that are unlikely to be needed, simplifying configuration.
*   [x] **Step 4.1:** Edit `Navi_CFCI/services/interview_analysis/cloudbuild.yaml`:
    *   [x] Remove the line `- '--set-env-vars=CORS_ORIGINS=${_CORS_ORIGINS}'` from the `args:` list for the deploy step.
    *   [x] Remove the line `- '--set-env-vars=API_GATEWAY_URL=${_API_GATEWAY_URL}'` from the `args:` list for the deploy step.
    *   [x] Remove the `_CORS_ORIGINS` key and value from the `substitutions:` block.
    *   [x] Remove the `_API_GATEWAY_URL` key and value from the `substitutions:` block.
*   [x] **Step 4.2:** Edit `Navi_CFCI/services/sprint1_deprecated/cloudbuild.yaml` (Optional Cleanup):
    *   [x] Remove the line `- '--set-env-vars=CORS_ORIGINS=${_CORS_ORIGINS}'` from the `args:` list for the deploy step.
    *   [x] Remove the `_CORS_ORIGINS` key and value from the `substitutions:` block.

---

## 5. Deployment Guide (`docs/06_deployment_guide.md`) Refinements

*   **Context:** Update the deployment guide to reflect all the codebase changes, remove deprecated service steps, and clarify procedures.
*   [x] **Step 5.1 (Ref 1.2):** In Section 4.1, change `cd services/database` to `cd services/database-service`.
*   [x] **Step 5.2 (Ref 2.4):** Add a sentence within Section 4.1 (Database Service deployment) or near the start of Section 4 stating that database migrations (`prisma migrate deploy`) are run automatically when the `database-service` container starts.
*   [x] **Step 5.3 (Ref 3.3):** Modify Section 4.2 (Interview Analysis Service deployment) to fetch the `database-service` URL and pass it as a substitution:
    ```bash
    # 2. Interview Analysis Service
    # Get the deployed Database Service URL
    DATABASE_URL=$(gcloud run services describe database-service --platform managed --region $REGION --format='value(status.url)' --project $PROJECT_ID) # Ensure service name is correct

    cd ../interview_analysis
    gcloud builds submit --config=cloudbuild.yaml \
      --substitutions=_DATABASE_API_URL=$DATABASE_URL \
      --project $PROJECT_ID
    ```
*   [x] **Step 5.4:** Review Section 4.4 (API Gateway deployment) and Section 6 (Post-Deployment: Final CORS Update).
    *   [x] Ensure the command in 4.4 passes the correct Vercel production URL via `--substitutions=_CORS_ORIGINS=https://your-prod.vercel.app`. Update the example command if needed.
    *   [x] Clarify in the text that setting `CORS_ORIGINS` during the build via substitution is the recommended approach.
    *   [x] Remove or significantly revise Section 6, as the manual CORS update should no longer be the primary method. It could briefly mention how to update it manually *if* absolutely necessary post-deployment.
*   [x] **Step 5.5:** Remove all references and deployment steps related to `sprint1-deprecated`:
    *   [x] Remove `sprint1-deprecated` from the service account creation list (Section 3.1).
    *   [x] Remove `sprint1-deprecated` from the list of services the API Gateway needs invoke permissions for (Section 3.2 `INVOKER_SERVICES`).
    *   [x] Remove secret creation/access steps related to `openai-api-key` if they were present (Section 3.3 - they weren't, but double-check).
    *   [x] Remove the entire deployment block for `sprint1-deprecated` (Section 4.3). Renumber subsequent sections.
    *   [x] Remove `_SERVICE_SPRINT1_DEPRECATED`