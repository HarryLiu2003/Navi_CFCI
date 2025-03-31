# Navi CFCI Architecture

This document explains the architecture of the Navi CFCI platform for interview analysis.

## System Architecture

```
┌───────────────┐         ┌─────────────────────┐
│               │         │                     │
│   Frontend    │         │    API Gateway      │
│   (Next.js)   │ ─────▶  │    (FastAPI)        │
│               │         │                     │
└───────────────┘         └─────────────────────┘
                                 │        │
                                 ▼        ▼
               ┌─────────────────────┐  ┌─────────────────────┐
               │                     │  │                     │
               │ Interview Analysis  │  │ Sprint1 Deprecated  │
               │    (FastAPI)        │  │    (FastAPI)        │
               │                     │  │                     │
               └─────────────────────┘  └─────────────────────┘
```

## Component Descriptions

### Frontend (Next.js)
- User interface for transcript upload and analysis
- Visualizes analysis results
- Handles user interactions
- Communicates with backend via API Gateway
- Built with React, TypeScript, and Tailwind CSS

### API Gateway (FastAPI)
- Single entry point for all API requests
- Routes requests to appropriate microservices
- Provides consistent API endpoints for frontend
- Handles CORS and request validation
- Manages service discovery and communication

### Interview Analysis Service (FastAPI)
- Core service for analyzing interview transcripts
- Uses Google's Gemini AI for advanced analysis
- Extracts problem areas, insights, and creates synthesis
- Processes VTT (WebVTT) transcript files
- Implements LangChain for structured AI prompting

### Sprint1 Deprecated Service (FastAPI)
- Legacy service maintained for backward compatibility
- Handles keyword extraction and basic analysis
- Provides preprocessing capabilities for transcript formatting
- Manages transcript summarization using OpenAI
- Supports older API formats

## Communication Flow

1. User uploads transcript through frontend
2. Frontend sends the transcript to API Gateway
3. API Gateway determines which service should handle the request
4. Appropriate microservice processes the request
5. Results are returned through API Gateway to frontend
6. Frontend displays results to user

## Local Development vs. Production

### Local Development
- All services run in Docker containers using Docker Compose (recommended approach)
- Docker Compose orchestrates the entire stack to ensure consistent development
- Hot reloading enabled for rapid development
- Local environment variables for configuration
- Single command setup: `docker compose up`

### Production
- Frontend deployed on Vercel
- Backend services deployed on Google Cloud Run
- API Gateway handles routing between cloud services
- Environment variables managed in respective cloud platforms
- Secrets stored in Google Secret Manager

## Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│             │     │             │     │             │     │             │
│  Transcript │────▶│ Preprocess  │────▶│  Analysis   │────▶│ Visualization│
│   Upload    │     │             │     │             │     │             │
│             │     │             │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

1. **Transcript Upload**: User uploads VTT interview transcript file
2. **Preprocessing**: Transcript is cleaned, formatted, and normalized
3. **Analysis**: LLM-based analysis extracts insights and problem areas
4. **Visualization**: Results are visualized for user interpretation

## Technology Stack

- **Frontend**: 
  - Next.js 15.x with React 18
  - TypeScript for type safety
  - Tailwind CSS for styling
  - shadcn/ui component library
  - Vercel for hosting

- **Backend**: 
  - FastAPI for API development
  - Python 3.9+
  - LangChain for LLM integration
  - Google Gemini and OpenAI for AI processing
  - Google Cloud Run for hosting

- **Development**: 
  - Docker & Docker Compose (primary development environment)
  - Jest for frontend unit testing
  - Cypress for frontend E2E testing
  - PyTest for backend testing 