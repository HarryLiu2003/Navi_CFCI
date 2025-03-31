# Testing Framework for Interview Analysis Service

This directory contains the test suite for the Interview Analysis service, organized according to best practices for Python testing.

## Test Structure

Tests are organized in the following directories:

- `unit_tests/`: Unit tests for isolated components with no external dependencies
- `integration_tests/`: Tests that verify multiple components work together
- `api_tests/`: Tests for the API endpoints and request/response handling

Additionally, we maintain:
- `transcripts/`: Contains real-world test transcripts used for integration tests
- `conftest.py`: Shared test fixtures and configurations

## Test Files

### API Tests
- **test_api.py**: Tests for API endpoints and error handling
- **test_basic_api.py**: Simple API verification tests 
- **test_full_api_integration.py**: End-to-end API workflow tests

### Integration Tests
- **test_basic_integration.py**: Simple integration verification tests
- **test_chain_integration.py**: Tests for LLM chain integrations
- **test_real_transcript.py**: Tests using the real transcript data

### Unit Tests
- **test_basic_unit.py**: Basic regex and pattern tests
- **test_simple.py**: Verification of test configuration
- **test_synthesis_chain.py**: Unit tests for synthesis chain components
- **test_transcript_analyzer.py**: Tests for transcript analyzer service
- **test_transcript_parser.py**: Tests for transcript parsing functions

## Test Coverage

The test suite achieves 82% code coverage across the application. Coverage by module:

```
app/api/routes.py                        42      7    83%
app/config/api_config.py                 31     11    65%
app/config/logging_config.py              8      0   100%
app/config/settings.py                   13      0   100%
app/main.py                              23      4    83%
app/services/analyze.py                 145     32    78%
app/utils/analysis_chain/chain.py        84     13    85%
app/utils/analysis_chain/models.py       14      0   100%
app/utils/analysis_chain/prompts.py       4      0   100%
app/utils/api_responses.py               20      1    95%
```

## Test Categories

Tests are categorized using pytest markers:

- `@pytest.mark.unit`: Tests for individual components in isolation
- `@pytest.mark.integration`: Tests for component interactions
- `@pytest.mark.api`: API-specific tests

## Running Tests

```bash
# Run all tests
docker exec -it navi_cfci-interview_analysis-1 pytest

# Run only unit tests
docker exec -it navi_cfci-interview_analysis-1 pytest tests/unit_tests/

# Run only integration tests
docker exec -it navi_cfci-interview_analysis-1 pytest tests/integration_tests/

# Run only API tests
docker exec -it navi_cfci-interview_analysis-1 pytest tests/api_tests/

# Run with coverage
docker exec -it navi_cfci-interview_analysis-1 pytest --cov=app
```

## Test Fixtures

The test suite includes several fixtures:

### Common Fixtures
- `test_client`: FastAPI test client
- `test_vtt_file`: Simple in-memory VTT file for testing
- `test_invalid_file`: A non-VTT file for error testing
- `test_empty_file`: Empty file for error testing

### Real Transcript Testing
- `real_transcript_file`: Loads the actual interview transcript for realistic testing

### Mock Fixtures
- `mock_problem_chain`: Mock for LLM problem area extraction
- `mock_excerpt_chain`: Mock for LLM excerpt extraction
- `mock_synthesis_chain`: Mock for LLM synthesis

## Test Guidelines

1. **Test Independence**: Each test should be independent and not rely on the state from other tests.
2. **Appropriate Mocking**: External services like LLMs should be mocked.
3. **Descriptive Names**: Use clear, descriptive test names that explain what's being tested.
4. **Documentation**: Include docstrings that explain the purpose of each test.
5. **Proper Assertions**: Use specific assertions that clearly indicate what's being verified.

## Test Data

The `transcripts/` directory contains real transcript files used for testing. These are actual interview transcripts that test the system with real-world data.

## Adding New Tests

When adding new tests:

1. Choose the appropriate directory based on the test type
2. Use the proper pytest marker
3. Add clear docstrings explaining the test purpose
4. Use the provided fixtures when possible
5. Follow the existing pattern for mocking external dependencies

## Mocked Components

The test suite mocks:

- LLM API calls to avoid actual API usage during testing
- Chain invocations for controlled test environments
- File handling for consistent results

## Future Improvements

Future test enhancements could include:

1. Adding more specific error scenario tests
2. Implementing topic extraction testing (currently skipped)
3. Adding performance benchmarks for processing large transcripts
4. Implementing speaker detection testing 