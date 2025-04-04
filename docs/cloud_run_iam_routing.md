# Cloud Run IAM and Routing Implementation Guide

This document outlines our approach to handling IAM and routing for our Google Cloud Run deployment, providing a consistent reference throughout implementation.

## Security Architecture: Quick Reference

Our security architecture follows these key principles:

1. **Public Frontend, Protected Backend**: 
   - Frontend (Vercel) is publicly accessible
   - API Gateway (Cloud Run) is publicly accessible but routes are protected with JWT authentication
   - Backend services (Database, Interview Analysis) are private and only accessible via authenticated service calls

2. **Three-Layer Authentication**:
   - **User Authentication**: JWT tokens via NextAuth.js, validated by API Gateway
   - **Service-to-Service Authentication**: Google Cloud IAM with service accounts
   - **CORS Protection**: Configured at each service level with environment-variable controlled origins

3. **Security Best Practices**:
   - Each service has its own dedicated service account with minimal permissions
   - Secrets (API keys, connection strings) stored in Google Secret Manager
   - Private services configured with `--no-allow-unauthenticated`
   - Public API Gateway uses `--allow-unauthenticated` but implements JWT validation

4. **Service Access Controls**:
   - API Gateway can call all backend services (Database, Interview Analysis)
   - Interview Analysis can call Database service
   - Frontend can only call API Gateway
   - Public users can only access API Gateway

```
┌───────────────┐        JWT Auth         ┌───────────────┐        IAM Auth        ┌───────────────┐
│    Public     │ ─────────────────────▶  │  API Gateway  │ ─────────────────────▶ │   Database    │
│   Frontend    │      (NextAuth)         │    Service    │      (Service Acct)    │    Service    │
│    (Vercel)   │ ◀─────────────────────  │  (Public URL) │ ◀─────────────────────  │  (Private URL) │
└───────────────┘                         └───────┬───────┘                         └───────┬───────┘
                                                  │                                         ▲
                                                  │                                         │
                                                  │           IAM Auth                      │
                                                  ▼       (Service Acct)                    │
                                          ┌───────────────┐                                 │
                                          │  Interview    │                                 │
                                          │   Analysis    │ ────────────────────────────────┘
                                          │  (Private URL)│            IAM Auth
                                          └───────────────┘           (Service Acct)
```

This layered approach provides defense in depth while maintaining flexibility and simplicity in our architecture.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Service Accounts Setup](#service-accounts-setup)
3. [Middleware Implementation](#middleware-implementation)
4. [API Gateway Authentication](#api-gateway-authentication)
5. [Deployment Configuration](#deployment-configuration)
6. [Service-to-Service Authentication](#service-to-service-authentication)
7. [User Authentication](#user-authentication)
8. [CORS Configuration](#cors-configuration)
9. [Testing Authentication](#testing-authentication)
10. [Troubleshooting](#troubleshooting)

## Architecture Overview

We've adopted a hybrid approach that combines:
- **Google Cloud IAM** for service-to-service authentication
- **Custom middleware** for user authentication and route protection

This provides a balance between security and simplicity while keeping deployment complexity manageable.

```
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│    Frontend   │──────▶│  API Gateway  │──────▶│    Database   │
└───────────────┘       │   Service     │       │    Service    │
                        └───────┬───────┘       └───────────────┘
                                │                        ▲
                                ▼                        │
                        ┌───────────────┐                │
                        │  Interview    │                │
                        │  Analysis     │────────────────┘
                        └───────────────┘
```

## Service Accounts Setup

Each service requires its own service account with minimal permissions.

### Creating Service Accounts

```bash
# Create service account for database service
gcloud iam service-accounts create database-service \
  --display-name "Database Service Account"

# Create service account for API gateway
gcloud iam service-accounts create api-gateway \
  --display-name "API Gateway Service Account"

# Create service account for interview analysis service
gcloud iam service-accounts create interview-analysis \
  --display-name "Interview Analysis Service Account"
```

### Granting Permissions

```bash
# Database service permissions (example: access to Cloud SQL)
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:database-service@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

# API gateway permissions (example: invoke other services)
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:api-gateway@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.invoker"

# Interview analysis permissions (example: access to AI services)
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:interview-analysis@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
```

## Middleware Implementation

### Authentication Middleware (Express.js)

```javascript
// middleware/auth.js
const { verifyIdToken } = require('../utils/auth');

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  try {
    // Verify with your auth provider
    const user = verifyIdToken(token);
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

module.exports = { authMiddleware };
```

### Applying Middleware to Routes

```javascript
// routes/index.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

// Public routes
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Protected routes
router.get('/api/data', authMiddleware, (req, res) => {
  // Handle protected route
});

module.exports = router;
```

## API Gateway Authentication

The API Gateway uses JWT-based authentication via middleware to protect endpoints. It validates tokens issued by the frontend (NextAuth.js) and passes user information securely to backend services.

### Authentication Flow

1. Frontend (NextAuth.js) obtains a JWT after successful user login.
2. Frontend includes the JWT in the `Authorization: Bearer <token>` header for requests to the API Gateway.
3. API Gateway's authentication middleware (`app/middleware/auth.py`) intercepts the request.
4. The middleware validates the JWT signature and expiry using a shared secret key.
5. If valid, the user ID (from the `sub` claim) is extracted from the token payload and made available to the route handler.
6. If invalid or missing, an appropriate HTTP error (e.g., 401 Unauthorized) is returned for protected routes.

### Code Structure

The authentication middleware is organized as follows:

```
services/api_gateway/
├── app/
│   ├── middleware/
│   │   ├── __init__.py
│   │   └── auth.py       # Authentication middleware
│   └── main.py           # FastAPI application with protected routes
└── tests/
    └── unit_tests/
        └── test_auth_middleware.py  # Tests for auth middleware
```

### Authentication Functions

The middleware provides three main functions:

1. **verify_token** - Strict verification for protected routes
2. **get_optional_user** - Non-strict verification for routes where auth is optional
3. **get_user_id_from_payload** - Helper to extract the user ID from a JWT payload

### Usage in Routes

#### Protected Route Example

```python
@app.get("/api/auth/me")
async def get_authenticated_user(payload: dict = Depends(verify_token)):
    """This route requires authentication."""
    return {
        "userId": get_user_id_from_payload(payload),
        "isAuthenticated": True
    }
```

#### Optional Authentication Example

```python
@app.post("/api/interview_analysis/analyze")
async def analyze_interview(
    file: UploadFile = File(...),
    user_payload: Optional[dict] = Depends(get_optional_user)
):
    """This route works with or without authentication."""
    user_id = get_user_id_from_payload(user_payload)
    # ... rest of the code ...
```

### Environment Configuration

The API Gateway requires the shared JWT secret key to validate tokens. This is configured securely:

```bash
# In Google Secret Manager (Recommended)
# Create a secret (e.g., 'nextauth-jwt-secret') storing the shared secret value.

# In Cloud Run Deployment (using gcloud or Cloud Build YAML)
# Mount the secret as an environment variable:
--update-secrets=JWT_SECRET=nextauth-jwt-secret:latest

# --- Corresponding Frontend Configuration (Manual) ---
# In Vercel project settings, manually set the environment variable:
# NEXTAUTH_SECRET=<value_from_google_secret_manager>
```

**IMPORTANT**: The `JWT_SECRET` used by the API Gateway *must* be identical to the `NEXTAUTH_SECRET` used by the Next.js frontend in Vercel for authentication to work correctly. Secure management and synchronization are crucial.

## Deployment Configuration

Deployment is preferably handled via Cloud Build scripts (`cloudbuild.yaml`) for consistency and replicability, wrapping the `gcloud run deploy` commands.

### Database Service Deployment

```bash
# Example gcloud command (likely wrapped in Cloud Build step)
gcloud run deploy database-service \
  --image gcr.io/PROJECT_ID/database-service \
  --platform managed \
  --region us-central1 \
  --service-account database-service@PROJECT_ID.iam.gserviceaccount.com \
  --no-allow-unauthenticated # Secure: Only allows IAM-authenticated access
  # ... other flags like CORS, env vars, etc.
```
*Note: The `database-service` acts as a runtime API wrapper for database interactions within the Cloud Run environment. It is accessed securely by other backend services (e.g., Interview Analysis) using IAM-based service-to-service authentication (see below).* 

### API Gateway Deployment

```bash
gcloud run deploy api-gateway \
  --image gcr.io/PROJECT_ID/api-gateway \
  --platform managed \
  --region us-central1 \
  --service-account api-gateway@PROJECT_ID.iam.gserviceaccount.com \
  --allow-unauthenticated \
  --set-env-vars SERVICE_DATABASE=https://database-service-xxxx-uc.a.run.app,AUTH_REQUIRED=true
```

### Interview Analysis Service Deployment

```bash
gcloud run deploy interview-analysis \
  --image gcr.io/PROJECT_ID/interview-analysis \
  --platform managed \
  --region us-central1 \
  --service-account interview-analysis@PROJECT_ID.iam.gserviceaccount.com \
  --no-allow-unauthenticated \
  --set-env-vars DATABASE_API_URL=https://database-service-xxxx-uc.a.run.app
```

## Service-to-Service Authentication

### Python (FastAPI) Example

```python
# utils/auth.py
import google.auth.transport.requests
import google.oauth2.id_token
import requests

def call_authenticated_service(service_url, payload=None):
    """Call another Cloud Run service with authentication."""
    auth_req = google.auth.transport.requests.Request()
    id_token = google.oauth2.id_token.fetch_id_token(auth_req, service_url)
    
    headers = {"Authorization": f"Bearer {id_token}"}
    
    if payload:
        response = requests.post(service_url, headers=headers, json=payload)
    else:
        response = requests.get(service_url, headers=headers)
    
    return response.json()
```

### Node.js Example

```javascript
// utils/serviceAuth.js
const { GoogleAuth } = require('google-auth-library');
const axios = require('axios');

async function callAuthenticatedService(serviceUrl, method = 'GET', payload = null) {
  const auth = new GoogleAuth();
  const client = await auth.getIdTokenClient(serviceUrl);
  
  const headers = await client.getRequestHeaders();
  
  const config = {
    url: serviceUrl,
    method,
    headers
  };
  
  if (payload) {
    config.data = payload;
  }
  
  const response = await axios(config);
  return response.data;
}

module.exports = { callAuthenticatedService };
```

## CORS Configuration

### Express.js Example

```javascript
// app.js
const express = require('express');
const cors = require('cors');
const app = express();

// CORS configuration
const allowedOrigins = process.env.CORS_ORIGINS.split(',');
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

// Routes
app.use('/', require('./routes'));

module.exports = app;
```

### FastAPI Example

```python
# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI()

# CORS configuration
allowed_origins = os.environ.get("CORS_ORIGINS", "").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Testing Authentication

The authentication middleware includes a comprehensive test suite to verify its functionality.

### Running Tests

To run the tests using Docker:

```bash
# Start the API gateway service
docker compose up -d api_gateway

# Run the tests
docker compose exec api_gateway pytest -xvs tests/unit_tests/test_auth_middleware.py
```

### Test Coverage

The test suite covers:

1. **Token Validation**:
   - Valid tokens are accepted
   - Tokens without a user ID are rejected
   - Expired tokens are rejected
   - Missing credentials are rejected

2. **Optional Authentication**:
   - Valid tokens return user payload
   - Missing tokens return None
   - Invalid tokens return None

3. **User ID Extraction**:
   - Correctly extracts user ID from payload
   - Handles missing user ID
   - Handles null payloads

### Manual Testing

To test protected endpoints manually:

```bash
# This will fail with 401 Unauthorized
curl -i http://localhost:8000/api/auth/me

# Generate a valid JWT and use it (replace YOUR_TOKEN)
curl -i -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8000/api/auth/me
```

### Debugging Authentication

For troubleshooting JWT issues:

1. Verify the token structure using tools like [jwt.io](https://jwt.io/)
2. Ensure the JWT_SECRET environment variable matches between the API gateway and the frontend
3. Check that the token includes the required `sub` claim for user ID

## Troubleshooting

### Common Issues and Solutions

1. **401 Unauthorized Errors in Service-to-Service Communication**
   - Check service account permissions
   - Verify the service account has the invoker role

2. **CORS Errors**
   - Verify allowed origins configuration
   - Check if credentials mode is properly set

3. **Authentication Token Issues**
   - Validate token format and expiration
   - Check for clock skew between services

4. **Deployment Failures**
   - Review build and deployment logs
   - Verify service account has necessary permissions

### Debugging Commands

```bash
# View service logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=SERVICE_NAME" --limit=10

# Test service-to-service auth locally
curl -H "Authorization: Bearer $(gcloud auth print-identity-token --audiences=https://SERVICE-URL)" https://SERVICE-URL

# Verify service account permissions
gcloud projects get-iam-policy PROJECT_ID --flatten="bindings[].members" --format="table(bindings.role,bindings.members)" --filter="bindings.members:serviceAccount:SERVICE_ACCOUNT@PROJECT_ID.iam.gserviceaccount.com"
```