# Interview Analysis Service

This service provides advanced analysis of interview transcripts, identifying problem areas, extracting relevant excerpts, and generating synthesized insights.

## Setup

Install dependencies:
```bash
pip install -r requirements.txt
```

## API Endpoints

### Transcript Analysis

**Endpoint**: `/api/interview_analysis/analyze`

Performs multi-step analysis of interview transcripts:
1. Problem area identification
2. Excerpt extraction
3. Synthesis generation

## Dependencies

This service uses the following key dependencies:
- **FastAPI**: Web framework for building the API
- **Google Generative AI**: Through LangChain, for AI-powered transcript analysis
- **LangChain**: Framework for building AI chains with structured prompts

All dependencies have been optimized to include only what's actually used by the service.

## Environment Variables

Create a `.env` file in the service directory with the following variables:

- `GEMINI_API_KEY`: Your Google Gemini API key
- `LOG_LEVEL`: Logging level (INFO, DEBUG, etc.)

Example:
```
GEMINI_API_KEY=your-gemini-api-key
LOG_LEVEL=INFO
```

## Local Development

Run the service:
```bash
uvicorn app.main:app --reload --port 8001
``` 