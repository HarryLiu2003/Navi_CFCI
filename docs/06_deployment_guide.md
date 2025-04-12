# Deployment Guide: Navi CFCI Platform

This guide provides comprehensive instructions for deploying the Navi CFCI platform, covering both backend services on Google Cloud Run and the frontend on Vercel.

## 1. Architecture Overview

Navi CFCI employs a hybrid deployment model:

*   **Frontend:** Next.js application deployed to **Vercel** for optimized web delivery.
*   **Backend:** Python/FastAPI microservices containerized and deployed to **Google Cloud Run**.
*   **API Gateway:** A dedicated Cloud Run service acts as the single entry point for the frontend, routing requests to appropriate backend services.
*   **Database:** PostgreSQL managed via Prisma, hosted on **Supabase** (or another provider), accessed via the Database Service.

```mermaid
graph LR
    User[User Browser] --> FE(Frontend - Vercel);
    FE -->|HTTPS API Calls| APIGW(API Gateway - Cloud Run);
    APIGW -->|IAM Auth/HTTP| IA(Interview Analysis - Cloud Run);
    APIGW -->|IAM Auth/HTTP| DB(Database Service - Cloud Run);
    IA -->|IAM Auth/HTTP| DB;
    DB -->|SQL| PG[(Supabase/Postgres)];
```

*   **Authentication:**
    *   User auth via NextAuth (JWT strategy) handled by Frontend & validated by API Gateway.
    *   Service-to-service auth via Google Cloud IAM (OIDC tokens) for Cloud Run communication.
*   **Security:** Backend services (except API Gateway) are configured with `--no-allow-unauthenticated`.

(See [architecture.md](architecture.md) and [authentication.md](authentication.md) for more details).

## 2. Prerequisites

*   **Google Cloud:**
    *   GCP Project created with Billing enabled.
    *   `gcloud` CLI installed and authenticated (`gcloud auth login`, `gcloud config set project YOUR_PROJECT_ID`).
    *   APIs enabled: Cloud Build (`cloudbuild.googleapis.com`), Cloud Run (`run.googleapis.com`), Secret Manager (`secretmanager.googleapis.com`), IAM (`iam.googleapis.com`).
*   **Vercel:**
    *   Vercel Account.
    *   `vercel` CLI installed and logged in (`npm install -g vercel`, `vercel login`).
    *   Project linked to your Git repository.
*   **Database:**
    *   A running PostgreSQL instance (e.g., Supabase). Connection string required.
*   **Secrets:**
    *   Google Gemini API Key.
    *   A securely generated secret string for JWT signing (`NEXTAUTH_SECRET`/`JWT_SECRET`).
*   **Local:**
    *   Git repository cloned.
    *   Docker & Docker Compose (for building/local testing).

## 3. Google Cloud Setup

*(Run these commands from your local terminal configured with gcloud)*

### 3.1. Service Accounts

Create dedicated service accounts for each Cloud Run service:

```bash
export PROJECT_ID="$(gcloud config get-value project)"

gcloud iam service-accounts create api-gateway --display-name "Navi API Gateway Service Account" --project $PROJECT_ID
gcloud iam service-accounts create interview-analysis --display-name "Navi Interview Analysis Service Account" --project $PROJECT_ID
gcloud iam service-accounts create database-service --display-name "Navi Database Service Account" --project $PROJECT_ID
```

### 3.2. IAM Permissions

Grant necessary roles to service accounts:

```bash
# API Gateway needs to invoke other services
INVOKER_SERVICES=("interview-analysis" "database-service")
API_GATEWAY_SA="serviceAccount:api-gateway@${PROJECT_ID}.iam.gserviceaccount.com"
for SERVICE in "${INVOKER_SERVICES[@]}"; do
  gcloud run services add-iam-policy-binding $SERVICE \\
    --member=$API_GATEWAY_SA \\
    --role="roles/run.invoker" \\
    --region=us-central1 --platform=managed --project $PROJECT_ID
done

# Interview Analysis needs to invoke Database Service
INTERVIEW_ANALYSIS_SA="serviceAccount:interview-analysis@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud run services add-iam-policy-binding database-service \\
  --member=$INTERVIEW_ANALYSIS_SA \\
  --role="roles/run.invoker" \\
  --region=us-central1 --platform=managed --project $PROJECT_ID

# Interview Analysis needs access to AI Platform (if applicable for Gemini calls via library)
# Note: If calling Gemini REST API directly, this might not be needed.
# Check Gemini client library documentation for required permissions.
# gcloud projects add-iam-policy-binding $PROJECT_ID \\
#  --member=$INTERVIEW_ANALYSIS_SA \\
#  --role="roles/aiplatform.user"

# Database service might need Cloud SQL client role if using Cloud SQL
# gcloud projects add-iam-policy-binding $PROJECT_ID \\
#  --member="serviceAccount:database-service@${PROJECT_ID}.iam.gserviceaccount.com" \\
#  --role="roles/cloudsql.client"
```

### 3.3. Secret Manager

Store sensitive information securely:

```bash
# Ensure you have a secure, persistent secret for JWTs
YOUR_JWT_SECRET="$(openssl rand -hex 32)" # Generate a new one if needed
echo "Your JWT Secret (save this securely): ${YOUR_JWT_SECRET}"

echo -n "${YOUR_JWT_SECRET}" | \
  gcloud secrets create nextauth-jwt-secret --data-file=- --project $PROJECT_ID

# Store Gemini Key
YOUR_GEMINI_KEY="your-actual-gemini-api-key"
echo -n "${YOUR_GEMINI_KEY}" | \
  gcloud secrets create gemini-api-key --data-file=- --project $PROJECT_ID

# Store Database Connection String (Transaction Pooler - Port 6543)
# Used by services at runtime
YOUR_DATABASE_URL="postgresql://postgres.user:password@db.host.supabase.co:6543/postgres"
echo -n "${YOUR_DATABASE_URL}" | \
  gcloud secrets create database-connection-string --data-file=- --project $PROJECT_ID

# Store Database Migration Connection String (Session Pooler / Direct Connection - Port 5432)
# Used ONLY by database-service during startup migrations
YOUR_MIGRATE_DATABASE_URL="postgresql://postgres.user:password@db.host.supabase.co:5432/postgres"
echo -n "${YOUR_MIGRATE_DATABASE_URL}" | \
  gcloud secrets create migrate-database-connection-string --data-file=- --project $PROJECT_ID

# Grant Service Accounts access to the secrets they need
API_GATEWAY_SA="serviceAccount:api-gateway@${PROJECT_ID}.iam.gserviceaccount.com"
INTERVIEW_ANALYSIS_SA="serviceAccount:interview-analysis@${PROJECT_ID}.iam.gserviceaccount.com"
DATABASE_SA="serviceAccount:database-service@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud secrets add-iam-policy-binding nextauth-jwt-secret \\
  --member=$API_GATEWAY_SA \\
  --role="roles/secretmanager.secretAccessor" --project $PROJECT_ID

gcloud secrets add-iam-policy-binding gemini-api-key \\
  --member=$INTERVIEW_ANALYSIS_SA \\
  --role="roles/secretmanager.secretAccessor" --project $PROJECT_ID

gcloud secrets add-iam-policy-binding database-connection-string \\
  --member=$DATABASE_SA \\
  --role="roles/secretmanager.secretAccessor" --project $PROJECT_ID

gcloud secrets add-iam-policy-binding migrate-database-connection-string \\
  --member=$DATABASE_SA \\
  --role="roles/secretmanager.secretAccessor" --project $PROJECT_ID
```

## 4. Backend Deployment (Cloud Run via Cloud Build)

We use Cloud Build (`cloudbuild.yaml` files within each service directory) to build and deploy container images to Cloud Run.

**Deployment Order is Important:** Deploy services that others depend on first.
**Note on Migrations:** The `database-service` is configured to automatically run database migrations (`prisma migrate deploy`) using the `MIGRATE_DATABASE_URL` during its container startup process.

```bash
export PROJECT_ID="$(gcloud config get-value project)"
export REGION="us-central1" # Or your preferred region

# 1. Database Service (No public access)
cd services/database-service
gcloud builds submit --config=cloudbuild.yaml --project $PROJECT_ID
# Wait for deployment to complete before proceeding.

# 2. Interview Analysis Service (Depends on Database Service URL)
DATABASE_URL=$(gcloud run services describe database-service --platform managed --region $REGION --format='value(status.url)' --project $PROJECT_ID)

cd ../interview_analysis
gcloud builds submit --config=cloudbuild.yaml \\
  --substitutions=_DATABASE_API_URL=$DATABASE_URL \\
  --project $PROJECT_ID
# Wait for deployment to complete before proceeding.

# 3. API Gateway (Needs URLs of other services & CORS Origin)
INTERVIEW_URL=$(gcloud run services describe interview-analysis --platform managed --region $REGION --format='value(status.url)' --project $PROJECT_ID)
DATABASE_SVC_URL=$(gcloud run services describe database-service --platform managed --region $REGION --format='value(status.url)' --project $PROJECT_ID)

VERCEL_PROD_URL="https://your-project-name.vercel.app" # Or your custom domain

cd ../api_gateway
gcloud builds submit --config=cloudbuild.yaml \\
  --substitutions=_SERVICE_INTERVIEW_ANALYSIS=$INTERVIEW_URL,_SERVICE_DATABASE=$DATABASE_SVC_URL,_CORS_ORIGINS=$VERCEL_PROD_URL \\
  --project $PROJECT_ID

API_GATEWAY_URL=$(gcloud run services describe api-gateway --platform managed --region $REGION --format='value(status.url)' --project $PROJECT_ID)
echo "API Gateway Deployed URL: ${API_GATEWAY_URL}"

cd ../.. # Back to project root
```

## 5. Frontend Deployment (Vercel)

Deploy the Next.js frontend using Vercel.

### Environment Variables in Vercel:

Ensure the following Environment Variables are set in your Vercel project settings (link to Secret Manager where possible, otherwise copy values securely):

*   `NEXTAUTH_SECRET`: **Must match** the value stored in the `nextauth-jwt-secret` Google Secret Manager secret.
*   `NEXTAUTH_URL`: Your **primary production frontend URL** (e.g., `https://your-domain.com` or `https://your-project.vercel.app`). **Must match** the URL provided for `_CORS_ORIGINS` during the API Gateway deployment.
*   `NEXT_PUBLIC_API_URL`: The **API Gateway URL** obtained from the previous deployment step (e.g., `https://api-gateway-....run.app`).
*   `NODE_ENV`: Set to `production`.
*   `DATABASE_URL`: The **Transaction Pooler** database connection string (link to `database-connection-string` secret). Required by NextAuth Prisma Adapter.

### Deploy Command:

```bash
cd frontend
vercel --prod
```

## 6. Post-Deployment CORS Check (Optional)

The recommended way to set Cross-Origin Resource Sharing (CORS) for the API Gateway is by providing the Vercel production URL via the `_CORS_ORIGINS` substitution during the `gcloud builds submit` command (as shown in Section 4.3).

If you need to verify or update the `CORS_ORIGINS` environment variable on the API Gateway *after* deployment (e.g., if your Vercel URL changed), you can use the following commands. Be careful when updating not to overwrite other variables.

```bash
export PROJECT_ID="$(gcloud config get-value project)"
export REGION="us-central1"
NEW_VERCEL_DOMAIN="your-project-name.vercel.app" # Or your custom domain

# Check current vars
gcloud run services describe api-gateway --platform managed --region $REGION --format='value(spec.template.spec.containers[0].env)' --project $PROJECT_ID

# Example to UPDATE (combines new value with existing non-CORS vars)
# CURRENT_ENV_VARS=$(gcloud run services describe api-gateway --platform managed --region $REGION --format='json' --project $PROJECT_ID | jq -r '.spec.template.spec.containers[0].env[] | select(.name != "CORS_ORIGINS") | .name + "=" + .value' | paste -sd,)
# gcloud run services update api-gateway \\
#  --update-env-vars="CORS_ORIGINS=https://${NEW_VERCEL_DOMAIN},${CURRENT_ENV_VARS}" \\
#  --region=$REGION --platform=managed --project $PROJECT_ID
```

## 7. CI/CD (Optional)

Consider setting up GitHub Actions (or similar) to automate testing and deployment on pushes to the main branch. See `docs/5_deployment.md` (original file) for a sample GitHub Actions workflow outline (requires secrets configuration in GitHub).

## 8. Environment Variables Summary

Refer to the `.env.example` file in each service/frontend directory for specific variables. Key variables for production include:

*   **Frontend (Vercel):** `NEXTAUTH_SECRET` (from Secret Mgr), `NEXTAUTH_URL` (Primary Prod URL), `NEXT_PUBLIC_API_URL` (API Gateway URL), `NODE_ENV=production`, `DATABASE_URL` (Transaction Pooler from Secret Mgr).
*   **API Gateway (Cloud Run):** `JWT_SECRET` (from Secret Mgr), `SERVICE_DATABASE`, `SERVICE_INTERVIEW_ANALYSIS` (Cloud Run URLs injected via build), `CORS_ORIGINS` (Vercel URL injected via build), `NODE_ENV=production`, `DEBUG=false`, `ENABLE_DEV_AUTH=false`.
*   **Interview Analysis (Cloud Run):** `GEMINI_API_KEY` (from Secret Mgr), `DATABASE_API_URL` (Cloud Run URL injected via build), `NODE_ENV=production`.
*   **Database Service (Cloud Run):** `DATABASE_URL` (Transaction Pooler from Secret Mgr `database-connection-string`), `MIGRATE_DATABASE_URL` (Session Pooler from Secret Mgr `migrate-database-connection-string`), `NODE_ENV=production`.