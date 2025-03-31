# Testing Framework for API Gateway Service

This directory contains the test suite for the API Gateway service, organized according to best practices for Python testing.

## Test Structure

Tests are organized in the following categories:

- **Unit Tests** (`unit_tests/`): Test isolated components without external dependencies
- **API Tests** (`api_tests/`): Test API endpoints and request/response handling
- **Integration Tests** (`integration_tests/`): Test component interactions and more complex flows
- **E2E Tests** (`e2e_tests/`): Test the entire system with actual running services

## Key Test Files

| Category | File | Description |
|----------|------|-------------|
| Unit | `test_gateway.py` | Core gateway functionality, error handling, configuration |
| API | `test_endpoints.py` | API endpoint routing and response handling |
| Integration | `test_service_forwarding.py` | Service interactions and complex flows |
| E2E | `test_e2e_service_interactions.py` | Real-world tests with actual services |

## Test Categories (Markers)

Tests use pytest markers for easy filtering:

- `@pytest.mark.unit`: Unit tests
- `@pytest.mark.api`: API endpoint tests
- `@pytest.mark.integration`: Integration tests
- `@pytest.mark.e2e`: End-to-end tests

## Running Tests

```bash
# Run all tests
docker compose run --rm api_gateway pytest

# Run with detailed output
docker compose run --rm api_gateway pytest -v

# Run specific test category
docker compose run --rm api_gateway pytest -m unit
docker compose run --rm api_gateway pytest -m api
docker compose run --rm api_gateway pytest -m integration
docker compose run --rm api_gateway pytest -m e2e

# Run tests with coverage report
docker compose run --rm api_gateway pytest --cov=app --cov-report=term-missing
```

## Test Fixtures

The test suite includes fixtures for both mock-based and real-world testing:

### Mock-Based Test Fixtures
- `test_client`: TestClient with mocked HTTP client
- `test_vtt_file`: Simple VTT file for testing
- `test_invalid_file`: Non-VTT file for error testing
- `mock_service_success_response`: Mock successful response
- `mock_service_error_response`: Mock error response

### E2E Test Fixtures
- `e2e_client`: Real HTTP client for actual API Gateway
- `e2e_test_vtt_file`: More complex VTT file for E2E testing
- `e2e_test_invalid_file`: Invalid file for error handling in real environment

## Testing Approach

### Unit and API Tests
Unit and API tests use mocks to isolate components and avoid dependencies on external services:

```python
@pytest.mark.unit
def test_timeout_handling(test_client):
    """Test proper handling of timeout errors from backend services."""
    client, mock_http_client = test_client
    
    # Configure mock to raise a timeout exception
    mock_http_client.post.side_effect = httpx.TimeoutException("Connection timed out")
    
    # Make request to the analyze endpoint
    response = client.post("/api/interview_analysis/analyze", 
                          files={"file": ("test.vtt", b"content", "text/vtt")})
    
    # Verify the response
    assert response.status_code == 504
    assert "timeout" in response.json()["detail"].lower()
```

### E2E Tests
E2E tests interact with actual running services to verify real-world behavior:

```python
@pytest.mark.e2e
def test_e2e_interview_analysis(e2e_client, e2e_test_vtt_file):
    """Test end-to-end interview analysis request flow with real services."""
    # Reset file position
    e2e_test_vtt_file.seek(0)
    
    # Send the request to the real API Gateway
    files = {"file": ("test_e2e.vtt", e2e_test_vtt_file, "text/vtt")}
    response = e2e_client.post("/api/interview_analysis/analyze", files=files)
    
    # Skip test if service is unavailable
    if response.status_code in (503, 504):
        pytest.skip("Interview analysis service is not available")
    
    # Verify successful response
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "problem_areas" in data["data"]
```

## API Endpoint Coverage

The test suite covers all API Gateway endpoints:

1. **Root** (`/`) - Service information
2. **Interview Analysis** (`/api/interview_analysis/analyze`) - Process interview data
3. **Sprint1 Endpoints**:
   - Preprocess (`/api/sprint1_deprecated/preprocess`)
   - Summarize (`/api/sprint1_deprecated/summarize`)
   - Keywords (`/api/sprint1_deprecated/keywords`)

## Future Improvements

Potential enhancements to consider:

1. Implement a retry mechanism for transient failures
2. Add performance/load testing for concurrent requests
3. Add security tests for authentication/authorization
4. Expand error scenario testing
5. Implement contract tests for service interfaces 