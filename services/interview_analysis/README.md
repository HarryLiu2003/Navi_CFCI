# Interview Analysis Service

The Interview Analysis Service is a key component of the Navi CFCI platform, responsible for processing and analyzing interview transcripts to identify problem areas, insights, and improvement opportunities.

## Features

1. VTT transcript file processing
2. Interview analysis using Google's Gemini API
3. Problem area identification and categorization
4. Storage of analysis results in the centralized database

## Service Architecture

This service follows a clean architecture approach with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Request                          │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ API Layer (app/api/)                                            │
│                                                                 │
│  ┌─────────────────┐         ┌───────────────────────┐          │
│  │    routes.py    │◄────────┤    dependencies.py    │          │
│  └────────┬────────┘         └───────────────────────┘          │
└──────────┬──────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│ Domain Layer (app/domain/)                                      │
│                                                                 │
│  ┌─────────────────┐         ┌───────────────────────┐          │
│  │   workflows.py  │◄────────┤       models.py       │          │
│  └────────┬────────┘         └───────────────────────┘          │
└──────────┬──────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────────┐
│ Services Layer (app/services/)                                  │
│                                                                 │
│  ┌─────────────────────────┐    ┌──────────────────────────┐    │
│  │ Analysis                │    │ Storage                  │    │
│  │  ┌──────────────┐      │    │  ┌─────────────────┐     │    │
│  │  │  analyzer.py │      │    │  │  repository.py  │     │    │
│  │  └──────┬───────┘      │    │  └────────┬────────┘     │    │
│  │         │              │    │           │               │    │
│  │  ┌──────▼───────┐      │    │           │               │    │
│  │  │ gemini_pipeline/ │      │    │           │               │    │
│  │  └──────────────┘      │    │           │               │    │
│  └──────────┬─────────────┘    └───────────┬───────────────┘    │
└─────────────┬───────────────────────────────┬──────────────────-┘
              │                               │
              ▼                               ▼
┌─────────────────────────┐      ┌───────────────────────────┐
│    External LLM API     │      │       Database API        │
└─────────────────────────┘      └───────────────────────────┘
```

### Service Layer Organization

- **API Layer** (`app/api/`): Handles HTTP requests and responses
  - `routes.py`: API endpoint definitions
  - `dependencies.py`: Dependency injection configuration

- **Domain Layer** (`app/domain/`): Core business entities and workflows
  - `models.py`: Domain entities using Pydantic
  - `workflows.py`: Business process orchestration

- **Services Layer** (`app/services/`): Implementation of business functionalities
  - `analysis/`: Transcript analysis services
    - `analyzer.py`: Main analysis implementation
    - `gemini_pipeline/`: Gemini API pipeline implementation for analysis
  - `storage/`: Data storage services
    - `repository.py`: Database access implementation

- **Utils** (`app/utils/`): Cross-cutting concerns
  - `api_responses.py`: Standardized API response formatting
  - `errors/`: Custom error classes with proper status codes

### Error Handling

The service implements a comprehensive error handling approach:
- `InterviewAnalysisError`: Base exception for all service errors
- `FileProcessingError`: For issues with uploaded files
- `AnalysisError`: For failures during analysis
- `StorageError`: For database storage issues
- `ConfigurationError`: For service configuration problems

All errors are mapped to appropriate HTTP status codes and returned in a consistent format.

## Setup and Configuration

### Environment Variables

Required environment variables:

- `GEMINI_API_KEY`: API key for Google's Gemini model access (required)
- `DATABASE_API_URL`: URL for the database service API (defaults to http://localhost:5001)
- Additional logging variables can be configured via standard Python logging mechanisms

Example:
```
GEMINI_API_KEY=your-gemini-api-key
DATABASE_API_URL=http://database:5001
```

### Installation

1. Navigate to the service directory
2. Install dependencies: `pip install -r requirements.txt`

## Running the Service

### Development Mode

```bash
uvicorn app.main:app --reload --port 8001
```

### Production Mode

```bash
uvicorn app.main:app --port 8001 --workers 4
```

## API Endpoints

### Analyze Transcript

- **URL**: `/api/interview_analysis/analyze`
- **Method**: `POST`
- **Body**: Form data with:
  - `file`: VTT transcript file
  - `project_id` (optional): Project identifier
  - `interviewer` (optional): Name of interviewer
  - `interview_date` (optional): Date of interview (ISO format)
  - `userId` (optional): User ID of the authenticated user
- **Response**: JSON with standardized structure:
  - `status`: "success" or "error"
  - `message`: Success/error message
  - `data`: When successful, contains the analysis result with:
    - `problem_areas`: List of identified problems
    - `transcript`: List of transcript chunks
    - `synthesis`: Summary of findings
    - `metadata`: Analysis metadata
    - `storage`: Storage information

## Service Request Flow

Below is a step-by-step illustration of how a typical analyze request flows through the system:

```
┌──────────┐    1. HTTP POST     ┌────────────┐
│  Client  │────/interview_anal─▶│  routes.py │
└──────────┘    ysis/analyze     └──────┬─────┘
                                        │
                                        │ 2. Dependency Injection
                                        ▼
                                 ┌────────────────┐
                                 │ dependencies.py│
                                 └────────┬───────┘
                                          │
                                          │ 3. Creates services
                                          ▼
     ┌────────────────────────────────────────────────────┐
     │                 InterviewWorkflow                  │
     └─────────────────────┬──────────────┬──────────────┘
                           │              │
               4. Analyze  │              │ 5. Store
                           ▼              ▼
           ┌────────────────────┐  ┌────────────────────┐
           │ TranscriptAnalyzer │  │ InterviewRepository│
           └─────────┬──────────┘  └──────────┬─────────┘
                     │                        │
                     ▼                        ▼
          ┌──────────────────┐      ┌──────────────────┐
          │   Gemini API     │      │   Database API   │
          └──────────────────┘      └──────────────────┘
                     │                        │
                     └───────────┬────────────┘
                                 │
                     6. Return   │
           ┌──────────────────────────────────┐
           │ Standardized API Response Format │
           └──────────────────────────────────┘
                           │
                           ▼
                   ┌──────────────┐
                   │    Client    │
                   └──────────────┘
```

### Request Flow Steps:

1. **API Request**: Client sends a POST request with VTT file to `/api/interview_analysis/analyze`
2. **Dependency Injection**: FastAPI injects the required services via dependencies.py
3. **Workflow Orchestration**: InterviewWorkflow coordinates the analysis process
4. **Transcript Analysis**: TranscriptAnalyzer processes the VTT file using LLM chains
5. **Data Storage**: Analysis results are stored via InterviewRepository
6. **Response**: A standardized JSON response is returned to the client via the APIResponse utility

## Development Guidelines

- Follow PEP 8 style guidelines for Python code
- Write unit tests for all new functionality
- Document all public methods and classes
- Use dependency injection for service instantiation
- Follow the established error handling patterns
- Keep business logic in the domain layer 