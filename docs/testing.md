# Testing Guide

This guide explains the testing approach for the Navi CFCI project.

## Testing Philosophy

For a small team, we focus on practical, effective testing that provides value without excessive overhead:

- Tests provide confidence in the codebase
- Manual test execution before key events (PRs, deployments)
- Focus on testing critical functionality

## Testing Categories

The project uses three distinct testing approaches:

1. [Frontend Unit Tests](#frontend-unit-tests-jest) - Test individual React components and utilities
2. [Frontend End-to-End Tests](#frontend-end-to-end-tests-cypress) - Test complete user flows
3. [Backend Service Tests](#backend-service-tests-pytest) - Test API endpoints and service logic

## Testing Workflow

Here's the recommended workflow for testing the Navi CFCI project:

1. **Start the development environment**:
   ```bash
   docker compose up
   ```

2. **Run tests in the running containers**:
   ```bash
   # Run all backend tests
   docker exec -it navi_cfci-api_gateway-1 pytest
   docker exec -it navi_cfci-interview_analysis-1 pytest
   docker exec -it navi_cfci-sprint1_deprecated-1 pytest
   
   # Run only unit tests for backend
   docker exec -it navi_cfci-interview_analysis-1 pytest tests/unit_tests/
   
   # Run frontend tests
   docker exec -it navi_cfci-frontend-1 npm test
   
   # Run frontend E2E tests
   docker exec -it navi_cfci-frontend-1 npm run cy:run
   ```

3. **When to run tests**:
   - During development: Run relevant tests for code you're changing
   - Before creating a PR: Run all tests for affected components
   - Before deployment: Run the complete test suite

## Frontend Unit Tests (Jest)

Jest tests verify individual components and utilities in isolation.

### Running Unit Tests

```bash
# Run tests in the running Docker container
docker exec -it navi_cfci-frontend-1 npm test

# Run tests in watch mode
docker exec -it navi_cfci-frontend-1 npm run test:watch

# Generate coverage report
docker exec -it navi_cfci-frontend-1 npm run test:coverage
```

### Writing Unit Tests

Place test files in `__tests__` directories adjacent to the code being tested:

```
src/
├── components/
│   ├── __tests__/          # Tests for components
│   │   └── Button.test.tsx
│   └── Button.tsx
├── lib/
│   ├── __tests__/          # Tests for utilities
│   │   └── api.test.ts
│   └── api.ts
```

### Test Pattern

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../Button';

describe('Button Component', () => {
  it('renders correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('handles clicks', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

## Frontend End-to-End Tests (Cypress)

Cypress tests simulate user interactions with the application in a real browser.

> **Detailed Documentation**: See the [Cypress Test README](../frontend/cypress/README.md) for more details.

### Running E2E Tests

```bash
# Run Cypress tests in the running Docker container
docker exec -it navi_cfci-frontend-1 npm run cy:run

# Run specific tests
docker exec -it navi_cfci-frontend-1 npm run cy:run --spec "cypress/e2e/transcript-processing.cy.js"
```

### Key Test Files

- `cypress/e2e/transcript-processing.cy.js` - Tests transcript upload and analysis
- `cypress/e2e/navigation.cy.js` - Tests site navigation
- `cypress/support/commands.js` - Custom test commands

### Test Example

```javascript
// cypress/e2e/transcript-processing.cy.js
describe('Transcript Processing', () => {
  it('uploads and processes a transcript', () => {
    cy.visit('/');
    cy.contains('Upload New Transcript').click();
    cy.get('input[type="file"]').attachFile('sample.vtt');
    cy.get('button[type="submit"]').click();
    cy.contains('Analysis complete').should('exist');
  });
});
```

## Backend Service Tests (PyTest)

PyTest tests verify API endpoints, service logic, and data processing in the backend services.

> **Detailed Documentation**: See each service's tests README for service-specific details:
> - [API Gateway Tests README](../services/api_gateway/tests/README.md)
> - [Interview Analysis Tests README](../services/interview_analysis/tests/README.md)
> - [Sprint1 Deprecated Tests README](../services/sprint1_deprecated/tests/README.md)

### Running Backend Tests

```bash
# Run tests in the running Docker containers
docker exec -it navi_cfci-interview_analysis-1 pytest
docker exec -it navi_cfci-api_gateway-1 pytest
docker exec -it navi_cfci-sprint1_deprecated-1 pytest

# Run specific test categories
docker exec -it navi_cfci-interview_analysis-1 pytest tests/unit_tests/
docker exec -it navi_cfci-interview_analysis-1 pytest tests/api_tests/
docker exec -it navi_cfci-interview_analysis-1 pytest tests/integration_tests/

# Run with coverage report
docker exec -it navi_cfci-interview_analysis-1 pytest --cov=app
```

### Test Structure

Backend tests are organized by type:

```
services/{service_name}/
├── tests/
│   ├── unit_tests/         # Test individual functions 
│   │   └── test_*.py
│   ├── api_tests/          # Test API endpoints
│   │   └── test_*.py
│   └── integration_tests/  # Test service interactions
│       └── test_*.py
```

### Test Example

```python
# services/interview_analysis/tests/unit_tests/test_transcript_analyzer.py
import pytest
from app.services.analyze import TranscriptAnalyzer

@pytest.mark.asyncio
async def test_preprocess_vtt(test_vtt_file):
    # Arrange
    analyzer = TranscriptAnalyzer()
    
    # Act
    result = await analyzer.preprocess_vtt(test_vtt_file)
    
    # Assert
    assert "chunks" in result
    assert len(result["chunks"]) > 0
    assert "speaker" in result["chunks"][0]
    assert "text" in result["chunks"][0]
```

## Test Data Management

### Test Fixtures

Each service includes test fixtures for common test data:

- **Test VTT Files**: Sample transcript files for testing
- **Mock API Responses**: Simulated responses from external APIs
- **Test Clients**: Pre-configured API clients for testing endpoints

### Mocking External APIs

When testing components that use external APIs (like Gemini or OpenAI):

```python
# Example of mocking LLM API call
@pytest.fixture
def mock_llm_response(monkeypatch):
    def mock_generate(*args, **kwargs):
        return {"text": "Mocked LLM response", "usage": {"total_tokens": 150}}
    
    monkeypatch.setattr("app.services.llm.generate_text", mock_generate)
    return mock_generate
```

## Continuous Integration Testing

Our GitHub Actions workflow automatically runs tests on each PR and before deployment:

1. Starts the Docker environment
2. Runs backend tests
3. Runs frontend tests 
4. Only proceeds with deployment if all tests pass

See the [CI/CD workflow](../.github/workflows/deploy.yml) for implementation details. 