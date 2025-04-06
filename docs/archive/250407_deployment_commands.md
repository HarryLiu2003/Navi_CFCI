# Deployment Command Checklist - 2025-04-07

**Goal:** Provide a step-by-step command checklist for deploying the Navi CFCI platform to Google Cloud Run and Vercel, based on the setup finalized on 2025-04-07.

**Project ID:** `YOUR_PROJECT_ID` # Placeholder
**Region:** `us-central1` # Or your preferred region

---

## 0. Initial Google Cloud CLI Setup (Run Once)

*   [ ] Log in to Google Cloud CLI:
    ```bash
    gcloud auth login
    ```
    *(Follow the browser-based authentication flow)*

*   [ ] Create project (If not already created):
    ```bash
    # gcloud projects create YOUR_PROJECT_ID --name="Your Project Name"
    ```

*   [ ] Set the active Google Cloud project:
    ```bash
    gcloud config set project YOUR_PROJECT_ID
    ```

---

## 1. Environment Setup (Run Once per Session)

*   [ ] Set environment variables in your terminal session:
    ```bash
    # Get Project ID from gcloud config
    export PROJECT_ID="$(gcloud config get-value project)"
    export REGION="us-central1" # Or your preferred region
    # !! Use a SECURELY generated JWT Secret !!
    export JWT_SECRET="YOUR_SECURE_JWT_SECRET"
    # !! Replace with your ACTUAL Gemini API Key !!
    export GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
    # !! Use your ACTUAL Supabase/DB URLs !!
    export DB_CONN_STRING_POOLER="YOUR_DB_POOLER_URL" # e.g., postgresql://...:6543/postgres
    export DB_CONN_STRING_DIRECT="YOUR_DB_DIRECT_URL" # e.g., postgresql://...:5432/postgres
    # !! Use your ACTUAL Vercel Production URL (e.g., https://your-project.vercel.app) !!
    export VERCEL_PROD_URL="YOUR_VERCEL_PROD_URL"

    # Derived Service Account Names (These will be populated based on PROJECT_ID)
    export API_GATEWAY_SA_EMAIL="api-gateway@${PROJECT_ID}.iam.gserviceaccount.com"
    export INTERVIEW_ANALYSIS_SA_EMAIL="interview-analysis@${PROJECT_ID}.iam.gserviceaccount.com"
    export DATABASE_SERVICE_SA_EMAIL="database-service@${PROJECT_ID}.iam.gserviceaccount.com"
    ```

---

## 2. Google Cloud Resource Setup (Run Once)

### 2.1 Add Billing Account

*   [ ] Added billing account:
    - Add/Verify in your Google Cloud Console (Required for deploying resources)

### 2.2 Enable Necessary APIs

*   [ ] Enable Cloud Build, Cloud Run, Secret Manager, IAM, **and Container Registry** APIs:
    ```bash
    gcloud services enable cloudbuild.googleapis.com run.googleapis.com secretmanager.googleapis.com iam.googleapis.com containerregistry.googleapis.com --project $PROJECT_ID
    ```

### 2.3 Grant Cloud Build Permissions (Run Once)

*   [ ] Get Project Number (needed for Cloud Build Service Account email):
    ```bash
    export PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
    echo "Project Number: $PROJECT_NUMBER"
    ```
*   [ ] Define Cloud Build Service Account Email:
    ```bash
    export CLOUD_BUILD_SA_EMAIL="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"
    echo "Cloud Build SA: $CLOUD_BUILD_SA_EMAIL"
    ```
*   [ ] Grant Cloud Build SA the Cloud Run Admin role (to deploy services):
    ```bash
    gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:${CLOUD_BUILD_SA_EMAIL}" --role="roles/run.admin"
    ```
*   [ ] Grant Cloud Build SA the IAM Service Account User role (to act as runtime SAs):
    ```bash
    # Grant permission for Database Service SA
    gcloud iam service-accounts add-iam-policy-binding $DATABASE_SERVICE_SA_EMAIL --member="serviceAccount:${CLOUD_BUILD_SA_EMAIL}" --role="roles/iam.serviceAccountUser" --project $PROJECT_ID
    # Grant permission for Interview Analysis SA
    gcloud iam service-accounts add-iam-policy-binding $INTERVIEW_ANALYSIS_SA_EMAIL --member="serviceAccount:${CLOUD_BUILD_SA_EMAIL}" --role="roles/iam.serviceAccountUser" --project $PROJECT_ID
    # Grant permission for API Gateway SA
    gcloud iam service-accounts add-iam-policy-binding $API_GATEWAY_SA_EMAIL --member="serviceAccount:${CLOUD_BUILD_SA_EMAIL}" --role="roles/iam.serviceAccountUser" --project $PROJECT_ID
    ```

### 2.4 Service Accounts

*   [ ] Create API Gateway Service Account:
    ```bash
    gcloud iam service-accounts create api-gateway --display-name "Navi API Gateway Service Account" --project $PROJECT_ID
    ```
*   [ ] Create Interview Analysis Service Account:
    ```bash
    gcloud iam service-accounts create interview-analysis --display-name "Navi Interview Analysis Service Account" --project $PROJECT_ID
    ```
*   [ ] Create Database Service Account:
    ```bash
    gcloud iam service-accounts create database-service --display-name "Navi Database Service Account" --project $PROJECT_ID
    ```

### 2.5 Secret Manager

*   [ ] Create JWT Secret:
    ```bash
    echo -n "${JWT_SECRET}" | gcloud secrets create nextauth-jwt-secret --data-file=- --project $PROJECT_ID
    ```
*   [ ] Create Gemini API Key Secret:
    ```bash
    echo -n "${GEMINI_API_KEY}" | gcloud secrets create gemini-api-key --data-file=- --project $PROJECT_ID
    ```
*   [ ] Create Database Connection String Secret (Pooler):
    ```bash
    echo -n "${DB_CONN_STRING_POOLER}" | gcloud secrets create database-connection-string --data-file=- --project $PROJECT_ID
    ```
*   [ ] Create Migrate Database Connection String Secret (Direct):
    ```bash
    echo -n "${DB_CONN_STRING_DIRECT}" | gcloud secrets create migrate-database-connection-string --data-file=- --project $PROJECT_ID
    ```
*   [ ] Grant API Gateway access to JWT Secret:
    ```bash
    gcloud secrets add-iam-policy-binding nextauth-jwt-secret --member="serviceAccount:${API_GATEWAY_SA_EMAIL}" --role="roles/secretmanager.secretAccessor" --project $PROJECT_ID
    ```
*   [ ] Grant Interview Analysis access to Gemini Key Secret:
    ```bash
    gcloud secrets add-iam-policy-binding gemini-api-key --member="serviceAccount:${INTERVIEW_ANALYSIS_SA_EMAIL}" --role="roles/secretmanager.secretAccessor" --project $PROJECT_ID
    ```
*   [ ] Grant Database Service access to DB Connection String Secret:
    ```bash
    gcloud secrets add-iam-policy-binding database-connection-string --member="serviceAccount:${DATABASE_SERVICE_SA_EMAIL}" --role="roles/secretmanager.secretAccessor" --project $PROJECT_ID
    ```
*   [ ] Grant Database Service access to Migrate DB Connection String Secret:
    ```bash
    gcloud secrets add-iam-policy-binding migrate-database-connection-string --member="serviceAccount:${DATABASE_SERVICE_SA_EMAIL}" --role="roles/secretmanager.secretAccessor" --project $PROJECT_ID
    ```

---

## 3. Backend Deployment (Cloud Run via Cloud Build)

*Note: IAM permissions are granted *after* the dependent services are deployed.*

### 3.1 Deploy Database Service

*   [ ] Change directory:
    ```bash
    cd services/database-service
    ```
*   [ ] Submit Cloud Build job:
    ```bash
    gcloud builds submit --config=cloudbuild.yaml --project $PROJECT_ID
    ```
*   [ ] **Wait for deployment to complete successfully.**

### 3.2 Grant Interview Analysis Permissions for Database Service

*   [ ] Add IAM policy binding (allow Interview Analysis to invoke Database Service):
    ```bash
    gcloud run services add-iam-policy-binding database-service --member="serviceAccount:${INTERVIEW_ANALYSIS_SA_EMAIL}" --role="roles/run.invoker" --region=$REGION --platform=managed --project $PROJECT_ID
    ```

### 3.3 Deploy Interview Analysis Service

*   [ ] Get the deployed Database Service URL:
    ```bash
    export DATABASE_URL=$(gcloud run services describe database-service --platform managed --region $REGION --format='value(status.url)' --project $PROJECT_ID)
    echo "Database Service URL: $DATABASE_URL"
    ```
*   [ ] Change directory:
    ```bash
    cd ../interview_analysis
    ```
*   [ ] Submit Cloud Build job with substitution:
    ```bash
    gcloud builds submit --config=cloudbuild.yaml --substitutions=_DATABASE_API_URL=$DATABASE_URL --project $PROJECT_ID
    ```
*   [ ] **Wait for deployment to complete successfully.**

### 3.4 Grant API Gateway Permissions

*   [ ] Add IAM policy binding (allow API Gateway to invoke Database Service):
    ```bash
    gcloud run services add-iam-policy-binding database-service --member="serviceAccount:${API_GATEWAY_SA_EMAIL}" --role="roles/run.invoker" --region=$REGION --platform=managed --project $PROJECT_ID
    ```
*   [ ] Add IAM policy binding (allow API Gateway to invoke Interview Analysis Service):
    ```bash
    gcloud run services add-iam-policy-binding interview-analysis --member="serviceAccount:${API_GATEWAY_SA_EMAIL}" --role="roles/run.invoker" --region=$REGION --platform=managed --project $PROJECT_ID
    ```

### 3.5 Deploy API Gateway Service

*   [ ] Get the deployed Interview Analysis Service URL:
    ```bash
    export INTERVIEW_URL=$(gcloud run services describe interview-analysis --platform managed --region $REGION --format='value(status.url)' --project $PROJECT_ID)
    echo "Interview Analysis URL: $INTERVIEW_URL"
    ```
*   [ ] (Re-confirm Database Service URL is still set in shell env)
    ```bash
    echo "Database Service URL: $DATABASE_URL"
    ```
*   [ ] (Confirm Vercel Prod URL is set in shell env)
    ```bash
    echo "Vercel Production URL for CORS: $VERCEL_PROD_URL"
    ```
*   [ ] Change directory:
    ```bash
    cd ../api_gateway
    ```
*   [ ] Submit Cloud Build job with substitutions:
    ```bash
    gcloud builds submit --config=cloudbuild.yaml --substitutions=_SERVICE_INTERVIEW_ANALYSIS=$INTERVIEW_URL,_SERVICE_DATABASE=$DATABASE_URL,_CORS_ORIGINS=$VERCEL_PROD_URL --project $PROJECT_ID
    ```
*   [ ] **Wait for deployment to complete successfully.**
*   [ ] **Set API Gateway to Allow Unauthenticated Access:**
    - Authetication with frontend happens via JWT, since frontend doesn't automatically have a Google-issued ID token
    ```bash
    gcloud run services add-iam-policy-binding api-gateway --region=$REGION --member="allUsers" --role="roles/run.invoker" --platform=managed
    ```
*   [ ] Get and note the final API Gateway URL:
    ```bash
    export API_GATEWAY_URL=$(gcloud run services describe api-gateway --platform managed --region $REGION --format='value(status.url)' --project $PROJECT_ID)
    echo "------------------------------------------"
    echo "API Gateway Deployed URL: ${API_GATEWAY_URL}"
    echo "------------------------------------------"
    ```
*   [ ] Change back to project root:
    ```bash
    cd ../..
    ```

---

## 4. Frontend Deployment (Vercel)

### 4.1 Set Vercel Environment Variables

*   [ ] Go to your Vercel project settings -> Environment Variables.
*   [ ] Add/Update the following **Production** Environment Variables:
    *   `NEXTAUTH_SECRET`: Set this to the value of your `$JWT_SECRET` (`YOUR_SECURE_JWT_SECRET`). Consider linking to the `nextauth-jwt-secret` Google Secret if Vercel integration allows.
    *   `NEXTAUTH_URL`: Set this to your *actual* Vercel Production URL (the value you used for `$VERCEL_PROD_URL`, e.g., `https://your-project.vercel.app`).
    *   `NEXT_PUBLIC_API_URL`: Set this to the API Gateway URL obtained in the previous step (the value of `$API_GATEWAY_URL`).
    *   `DATABASE_URL`: Set this to the *Pooler* database connection string (the value of `$DB_CONN_STRING_POOLER`). Consider linking to the `database-connection-string` Google Secret if possible.
    *   `NODE_ENV`: Set this to `production`.

### 4.2 Deploy to Vercel Production

*   [ ] Change directory:
    ```bash
    cd frontend
    ```
*   [ ] Run Vercel deploy command:
    ```bash
    vercel --prod
    ```

---

## 5. Post-Deployment Checks (Optional)

*   [ ] Verify API Gateway CORS environment variable (Optional):
    ```bash
    gcloud run services describe api-gateway --platform managed --region $REGION --format='value(spec.template.spec.containers[0].env)' --project $PROJECT_ID | grep CORS_ORIGINS
    ```
    *(This should show `name: CORS_ORIGINS, value: YOUR_VERCEL_PROD_URL`)*

--- 