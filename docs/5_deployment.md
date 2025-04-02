# 5. Deployment Guide

This guide explains how to deploy the Navi CFCI project to production using a hybrid cloud approach.

## Development and Deployment Workflow

The Navi CFCI project follows a clear workflow:

1. **Local Development**: Uses Docker Compose for all services
   ```bash
   # Start the entire development environment
   docker compose up
   ```

2. **Testing**: Run tests in the running Docker containers before deployment
   ```bash
   # Run backend tests
   docker exec -it navi_cfci-interview_analysis-1 pytest
   docker exec -it navi_cfci-api_gateway-1 pytest
   docker exec -it navi_cfci-sprint1_deprecated-1 pytest
   
   # Run frontend tests
   docker exec -it navi_cfci-frontend-1 npm test
   docker exec -it navi_cfci-frontend-1 npm run cy:run
   ```

3. **Production Deployment**: Uses the hybrid cloud approach described in this guide

## Deployment Architecture

We use a hybrid cloud approach that leverages the strengths of specialized platforms:

- **Frontend**: Deployed on Vercel (optimized for Next.js)
- **Backend Services**: Deployed on Google Cloud Run (containerized microservices)

```
┌───────────────┐         ┌─────────────────────┐
│               │         │                     │
│   Frontend    │         │    API Gateway      │
│   (Vercel)    │ ─────▶  │   (Cloud Run)       │
│               │         │                     │
└───────────────┘         └─────────────────────┘
                                 │        │
                                 ▼        ▼
               ┌─────────────────────┐  ┌─────────────────────┐
               │                     │  │                     │
               │ Interview Analysis  │  │ Sprint1 Deprecated  │
               │    (Cloud Run)      │  │    (Cloud Run)      │
               │                     │  │                     │
               └─────────────────────┘  └─────────────────────┘
```

## Prerequisites

- Google Cloud account with billing enabled
- Vercel account
- Google Cloud CLI installed and configured
- Git repository with your code

## 1. Backend Deployment (Google Cloud Run)

### Set Up Google Cloud Project

```bash
# Set your project ID
export PROJECT_ID=your-gcp-project-id

# Configure gcloud CLI
gcloud config set project $PROJECT_ID

# Enable required services
gcloud services enable cloudbuild.googleapis.com run.googleapis.com secretmanager.googleapis.com
```

### Store API Keys Securely

```bash
# Store Gemini API key
echo -n "your-gemini-api-key" | \
  gcloud secrets create gemini-api-key --data-file=-

# Store OpenAI API key (if needed)
echo -n "your-openai-api-key" | \
  gcloud secrets create openai-api-key --data-file=-

# Grant service access
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:$PROJECT_ID@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding openai-api-key \
  --member="serviceAccount:$PROJECT_ID@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Deploy Backend Services

First, deploy the individual services:

```bash
# Deploy Interview Analysis Service
cd services/interview_analysis
gcloud builds submit --tag gcr.io/$PROJECT_ID/interview-analysis
gcloud run deploy interview-analysis \
  --image gcr.io/$PROJECT_ID/interview-analysis \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --update-secrets=GEMINI_API_KEY=gemini-api-key:latest

# Deploy Sprint1 Deprecated Service (follow similar steps)
cd ../sprint1_deprecated
gcloud builds submit --tag gcr.io/$PROJECT_ID/sprint1-deprecated
gcloud run deploy sprint1-deprecated \
  --image gcr.io/$PROJECT_ID/sprint1-deprecated \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --update-secrets=OPENAI_API_KEY=openai-api-key:latest
```

Then, deploy the API Gateway service:

```bash
# Get service URLs
INTERVIEW_URL=$(gcloud run services describe interview-analysis --format='value(status.url)')
SPRINT1_URL=$(gcloud run services describe sprint1-deprecated --format='value(status.url)')

# Deploy API Gateway
cd ../api_gateway
gcloud builds submit --tag gcr.io/$PROJECT_ID/api-gateway
gcloud run deploy api-gateway \
  --image gcr.io/$PROJECT_ID/api-gateway \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="SERVICE_INTERVIEW_ANALYSIS=$INTERVIEW_URL,SERVICE_SPRINT1_DEPRECATED=$SPRINT1_URL"
```

Take note of the API Gateway URL, as you'll need it for frontend configuration.

## 2. Frontend Deployment (Vercel)

### Deploy with Vercel Dashboard

1. Log in to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Import Project" and select your GitHub repository
3. Configure the project:
   - Framework Preset: Next.js
   - Root Directory: `frontend`
   - Environment Variables:
     - `NEXT_PUBLIC_API_URL`: Your API Gateway URL from Google Cloud Run
     - `NEXT_PUBLIC_ENV`: `production`
4. Click "Deploy"

### Or Deploy with Vercel CLI

```bash
# Install Vercel CLI if needed
npm install -g vercel

# Navigate to frontend directory
cd frontend

# Login to Vercel
vercel login

# Deploy to production
vercel --prod
```

## 3. Configure CORS

Update the API Gateway to allow requests from your Vercel frontend:

```bash
# Get your Vercel domain (e.g., navi-cfci.vercel.app)
VERCEL_DOMAIN="your-app.vercel.app"

# Update API Gateway CORS settings
gcloud run services update api-gateway \
  --set-env-vars="CORS_ORIGINS=https://$VERCEL_DOMAIN"
```

## 4. Set Up CI/CD with GitHub Actions

For a small team, a simple CI/CD pipeline is sufficient. Here's a practical setup:

1. Create GitHub Secrets for your project:
   - `GCP_PROJECT_ID`: Your Google Cloud project ID
   - `GCP_SA_KEY`: Base64-encoded service account key with deployment permissions
   - `VERCEL_TOKEN`: Vercel API token for deployments

2. Create the GitHub Actions workflow file:

```bash
mkdir -p .github/workflows
touch .github/workflows/deploy.yml
```

3. Add the following content to `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Docker
        uses: docker/setup-buildx-action@v2
      
      - name: Start services
        run: |
          cp .env.example .env
          cp services/api_gateway/.env.example services/api_gateway/.env
          cp services/interview_analysis/.env.example services/interview_analysis/.env
          cp services/sprint1_deprecated/.env.example services/sprint1_deprecated/.env
          cp frontend/.env.example frontend/.env
          docker compose up -d
      
      - name: Run backend tests
        run: |
          docker exec navi_cfci-api_gateway-1 pytest -v
          docker exec navi_cfci-interview_analysis-1 pytest -v
      
      - name: Run frontend tests
        run: |
          docker exec navi_cfci-frontend-1 npm test
  
  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Google Cloud SDK
        uses: google-github-actions/setup-gcloud@v1
        with:
          project_id: ${{ secrets.GCP_PROJECT_ID }}
          service_account_key: ${{ secrets.GCP_SA_KEY }}
      
      - name: Deploy API Gateway
        run: |
          cd services/api_gateway
          gcloud builds submit --tag gcr.io/${{ secrets.GCP_PROJECT_ID }}/api-gateway
          gcloud run deploy api-gateway --image gcr.io/${{ secrets.GCP_PROJECT_ID }}/api-gateway --platform managed --region us-central1 --allow-unauthenticated
      
      # Add similar steps for other services
  
  deploy-frontend:
    needs: deploy-backend
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: ./frontend
          vercel-args: '--prod'
```

This workflow:
- Runs tests to ensure code quality
- Deploys backend services to Google Cloud Run
- Deploys frontend to Vercel
- Only deploys if tests pass

## 5. Testing the Deployment

1. Open your Vercel URL in a browser
2. Verify the frontend can communicate with the backend
3. Upload a test transcript and check that analysis works correctly

## 6. Troubleshooting

- **CORS Issues**: Double-check CORS configuration in API Gateway
- **API Connection Errors**: Verify environment variables and service URLs
- **Deployment Failures**: Check Cloud Build logs or Vercel build logs
- **CI/CD Issues**: Review GitHub Actions logs for specific errors 