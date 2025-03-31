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

## Environment Variables

Create a `.env` file in the service directory with the following variables:

- `SERVICE_INTERVIEW_ANALYSIS`: URL of the Interview Analysis service
- `SERVICE_SPRINT1_DEPRECATED`: URL of the Sprint1 Deprecated service
- `CORS_ORIGINS`: Comma-separated list of allowed origins for CORS
- `LOG_LEVEL`: Logging level (INFO, DEBUG, etc.)

Example for local development:
```
SERVICE_INTERVIEW_ANALYSIS=http://interview_analysis:8001
SERVICE_SPRINT1_DEPRECATED=http://sprint1_deprecated:8002
CORS_ORIGINS=http://localhost:3000
LOG_LEVEL=INFO
```

## Local Development

Run the service:
```bash
uvicorn app.main:app --reload --port 8000
``` 