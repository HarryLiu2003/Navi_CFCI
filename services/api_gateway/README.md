# API Gateway Service

This service acts as the central entry point and router for the Navi CFCI platform. It receives requests from the frontend, validates user authentication (JWT), and forwards requests to the appropriate backend microservices using secure service-to-service communication.

## Core Responsibilities

*   Route incoming API calls to backend services (`interview_analysis`, `database`, `sprint1_deprecated`).
*   Validate end-user authentication using JWT Bearer tokens.
*   Handle CORS for frontend requests.
*   Provide a unified API interface.

(See [../../docs/architecture.md](../../docs/architecture.md) and [../../docs/authentication.md](../../docs/authentication.md) for full system details).

## Environment Variables (.env)

Create `.env` from `.env.example`. Key variables for local development:

*   `JWT_SECRET`: **Must match** `NEXTAUTH_SECRET` in `frontend/.env`.
*   `SERVICE_INTERVIEW_ANALYSIS`: Local URL (e.g., `http://interview_analysis:8001`).
*   `SERVICE_DATABASE`: Local URL (e.g., `http://database:5001`).
*   `SERVICE_SPRINT1_DEPRECATED`: Local URL (e.g., `http://sprint1_deprecated:8002`).
*   `ENABLE_DEV_AUTH`: Set `true` to allow testing without valid JWTs locally (uses fallback user).
*   `DEVELOPMENT_USER_ID`: User ID used by the fallback mechanism.
*   `CORS_ORIGINS`: e.g., `http://localhost:3000`.
*   `LOG_LEVEL`: `INFO` or `DEBUG`.
*   `NODE_ENV`: `development` or `production`.
*   `DEBUG`: `true` or `false` (controls FastAPI debug mode).

(See [../../docs/deployment_guide.md](../../docs/deployment_guide.md) for production environment variables and secret management).

## Local Development & Testing

### Running with Docker Compose (Recommended)

The entire system, including the API Gateway, is best run using Docker Compose from the project root:

```bash
# From project root
docker compose up
```

Access the local API docs at: http://localhost:8000/docs

### Running Standalone (Alternative)

```bash
# From this directory (services/api_gateway)
pip install -r requirements.txt
# Ensure backend services are running or mocked
uvicorn app.main:app --reload --port 8000
```

### Running Tests

Requires backend services to be running (use Docker Compose).

```bash
# Run all tests for this service within its Docker container
docker exec -it navi_cfci-api_gateway-1 pytest

# Run specific test files
docker exec -it navi_cfci-api_gateway-1 pytest tests/unit_tests/test_auth_middleware.py
```

(See [../../docs/testing_strategy.md](../../docs/testing_strategy.md) for overall testing info).

### Manual API Testing (Local)

*   **Unauthenticated:** `curl -i http://localhost:8000/api/interviews` (Should use dev fallback if `ENABLE_DEV_AUTH=true`).
*   **Authenticated:** Obtain a valid JWT from the frontend (browser dev tools -> cookies -> `next-auth.session-token` after login) and use it:
    ```bash
    TOKEN="your_copied_jwt_here"
    curl -i -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/auth/me
```

## API Endpoints

*(Note: The API Gateway acts as a router. See individual service READMEs for detailed API contracts)*

### Authentication Routes
*   `GET /api/auth/me`: Returns authenticated user info (uses JWT).

### Interview Analysis Routes (Proxied to `interview_analysis` service)
*   `POST /api/interviews`: Upload and analyze a new interview transcript.
*   `GET /api/interviews`: Get list of user's interviews.
*   `GET /api/interviews/{interview_id}`: Get details of a specific interview.

### Database Routes (Proxied to `database` service)
*   *(These are internal and typically called by other services, but potentially proxied if needed)*
*   `GET /db/interviews`: Example internal route (might not be exposed via gateway).

### Sprint1 Deprecated Routes (Proxied to `sprint1_deprecated` service)
*   `POST /api/sprint1/preprocess`
*   `POST /api/sprint1/summarize`
*   `POST /api/sprint1/keywords`