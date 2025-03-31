"""
Basic API tests for the interview analysis service.

These tests verify basic API functionality and health check endpoints.
Focus is on simple endpoint availability and response format validation.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.mark.api
def test_root_endpoint(test_client):
    """
    Test root endpoint health check functionality.
    
    Args:
        test_client: FastAPI test client fixture
    
    Test Steps:
        1. Send GET request to root endpoint
        2. Verify 200 status code
        3. Validate online status in response
    """
    response = test_client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "online" 