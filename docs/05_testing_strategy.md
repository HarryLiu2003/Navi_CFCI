# Testing Strategy

This document outlines the testing approach for the Navi CFCI platform.

## Overview

We employ a multi-layered testing strategy to ensure code quality, correctness, and system reliability, primarily focusing on automated tests runnable within the Docker development environment.

## 1. Unit Tests

*   **Purpose:** Verify individual functions, classes, or components in isolation, mocking external dependencies.
*   **Location:** `tests/unit_tests/` directory within each backend Python service. Frontend unit tests likely reside in `frontend/src/__tests__/` or alongside components (needs verification).
*   **Tools:**
    *   Backend (Python/FastAPI): `pytest`
    *   Frontend (Next.js/React): `jest`, `@testing-library/react`
    *   Database Service (Node/TS): **(Currently Missing)** Recommend `jest`.
*   **Execution (Docker):**
    ```bash
    # API Gateway
    docker compose exec navi_cfci-api_gateway-1 pytest tests/unit_tests

    # Interview Analysis
    docker compose exec navi_cfci-interview_analysis-1 pytest tests/unit_tests

    # Sprint1 Deprecated
    docker compose exec navi_cfci-sprint1_deprecated-1 pytest tests/unit_tests

    # Frontend (Jest tests currently missing)
    # docker compose exec navi_cfci-frontend-1 npm test

    # Database Service (No tests defined)
    ```

## 2. Integration Tests

*   **Purpose:** Test the interaction between multiple units *within a single service*, potentially involving mocked external *service* dependencies or mocked internal components like LLM calls.
*   **Location:** `tests/integration_tests/` directory within each backend Python service.
*   **Tools:** `pytest` (Backend).
*   **Execution (Docker):**
    ```bash
    docker compose exec navi_cfci-api_gateway-1 pytest tests/integration_tests
    docker compose exec navi_cfci-interview_analysis-1 pytest tests/integration_tests
    docker compose exec navi_cfci-sprint1_deprecated-1 pytest tests/integration_tests
    ```

## 3. API Tests (Service-Level)

*   **Purpose:** Test the API endpoints of a *single service* directly, mocking any calls it makes to *other* services or external APIs (like LLMs). Ensures the service's API contract is met.
*   **Location:** `tests/api_tests/` directory within each backend Python service.
*   **Tools:** `pytest` with FastAPI `TestClient` (which uses `httpx`).
*   **Execution (Docker):**
    ```bash
    docker compose exec navi_cfci-api_gateway-1 pytest tests/api_tests
    docker compose exec navi_cfci-interview_analysis-1 pytest tests/api_tests
    docker compose exec navi_cfci-sprint1_deprecated-1 pytest tests/api_tests
    ```

## 4. End-to-End (E2E) Tests

*   **Purpose:** Simulate real user scenarios by interacting with the *entire running application stack*.
*   **Location:**
    *   Frontend UI E2E: `frontend/cypress/e2e/`
    *   Full API E2E: `services/api_gateway/tests/e2e_tests/`
*   **Tools:**
    *   Frontend: Cypress
    *   API: `pytest` with `httpx` client hitting the running API Gateway.
*   **Execution (Requires `docker compose up`):**
    ```bash
    # Run Frontend Cypress tests headlessly
    docker compose exec navi_cfci-frontend-1 npm run cy:run

    # Run API Gateway E2E tests
    docker compose exec navi_cfci-api_gateway-1 pytest tests/e2e_tests
    ```

## 5. Manual Testing

*   **Purpose:** Exploratory testing, usability checks, verifying complex user flows not easily covered by automated tests.
*   **Process:** Follow user scenarios, attempt edge cases, check UI responsiveness and consistency after deployments or major changes.

## 6. CI/CD Pipeline

*   GitHub Actions workflow (see `deployment_guide.md`) should ideally run unit, integration, and API tests automatically on pushes/pull requests.
*   E2E tests might be run less frequently (e.g., nightly, pre-release) or manually triggered due to their longer execution time and dependency on a fully running environment.

## Areas for Improvement

*   **Database Service:** Lacks automated tests. Recommend adding Jest tests (unit, integration, API).
*   **Frontend (Jest):** Lacks unit/integration tests. Recommend adding tests for components and utilities.
*   **Test Coverage:** Implement coverage reporting (`pytest-cov`, Jest coverage) to identify gaps.
*   **Cypress Tests:** Update skipped tests by adding `data-testid` attributes to frontend components.