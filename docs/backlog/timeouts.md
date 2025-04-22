Timeout and Resource Configuration

Proper timeout and resource configuration is critical for API Gateway and Interview Analysis services, especially when processing large transcripts or handling multiple concurrent requests.

### 7.1. Cloud Run Service Timeouts and Resources

Cloud Run services have default limits that may need adjustment:

```bash
export PROJECT_ID="$(gcloud config get-value project)"
export REGION="us-central1"

# API Gateway - Increase timeout and memory
gcloud run services update api-gateway \
  --timeout=300 \
  --memory=1Gi \
  --region=$REGION \
  --project=$PROJECT_ID

# Interview Analysis - Longer timeout for transcript processing
gcloud run services update interview-analysis \
  --timeout=1800 \
  --memory=1Gi \
  --region=$REGION \
  --project=$PROJECT_ID

# Database Service - Standard settings are usually sufficient
gcloud run services update database-service \
  --timeout=300 \
  --memory=512Mi \
  --region=$REGION \
  --project=$PROJECT_ID
```

**Recommended Settings:**
* **API Gateway:** 300s timeout, 1Gi memory - handles request routing and authentication
* **Interview Analysis:** 1800s (30min) timeout, 1Gi memory - for processing large transcripts
* **Database Service:** 300s timeout, 512Mi memory - for database operations

### 7.2. Vercel Function Timeouts (Frontend)

For the Vercel deployment, create or update `frontend/vercel.json` to increase the timeout for serverless functions:

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "regions": ["sfo1"],
  "functions": {
    "src/app/api/**/*": {
      "memory": 1024,
      "maxDuration": 60
    }
  }
}
```

This configuration:
* Increases API route timeouts to 60 seconds (from 10s default)
* Allocates 1GB of memory for serverless functions (from 128MB default)
* Applies to all API routes in the Next.js App Router

Redeploy the frontend after making these changes:

```bash
cd frontend
vercel --prod
```

**Note:** If you're experiencing timeout issues with transcript analysis, ensure all services in the request chain have sufficient timeouts configured. The default Vercel function timeout of 10 seconds is often too short for complex operations.