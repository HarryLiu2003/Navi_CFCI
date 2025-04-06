# Sprint1 Deprecated Service

This service provides legacy functionality for preprocessing, summarization, and keyword extraction from interview transcripts, likely using older models like OpenAI GPT-4.

**Note:** This service is considered deprecated and new development should focus on the `interview_analysis` service which uses Google Gemini.

## Core Responsibilities

*   Preprocesses VTT files into structured text chunks.
*   Generates summaries of transcripts.
*   Extracts keywords and themes.

(See [../../docs/architecture.md](../../docs/architecture.md) for how this service fits into the overall system).

## API Endpoints

*   `POST /api/sprint1_deprecated/preprocess`
*   `POST /api/sprint1_deprecated/summarize`
*   `POST /api/sprint1_deprecated/keywords`

(These accept VTT files via form data).

## Environment Variables (.env)

Create `.env` from `.env.example`.

*   `OPENAI_API_KEY`: Required if using OpenAI models.
*   `LOG_LEVEL`: `INFO` or `DEBUG`.
*   `NODE_ENV`: `development` or `production`.

(See [../../docs/deployment_guide.md](../../docs/deployment_guide.md) for production environment variables).

## Local Development & Testing

### Running with Docker Compose (Recommended)

Run the full stack from the project root:
```bash
docker compose up
```
This service will be available internally at `http://sprint1_deprecated:8002`.

### Running Standalone (Alternative)

```bash
# From this directory (services/sprint1_deprecated)
pip install -r requirements.txt
python post_install.py # Download NLP models
# Ensure OPENAI_API_KEY is set in .env if needed
uvicorn app.main:app --reload --port 8002
``` 

### Running Tests

```bash
# Run tests within the Docker container (recommended)
docker exec -it navi_cfci-sprint1_deprecated-1 pytest

# Run tests locally
pytest
```

(See [../../docs/testing_strategy.md](../../docs/testing_strategy.md) for overall testing info). 