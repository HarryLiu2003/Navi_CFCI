# API Gateway Service

This service routes requests from the frontend to the appropriate backend microservices, acting as a central entry point for all API calls.

## Setup

Install dependencies:
```bash
pip install -r requirements.txt
```

## API Endpoints

### Interview Analysis

**Endpoint**: `/api/interview_analysis/analyze`
- Routes to: `interview_analysis:/api/interview_analysis/analyze`
- Performs comprehensive analysis of interview transcripts

**Endpoint**: `/api/interview_analysis/interviews`
- Routes to: `interview_analysis:/api/interview_analysis/interviews`
- Retrieves a list of interviews

**Endpoint**: `/api/interview_analysis/interviews/{interview_id}`
- Routes to: `interview_analysis:/api/interview_analysis/interviews/{interview_id}`
- Retrieves details for a specific interview

### Preprocessing

**Endpoint**: `/api/sprint1_deprecated/preprocess`
- Routes to: `sprint1_deprecated:/api/sprint1_deprecated/preprocess`
- Preprocesses transcript files into structured text

### Summarization

**Endpoint**: `/api/sprint1_deprecated/summarize`
- Routes to: `sprint1_deprecated:/api/sprint1_deprecated/summarize`
- Generates concise summaries of transcripts

### Keyword Extraction

**Endpoint**: `/api/sprint1_deprecated/keywords`
- Routes to: `sprint1_deprecated:/api/sprint1_deprecated/keywords`
- Extracts key themes and insights from transcripts

### Authentication

**Endpoint**: `/api/auth/me`
- Protected endpoint that requires authentication
- Returns the authenticated user's information

## Environment Variables

Create a `.env` file in the service directory with the following variables:

- `SERVICE_INTERVIEW_ANALYSIS`: URL of the Interview Analysis service
- `SERVICE_SPRINT1_DEPRECATED`: URL of the Sprint1 Deprecated service
- `CORS_ORIGINS`: Comma-separated list of allowed origins for CORS
- `LOG_LEVEL`: Logging level (INFO, DEBUG, etc.)
- `JWT_SECRET`: Secret key for JWT validation (should match frontend NEXTAUTH_SECRET)

Example for local development:
```
SERVICE_INTERVIEW_ANALYSIS=http://interview_analysis:8001
SERVICE_SPRINT1_DEPRECATED=http://sprint1_deprecated:8002
CORS_ORIGINS=http://localhost:3000
LOG_LEVEL=INFO
JWT_SECRET=your_jwt_secret_here
```

## Local Development

Run the service:
```bash
uvicorn app.main:app --reload --port 8000
```

## Testing

### Running Tests

To run all tests:
```bash
pytest
```

To run the authentication middleware tests:
```bash
pytest -xvs tests/unit_tests/test_auth_middleware.py
```

### Testing with Docker

With Docker Compose:
```bash
# Start the API gateway service
docker compose up -d api_gateway

# Run the tests
docker compose exec api_gateway pytest -xvs tests/unit_tests/test_auth_middleware.py
```

### Manual Testing of Protected Endpoints

To test a protected endpoint, you need a valid JWT token:

```bash
# This will fail with 401 Unauthorized
curl -i http://localhost:8000/api/auth/me

# With a valid token (replace YOUR_TOKEN)
curl -i -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8000/api/auth/me
```

You can get a valid token from the frontend by:
1. Login to the application
2. Open browser developer tools
3. Go to Application tab > Storage > Cookies
4. Find the `next-auth.session-token` cookie
5. Use this value as the Bearer token 