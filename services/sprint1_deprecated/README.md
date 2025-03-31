# Sprint1 Deprecated Service

This service provides legacy functionality for preprocessing, summarization, and keyword extraction from interview transcripts.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the post-installation script to download required models and data:
```bash
python post_install.py
```

This will install:
- SpaCy English language model (`en_core_web_sm`)
- NLTK data (punkt, stopwords)

## API Endpoints

### Preprocessing

**Endpoint**: `/api/sprint1_deprecated/preprocess`

Processes VTT transcript files into clean, structured text chunks.

### Summarization

**Endpoint**: `/api/sprint1_deprecated/summarize`

Generates concise summaries of interview transcripts using OpenAI's models.

### Keyword Extraction

**Endpoint**: `/api/sprint1_deprecated/keywords`

Extracts key points, themes, and insights from interview transcripts using a combination of NLP techniques and AI.

## Environment Variables

Required environment variables (see `.env.example`):
- `OPENAI_API_KEY`: Your OpenAI API key
- `OPENAI_API_URL`: OpenAI API URL (usually https://api.openai.com/v1)

## Local Development

Run the service:
```bash
uvicorn app.main:app --reload --port 8002
``` 