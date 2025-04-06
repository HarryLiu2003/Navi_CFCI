# Interview Analysis Service

This service provides the core AI-powered analysis of user interview transcripts (VTT format) for the Navi CFCI platform, using Google's Gemini models.

## Core Responsibilities

*   Receives VTT file uploads via API.
*   Parses and processes VTT content.
*   Uses a configured Gemini pipeline (`app/services/analysis/gemini_pipeline/`) to:
    *   Identify problem areas.
    *   Extract relevant transcript excerpts.
    *   Generate analysis synthesis.
*   Stores the complete analysis result (including metadata and transcript chunks) by calling the **Database Service**.

(See [../../docs/architecture.md](../../docs/architecture.md) for how this service fits into the overall system).

## API Endpoints

*   **`POST /api/interviews`**: 
    *   Accepts `multipart/form-data` with a `file` (VTT) and optional metadata fields (`project_id`, `interviewer`, `interview_date`, `userId`).
    *   Performs analysis and stores results via Database Service.
    *   Returns a JSON object containing the analysis data and stored interview ID (or error).

## Environment Variables (.env)

Create `.env` from `.env.example`. Key variables:

*   `GEMINI_API_KEY`: **Required.** Your API key for Google Gemini.
*   `DATABASE_API_URL`: URL of the Database Service (e.g., `http://database:5001` locally, Cloud Run URL in production).
*   `LOG_LEVEL`: `INFO` or `DEBUG`.
*   `NODE_ENV`: `development` or `production`.

(See [../../docs/deployment_guide.md](../../docs/deployment_guide.md) for production environment variables and secret management).

## Local Development & Testing

### Running with Docker Compose (Recommended)

Run the full stack from the project root:
```bash
docker compose up
```
This service will be available internally at `http://interview_analysis:8001`.

### Running Standalone (Alternative)

Requires other services (like Database Service) to be accessible.

```bash
# From this directory (services/interview_analysis)
pip install -r requirements.txt
# Ensure GEMINI_API_KEY and DATABASE_API_URL are set in .env
uvicorn app.main:app --reload --port 8001
```

### Running Tests

```bash
# Run tests within the Docker container (recommended)
docker exec -it navi_cfci-interview_analysis-1 pytest

# Run tests with coverage
docker exec -it navi_cfci-interview_analysis-1 pytest --cov=app

# Run tests locally
pytest
```

(See [../../docs/testing_strategy.md](../../docs/testing_strategy.md) for overall testing info). 