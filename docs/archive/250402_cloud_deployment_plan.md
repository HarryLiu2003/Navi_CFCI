# Cloud Run Deployment Implementation Plan

This document outlines the step-by-step process for deploying the Navi CFCI platform to Google Cloud Run with proper IAM, authentication, and CORS configuration.

## Preparation Checklist

- [x] Review current codebase and architecture
- [x] Ensure local Docker setup works correctly
- [x] Verify access to Google Cloud project
- [x] Have Vercel account ready for frontend deployment

## Phase 1: Google Cloud Setup

### 1.1 Project & Environment Setup

- [x] Set up Google Cloud project (created: `navi-cfci-project`)
```bash
# Set project ID variable
export PROJECT_ID=navi-cfci-project
# Configure gcloud CLI
gcloud config set project $PROJECT_ID
```
- [x] Enable required APIs
```bash
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com \
  artifactregistry.googleapis.com
```
- [ ] Create artifact repository (optional, can use Container Registry instead)
```bash
gcloud artifacts repositories create navi-cfci \
  --repository-format=docker \
  --location=us-central1 \
  --description="Navi CFCI container repository"
```

### 1.2 Service Accounts Creation

- [x] Create service account for Database Service
```bash
gcloud iam service-accounts create database-service \
  --display-name="Database Service Account"
```
- [x] Create service account for API Gateway
```bash
gcloud iam service-accounts create api-gateway \
  --display-name="API Gateway Service Account"
```
- [x] Create service account for Interview Analysis
```bash
gcloud iam service-accounts create interview-analysis \
  --display-name="Interview Analysis Service Account"
```

### 1.3 IAM Permissions Assignment

- [x] Grant API Gateway permission to invoke other services
```bash
# Allow API Gateway to invoke Interview Analysis
gcloud run services add-iam-policy-binding interview-analysis \
  --member="serviceAccount:api-gateway@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --region=us-central1

# Allow API Gateway to invoke Database Service
gcloud run services add-iam-policy-binding database-service \
  --member="serviceAccount:api-gateway@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --region=us-central1

# Allow public access to API Gateway
gcloud beta run services add-iam-policy-binding api-gateway \
  --member=allUsers \
  --role=roles/run.invoker \
  --region=us-central1
```
- [x] Grant Interview Analysis permission to invoke Database Service
```bash
# Allow Interview Analysis to invoke Database Service
gcloud run services add-iam-policy-binding database-service \
  --member="serviceAccount:interview-analysis@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --region=us-central1
```

For a detailed explanation of our security architecture, including the reasoning behind public/private service configuration and authentication mechanisms, see the [Cloud Run IAM and Routing Implementation Guide](cloud_run_iam_routing.md#security-architecture-quick-reference).

### 1.4 Secret Manager Setup

- [x] Create shared JWT secret for authentication
```bash
# Using existing NextAuth secret (used in the frontend)
echo -n "your-existing-nextauth-secret" | gcloud secrets create nextauth-jwt-secret --data-file=-
```
- [x] Create Gemini API key secret
```bash
# Store the Gemini API key as a secret (AIzaSyBoqaOcemS7UrKgP3JjpnKPkCKk4T2DPOg)
echo -n "AIzaSyBoqaOcemS7UrKgP3JjpnKPkCKk4T2DPOg" | gcloud secrets create gemini-api-key --data-file=-
```
- [x] Create Supabase database connection string secret
```bash
# Store the Supabase connection string as a secret
echo -n "postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres" | gcloud secrets create database-connection-string --data-file=-
```
- [x] Grant service accounts access to secrets
```bash
# Grant API Gateway access to JWT secret
gcloud secrets add-iam-policy-binding nextauth-jwt-secret \
  --member="serviceAccount:api-gateway@navi-cfci-project.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Grant Interview Analysis access to Gemini API key
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:interview-analysis@navi-cfci-project.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Grant Database Service access to database connection string
gcloud secrets add-iam-policy-binding database-connection-string \
  --member="serviceAccount:database-service@navi-cfci-project.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## Phase 2: Code Updates for Cloud Run

### 2.1 Interview Analysis Service Updates

- [x] Create authentication utility (`app/utils/cloud_auth.py`)
```python
"""
Utility for Cloud Run service-to-service authentication.
"""
import os
import logging
import httpx
import google.auth
import google.auth.transport.requests
from typing import Dict, Any, Optional

# Implementation contains authenticated service call method that works in both
# production (Cloud Run) and development environments.
```

- [x] Update repository to use Cloud authentication (`app/services/storage/repository.py`)
```python
# Added import
from ...utils.cloud_auth import call_authenticated_service

# Updated store_interview method to use authenticated calls
# This method now uses call_authenticated_service instead of direct httpx calls
```

- [x] Update dependencies in requirements.txt
```
# Added Google Auth libraries
google-auth>=2.22.0
google-cloud-core>=2.3.2
```

### 2.2 Database Service Updates

- [x] Update CORS configuration to use environment variables
```typescript
// Before: Hardcoded CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  // other hardcoded origins...
];

// After: Environment-based CORS configuration
const corsOrigins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : [
  // Default fallback origins if not specified
  'http://localhost:3000',
  // other default origins...
];
```
- [x] Improve CORS implementation with environment-specific defaults
```typescript
// Define default origins by environment
const defaultOrigins = {
  development: [
    'http://localhost:3000',         // Frontend (local)
    // other development origins...
  ],
  production: [
    'https://navi-cfci.vercel.app',  // Vercel frontend
    // other production origins...
  ]
};

// Use environment-specific defaults or environment variable
const corsOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
  : isProduction 
    ? defaultOrigins.production
    : [...defaultOrigins.development, ...defaultOrigins.production];
```
- [x] Update cloudbuild.yaml to include CORS_ORIGINS environment variable
```yaml
# Added to cloudbuild.yaml
- '--set-env-vars=CORS_ORIGINS=${_CORS_ORIGINS}'
- '--set-env-vars=DEBUG=${_DEBUG}'

# Added substitutions section
substitutions:
  _CORS_ORIGINS: "https://navi-cfci.vercel.app,https://api-gateway-navi-cfci-project-uc.a.run.app"
  _DEBUG: "false"  # Set to "true" for debug mode
```
- [x] Ensure the Prisma connection pooling configuration is correct

### 2.3 API Gateway Updates

- [x] Standardize CORS configuration to match database service
```python
# Configure CORS based on environment
is_production = os.getenv("NODE_ENV", "development") == "production"
is_development = not is_production

# Define default origins by environment and use consistent approach
cors_origins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
  : isProduction 
    ? defaultOrigins.production
    : [...defaultOrigins.development, ...defaultOrigins.production];
```
- [x] Update cloudbuild.yaml with consistent environment variables
```yaml
# Added to cloudbuild.yaml
- '--set-env-vars=NODE_ENV=${_NODE_ENV}'
- '--set-env-vars=DEBUG=${_DEBUG}'

# Added to substitutions
_NODE_ENV: production
_DEBUG: "false"
```

## Phase 3: Cloud Build Configuration

### 3.1 Database Service Deployment

- [x] Create Cloud Build configuration (`services/database/cloudbuild.yaml`)
```yaml
# Configuration created with steps for building, pushing to Container Registry, and deploying to Cloud Run.
# Uses Secret Manager for DATABASE_URL instead of build substitutions
# Uses environment variables for CORS configuration
# Service is deployed with --no-allow-unauthenticated for security.
```

- [x] Trigger build and deploy
```bash
# Simple deployment command - substitution for CORS origins can be overridden if needed
gcloud builds submit services/database --config=services/database/cloudbuild.yaml

# Alternatively, override the CORS origins for different environments
gcloud builds submit services/database --config=services/database/cloudbuild.yaml \
  --substitutions=_CORS_ORIGINS="https://staging.domain.com,https://api-staging.domain.com"
```

### 3.2 Interview Analysis Service Deployment

- [x] Create Cloud Build configuration (`services/interview_analysis/cloudbuild.yaml`)
```yaml
# Configuration created with steps for building, pushing to Container Registry, and deploying to Cloud Run.
# Includes the GEMINI_API_KEY secret and DATABASE_API_URL environment variable.
# Service is deployed with --no-allow-unauthenticated for security.
```

- [x] Trigger build and deploy
```bash
gcloud builds submit services/interview_analysis --config=services/interview_analysis/cloudbuild.yaml
```

### 3.3 API Gateway Deployment

- [x] Create Cloud Build configuration (`services/api_gateway/cloudbuild.yaml`)
```yaml
# Configuration created with steps for building, pushing to Container Registry, and deploying to Cloud Run.
# Includes JWT_SECRET from Secret Manager and environment variables for services and CORS.
# Service is deployed with --allow-unauthenticated since it's publicly accessible.
```

- [x] Trigger build and deploy
```bash
gcloud builds submit services/api_gateway --config=services/api_gateway/cloudbuild.yaml
```

### 3.4 Consistent Environment Variables

All services now use a consistent set of environment variables:
- `NODE_ENV`: Determines production vs. development mode
- `DEBUG`: Enables/disables additional logging
- `CORS_ORIGINS`: Comma-separated list of allowed origins
- `LOG_LEVEL`: Controls logging verbosity

This provides several benefits:
- Services behave consistently across environments
- Environment-specific configuration without code changes
- Simplified debugging with the DEBUG flag
- Origin configuration is validated and trimmed consistently

### 3.5 Standardized Cloud Build Configuration

All service `cloudbuild.yaml` files now follow the same pattern:

```yaml
steps:
  # Build and push steps...
  
  # Deploy container image to Cloud Run with consistent settings
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    args:
      - '--set-env-vars=NODE_ENV=${_NODE_ENV}'
      - '--set-env-vars=DEBUG=${_DEBUG}'
      - '--set-env-vars=LOG_LEVEL=${_LOG_LEVEL}'
      - '--set-env-vars=CORS_ORIGINS=${_CORS_ORIGINS}'
      - '--cpu=1'
      - '--memory=512Mi'
      - '--timeout=600s'
      - '--cpu-boost'
      # Service-specific settings...

# Default substitutions section in all files
substitutions:
  _NODE_ENV: production
  _DEBUG: "false"
  _LOG_LEVEL: INFO
  _CORS_ORIGINS: https://navi-cfci.vercel.app
  # Service-specific values...
```

This standardization ensures:
- Consistent deployment behavior across all services
- Enhanced reliability with proper timeout and resource settings
- Simplified troubleshooting with consistent logging configuration
- Easy configuration changes through substitution variables

### 3.6 Environment Variable Escaping in Cloud Build

When using comma-separated values in Cloud Build substitutions, they must be escaped correctly:

```yaml
# INCORRECT - Will cause syntax errors in Cloud Build
substitutions:
  _CORS_ORIGINS: "https://example.com,https://api.example.com"

# CORRECT - Properly escaped commas in substitution variables
substitutions:
  _CORS_ORIGINS_ESCAPED: "https://example.com\\,https://api.example.com"
```

**Problem Solved**: We've adopted the approach of using separate `--set-env-vars` flags for each environment variable and simplified values where possible to avoid escaping issues.

### 3.7 Port Configuration for Development vs Production

Our services have been configured to work seamlessly in both environments:

1. **Local Development (Docker Compose)**
   - Development ports: 5001 (database), 8001 (interview_analysis), 8000 (api_gateway)
   - Development Dockerfile targets expose these ports
   - Development commands use explicit port settings

2. **Cloud Run Deployment**
   - All services use port 8080 (Cloud Run standard)
   - Production Dockerfile targets: `EXPOSE 8080`
   - Cloud Run sets PORT=8080 automatically
   - Services use Gunicorn with Uvicorn workers for FastAPI applications
   - IMPORTANT: Do not explicitly set the PORT environment variable in cloudbuild.yaml as it's reserved and automatically set by Cloud Run

### 3.8 Cloud Run Deployment Lessons

For a comprehensive guide to Cloud Run deployment best practices and common issues encountered during our deployment, see [Cloud Run Deployment Lessons](cloud_run_deployment_lessons.md).

Key areas covered in the lessons:
- Cloud Build substitution variables and special character handling
- Reserved environment variables in Cloud Run
- Dual environment support (development vs. production)
- Container startup timeout management
- Service authentication considerations
- Python FastAPI production configuration with Gunicorn

**When deploying other services**: Review the deployment checklist in the lessons document to avoid common pitfalls.

## Phase 4: Frontend Deployment

### 4.1 Frontend Vercel Configuration

- [x] Configure NextAuth secret
  - Manually add `NEXTAUTH_SECRET` in Vercel project settings with value from Secret Manager
  - Must match `JWT_SECRET` in API Gateway

- [x] Configure API endpoint
  - Add `NEXT_PUBLIC_API_URL` in Vercel project settings
  - Set to API Gateway URL from Cloud Run deployment (https://api-gateway-821475546424.us-central1.run.app)
  - IMPORTANT: All backend requests are routed through the API Gateway, not directly to services

- [x] Remove unused environment variables
  - Previous versions may have used `DATABASE_API_URL` to connect directly to the database service
  - This is no longer needed as all database access goes through the API Gateway
  - Direct service-to-service communication is handled with authenticated calls

- [ ] Deploy frontend to Vercel
  - Connect GitHub repository
  - Configure settings in Vercel dashboard
  - Deploy from `frontend` directory

## Phase 5: Testing & Validation

### 5.1 End-to-End Testing

- [ ] Test user registration/login
- [ ] Test uploading a transcript
- [ ] Verify analysis results are stored and retrieved correctly
- [ ] Test with different user accounts to ensure data isolation

### 5.2 Security Validation

- [ ] Verify private services (Database, Interview Analysis) reject unauthenticated requests
- [ ] Test API Gateway authentication with valid/invalid tokens
- [ ] Check CORS behavior with allowed/disallowed origins

### 5.3 IAM Requirements

For proper service-to-service communication in Cloud Run, the following IAM bindings are required:

1. **API Gateway → Interview Analysis**
   ```bash
   gcloud run services add-iam-policy-binding interview-analysis \
     --member=serviceAccount:api-gateway@PROJECT_ID.iam.gserviceaccount.com \
     --role=roles/run.invoker \
     --region=us-central1
   ```

2. **Interview Analysis → Database**
   ```bash
   gcloud run services add-iam-policy-binding database-service \
     --member=serviceAccount:interview-analysis@PROJECT_ID.iam.gserviceaccount.com \
     --role=roles/run.invoker \
     --region=us-central1
   ```

These permissions ensure that:
- API Gateway can make authenticated calls to the Interview Analysis service
- Interview Analysis service can make authenticated calls to the Database service
- Each service respects the authentication boundaries in our security architecture

Without these explicit permissions, even with proper authentication code implementation, services will receive 401/403 errors when attempting to communicate.

## Phase 6: CI/CD Setup (Optional)

- [ ] Create GitHub Actions workflow for continuous deployment
- [ ] Add triggers for specific branch commits
- [ ] Configure secrets for CI/CD in GitHub repository 