# Cloud Run Deployment Lessons

This document summarizes critical lessons learned during our Cloud Run deployment process. It provides guidance for future service deployments and common issues to avoid.

## Key Issues and Solutions

### 1. Cloud Build Substitution Variables

**Issue**: In `cloudbuild.yaml`, comma-separated values caused syntax errors in the `--set-env-vars` flags.

```yaml
# ERROR: This causes "Bad syntax for dict arg" errors
--set-env-vars=CORS_ORIGINS=https://example.com,https://api.example.com
```

**Solution**: Use one of these approaches:
- Escape commas in the substitution value: `https://example.com\\,https://api.example.com`
- Use separate `--set-env-vars` flags for values with special characters
- Use a simpler value without commas for deployment: `https://example.com`

**Best Practice**: Avoid comma-separated environment variables when possible. If needed, handle the splitting in the application code.

### 2. Reserved Environment Variables

**Issue**: Cloud Run reserves certain environment variables like `PORT` and sets them automatically.

```yaml
# ERROR: Will cause "reserved env names" error
--set-env-vars=PORT=8080
```

**Solution**: Never explicitly set reserved variables in `cloudbuild.yaml`. Instead, adapt your application to use these values:

```typescript
// In your application code
const PORT = process.env.PORT || 5001; // Will use Cloud Run's PORT (8080) in production
```

**Reserved Variables**:
- `PORT`: Set to 8080 by default in Cloud Run
- `K_SERVICE`: Service name
- `K_REVISION`: Revision name
- `K_CONFIGURATION`: Configuration name

### 3. Dual Environment Support

**Issue**: Different port requirements between local development (5001) and Cloud Run (8080).

**Solution**: Configure your application to work in both environments without code changes:

1. **Package.json**:
   ```json
   "dev": "PORT=5001 ts-node src/server.ts",
   "start": "node dist/server.js" // No hardcoded PORT
   ```

2. **Dockerfile**:
   ```dockerfile
   # Development stage
   FROM node:20-slim AS development
   # ...
   EXPOSE 5001
   CMD ["npm", "run", "dev"]

   # Production stage
   FROM node:20-slim AS production
   # ...
   EXPOSE 8080
   CMD ["npm", "run", "start"]
   ```

3. **Application Code**:
   ```typescript
   const PORT = process.env.PORT || 5001;
   app.listen(PORT, () => {
     console.log(`Server running on port ${PORT}`);
   });
   ```

### 4. Environment Variables Best Practices

**Issue**: Complex environment variables with special characters (URLs, comma-separated lists) cause syntax errors in Cloud Build deployments.

**Solution**: Follow these best practices for managing environment variables:

1. **Use separate flags for each variable**:
   ```yaml
   # GOOD: One variable per flag
   - '--set-env-vars=DATABASE_API_URL=${_DATABASE_API_URL}'
   - '--set-env-vars=NODE_ENV=${_NODE_ENV}'
   - '--set-env-vars=DEBUG=${_DEBUG}'
   ```
   
   ```yaml
   # BAD: Multiple variables in one flag
   - '--set-env-vars=DATABASE_API_URL=${_DATABASE_API_URL},NODE_ENV=${_NODE_ENV},DEBUG=${_DEBUG}'
   ```

2. **Simplify substitution values**:
   ```yaml
   # GOOD: Clean substitution values
   _DATABASE_API_URL: https://database-service-821475546424.us-central1.run.app
   _NODE_ENV: production
   _DEBUG: "false"  # Quote boolean strings
   ```

3. **For complex URLs or values containing commas**:
   - Use separate environment variables where possible
   - Or handle comma-splitting in application code
   - Use quotes only for boolean strings or numeric strings

4. **Standard pattern for cloudbuild.yaml**:
   ```yaml
   steps:
     # Build and push steps...
     
     # Deploy container image to Cloud Run
     - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
       entrypoint: gcloud
       args:
         - 'run'
         - 'deploy'
         - 'service-name'
         - '--image=gcr.io/$PROJECT_ID/service-name'
         - '--region=us-central1'
         - '--platform=managed'
         - '--service-account=service-name@$PROJECT_ID.iam.gserviceaccount.com'
         - '--set-env-vars=VAR1=${_VAR1}'
         - '--set-env-vars=VAR2=${_VAR2}'
         # More env vars...
         
   substitutions:
     _VAR1: value1
     _VAR2: value2
   ```
   - reference: https://medium.com/google-cloud/effectively-specifying-environment-variables-for-cloud-run-1a64c52ea7f5

### 5. Python FastAPI Production Configuration

**Issue**: FastAPI applications deployed directly with Uvicorn may fail to start properly in Cloud Run with the error: "The user-provided container failed to start and listen on the port defined provided by the PORT=8080 environment variable within the allocated timeout."

**Solution**: Use Gunicorn as a production WSGI server with Uvicorn workers:

1. **Update Dockerfile production target**:
   ```dockerfile
   FROM base AS production
   # Expose Cloud Run's port
   EXPOSE 8080

   # Start with gunicorn as the production server
   CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "2", "--worker-class", "uvicorn.workers.UvicornWorker", "app.main:app", "--timeout", "120", "--access-logfile", "-", "--error-logfile", "-"]
   ```

2. **Include Gunicorn in requirements.txt**:
   ```
   fastapi>=0.110.0
   uvicorn>=0.27.1
   gunicorn>=21.2.0  # Production WSGI HTTP Server
   ```

3. **Configure Cloud Run with adequate resources and timeout**:
   ```yaml
   '--cpu=1'
   '--memory=512Mi'
   '--timeout=600s'  # Longer timeout to allow for container startup
   '--cpu-boost'     # Additional CPU during startup
   ```

4. **Ensure proper logging configuration**:
   - Direct logs to stdout/stderr for Cloud Run to capture them
   - Set LOG_LEVEL environment variable appropriately
   - Add informative startup logging to diagnose issues

**Best Practice**: Always use Gunicorn with Uvicorn workers for FastAPI applications in production environments like Cloud Run.

### 6. Container Start Timeout

**Issue**: Containers failing to start within the default timeout period.

**Solution**: Increase the timeout and allocate more resources:

```yaml
--timeout=300s
--cpu=1
--memory=512Mi
```

**Best Practice**: Enable debug mode during initial deployments for better logs:

```yaml
--set-env-vars=DEBUG=true
```

### 7. Service Authentication

**Issue**: By default, Cloud Run services are public if deployed with `--allow-unauthenticated`.

**Solution**:
- Use `--no-allow-unauthenticated` for internal services (like database)
- Use `--allow-unauthenticated` only for publicly accessible services (like API gateway)

## Deployment Checklist

For each service deployment, verify these settings in `cloudbuild.yaml`:

✅ No explicit setting of reserved environment variables (especially PORT)  
✅ Production environment: `NODE_ENV=production`  
✅ Appropriate authentication based on service visibility  
✅ Sufficient timeout and resource allocation  
✅ Proper target selection in Dockerfile (production vs development)  
✅ CORS properly configured for your environment  
✅ Secrets properly accessed via Secret Manager  

## Service Deployment Order

Deploying microservices to Cloud Run requires careful sequencing to ensure proper service-to-service communication. Follow this order:

1. **Database Service**
   ```bash
   gcloud builds submit services/database --config=services/database/cloudbuild.yaml
   ```
   
   After deployment, note the URL: `https://database-service-xxxxx-uc.a.run.app`

2. **Update Dependent Services**
   Update the database URL in subsequent deployments:
   ```bash
   # Update Interview Analysis cloudbuild.yaml
   _DATABASE_API_URL: https://database-service-xxxxx-uc.a.run.app
   ```

3. **Interview Analysis Service**
   ```bash
   gcloud builds submit services/interview_analysis --config=services/interview_analysis/cloudbuild.yaml
   ```
   
   Note the URL: `https://interview-analysis-xxxxx-uc.a.run.app`

4. **Sprint1 Deprecated Service**
   ```bash
   gcloud builds submit services/sprint1_deprecated --config=services/sprint1_deprecated/cloudbuild.yaml
   ```
   
   Note the URL: `https://sprint1-deprecated-xxxxx-uc.a.run.app`

5. **Update API Gateway**
   Update service URLs in API Gateway cloudbuild.yaml:
   ```yaml
   _SERVICE_INTERVIEW_ANALYSIS: https://interview-analysis-xxxxx-uc.a.run.app
   _SERVICE_DATABASE: https://database-service-xxxxx-uc.a.run.app
   ```

6. **API Gateway Service**
   ```bash
   gcloud builds submit services/api_gateway --config=services/api_gateway/cloudbuild.yaml
   ```
   
   Note the URL: `https://api-gateway-xxxxx-uc.a.run.app`

7. **Update Frontend**
   Update the frontend environment variables in Vercel:
   ```
   NEXT_PUBLIC_API_URL=https://api-gateway-xxxxx-uc.a.run.app
   ```

8. **Configure IAM Permissions**
   Set up service-to-service communication permissions:
   ```bash
   # Allow API Gateway to invoke Interview Analysis
   gcloud run services add-iam-policy-binding interview-analysis \
     --member="serviceAccount:api-gateway@PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/run.invoker" \
     --region=us-central1
     
   # Similar commands for other service connections
   ```

## Reference

```yaml
# Example of a properly configured Cloud Run deployment
steps:
  # Build and push steps omitted for brevity
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'service-name'
      - '--image=gcr.io/$PROJECT_ID/service-name'
      - '--region=us-central1'
      - '--platform=managed'
      - '--service-account=service-name@$PROJECT_ID.iam.gserviceaccount.com'
      - '--no-allow-unauthenticated'  # or --allow-unauthenticated for public services
      - '--set-env-vars=NODE_ENV=production'
      - '--set-env-vars=DEBUG=false'
      - '--set-env-vars=CORS_ORIGINS=https://your-domain.com'
      - '--update-secrets=DATABASE_URL=database-connection-string:latest'
      - '--cpu=1'
      - '--memory=512Mi'
      - '--timeout=300s'
      - '--min-instances=0'
      - '--max-instances=2'
``` 