# Testing Framework for Sprint1 Deprecated Service

This directory contains the test suite for the Sprint1 Deprecated service, organized according to best practices for Python testing.

## Test Structure

Tests are organized in the following directories:

- `unit_tests/`: Unit tests for isolated components with no external dependencies
- `integration_tests/`: Tests that verify multiple components work together
- `api_tests/`: Tests for the API endpoints and request/response handling

## Test Files

### API Tests
- **test_endpoints.py**: Tests for API endpoints including preprocessing, summarization, and keyword extraction

### Integration Tests
- **test_workflow.py**: End-to-end workflow tests covering the complete process from preprocessing to analysis

### Unit Tests
- **test_preprocessor.py**: Tests for transcript preprocessing functionality and VTT file handling

## Test Categories

Tests are categorized using pytest markers (defined in pytest.ini):

- `@pytest.mark.unit`: Tests for individual components in isolation
- `@pytest.mark.integration`: Tests for component interactions
- `@pytest.mark.api`: API-specific tests

## Running Tests

```bash
# Run all tests
docker compose run --rm sprint1_deprecated pytest tests/ -v

# Run only unit tests
docker compose run --rm sprint1_deprecated pytest tests/unit_tests/ -v

# Run only integration tests
docker compose run --rm sprint1_deprecated pytest tests/integration_tests/ -v

# Run only API tests
docker compose run --rm sprint1_deprecated pytest tests/api_tests/ -v
```

## Test Fixtures

The test suite includes several fixtures:

### Common Fixtures
- `test_client`: FastAPI test client
- `test_vtt_file`: Simple in-memory VTT file for testing
- `test_invalid_file`: A non-VTT file for error testing

## Test Guidelines

1. **Test Independence**: Each test should be independent and not rely on the state from other tests.
2. **Appropriate Mocking**: External services (like OpenAI API) should be mocked appropriately.
3. **Descriptive Names**: Use clear, descriptive test names that explain what's being tested.
4. **Documentation**: Include docstrings that explain the purpose of each test.
5. **Proper Assertions**: Use specific assertions that clearly indicate what's being verified.

## Test Configuration

The test suite uses pytest.ini for configuration:

- Logging is enabled at INFO level
- Test discovery patterns are configured
- Custom markers are defined
- Log format is standardized

## Dependencies

Key testing dependencies (from requirements.txt):
- pytest>=8.0.2
- pytest-asyncio>=0.23.5

## API Test Coverage

The test suite covers the following API endpoints:

1. **Preprocessing** (`/api/sprint1_deprecated/preprocess`)
   - Successful VTT file processing
   - Invalid file format handling
   - Response structure validation

2. **Summarization** (`/api/sprint1_deprecated/summarize`)
   - Transcript summarization
   - Response metadata verification
   - Error handling

3. **Keyword Extraction** (`/api/sprint1_deprecated/keywords`)
   - Keyword and insight extraction
   - Analysis results validation
   - Metadata verification

## Future Improvements

Potential areas for test enhancement:

1. Add performance benchmarks for large transcripts
2. Implement more error scenario tests
3. Add test coverage reporting
4. Enhance mocking of external dependencies
5. Add stress testing scenarios 