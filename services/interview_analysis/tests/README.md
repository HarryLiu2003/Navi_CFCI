# Testing Framework for Interview Analysis Service

This directory contains comprehensive test suite for the Interview Analysis service, testing all components from isolated units to integrated workflows.

## Test Structure

Tests are organized in the following directories:

- `unit_tests/`: Tests for individual components in isolation
- `integration_tests/`: Tests for component interactions
- `api_tests/`: Tests for API endpoints and request handling

## Running Tests

```bash
# Run all tests
docker exec navi_cfci-interview_analysis-1 python -m pytest

# Run with coverage
docker exec navi_cfci-interview_analysis-1 python -m pytest --cov=app

# Run a specific test file
docker exec navi_cfci-interview_analysis-1 python -m pytest tests/unit_tests/test_transcript_analyzer.py
```

## Test Coverage

The test suite verifies:

1. Transcript processing and chunking
2. Gemini 2.0 Flash integration 
3. Problem area identification
4. Excerpt categorization
5. Storage functionality
6. Error handling

## Key Test Files

- `test_transcript_analyzer.py`: Tests for transcript analysis
- `test_synthesis_chain.py`: Tests for Gemini integration
- `test_repository.py`: Tests for data storage
- `test_workflow.py`: Tests for business workflows
- `test_api.py`: Tests for API endpoints

## Mock Strategy

The tests use mocks to isolate dependencies:

- **LLM API**: All API calls to Gemini are mocked
- **Storage**: Repository interactions are mocked
- **File System**: File operations are mocked as needed

## Adding New Tests

When adding new tests:

1. Place in the appropriate directory (unit, integration, api)
2. Follow naming conventions of existing tests
3. Use dependency injection for easier mocking
4. Ensure tests are isolated and don't depend on external state 