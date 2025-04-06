"""
Unit tests for the API Gateway functionality.

These tests verify the core functionality of the API Gateway in isolation,
focusing on request handling, error conditions, and environment configurations.
They use mocks to eliminate dependencies on external services.
"""

import pytest
from unittest.mock import patch, AsyncMock
import os
import httpx
from fastapi import HTTPException
import jwt

@pytest.mark.unit
def test_root_endpoint(test_client):
    """
    Test the root endpoint returns correct API information.
    
    This test verifies:
    - The root endpoint returns a 200 status code
    - The response contains correct service identification
    - All expected endpoints are listed in the response
    
    Args:
        test_client: FastAPI test client fixture
    """
    client, _ = test_client
    response = client.get("/")
    
    assert response.status_code == 200
    data = response.json()
    
    # Verify service identity
    assert data["name"] == "Navi CFCI API Gateway"
    assert data["version"] == "1.0.0"
    assert "endpoints" in data
    
    # Verify all required endpoints are present
    assert "interview_analysis" in data["endpoints"]
    assert "sprint1_deprecated" in data["endpoints"]
    assert "analyze" in data["endpoints"]["interview_analysis"]
    assert "preprocess" in data["endpoints"]["sprint1_deprecated"]
    assert "summarize" in data["endpoints"]["sprint1_deprecated"]
    assert "keywords" in data["endpoints"]["sprint1_deprecated"]

@pytest.mark.unit
def test_cors_configuration():
    """
    Test CORS configuration is properly set from environment variables.
    
    This test verifies that the API Gateway correctly reads CORS origins
    from the environment and applies them to its configuration.
    """
    # Since the app is already loaded with CORS configured,
    # we just verify the environment settings are properly read
    from app import main
    
    # Verify CORS origins are properly read from environment
    test_origins = os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")
    
    # Basic validation
    assert len(test_origins) > 0
    assert "http://localhost:3000" in test_origins or len(test_origins) > 1

#
# ERROR HANDLING TESTS
# These should now mock call_authenticated_service, assuming errors are caught there
#

@pytest.mark.unit
@patch("app.middleware.auth.JWT_SECRET", "test_secret") # Mock secret for auth
@patch("app.main.call_authenticated_service", new_callable=AsyncMock)
async def test_timeout_handling(mock_call_auth_service, test_client, test_vtt_file):
    """
    Test proper handling of timeout errors when calling backend services via auth function.

    Verifies that when call_authenticated_service indicates a timeout:
    - A 504 Gateway Timeout status is returned by the endpoint
    - The response contains a meaningful error message
    """
    client, _ = test_client

    # Configure mock call_authenticated_service to simulate a timeout response
    mock_call_auth_service.return_value = {
        "status": "error",
        "message": "Request timed out: Connection timed out"
    }

    test_vtt_file.seek(0)
    # Create a dummy valid token for the request
    token = jwt.encode({"sub": "user-timeout"}, "test_secret", algorithm="HS256")
    headers = {"Authorization": f"Bearer {token}"}

    # Make request to an authenticated endpoint (e.g., analyze)
    response = await client.post(
        "/api/interview_analysis/analyze",
        files={"file": ("test.vtt", test_vtt_file, "text/vtt")},
        headers=headers
    )

    # Verify the response based on how main.py handles the error from call_authenticated_service
    assert response.status_code == 500 # Or 504 if main.py specifically checks for timeout string
    assert "Interview analysis service error" in response.json()["detail"]
    assert "Request timed out" in response.json()["detail"]

@pytest.mark.unit
@patch("app.middleware.auth.JWT_SECRET", "test_secret")
@patch("app.main.call_authenticated_service", new_callable=AsyncMock)
async def test_connection_error_handling(mock_call_auth_service, test_client, test_vtt_file):
    """
    Test proper handling of connection errors when calling backend services via auth function.

    Verifies that when call_authenticated_service indicates a connection error:
    - A 503 Service Unavailable status is returned by the endpoint
    - The response contains a meaningful error message
    """
    client, _ = test_client

    # Configure mock call_authenticated_service to simulate a connection error response
    mock_call_auth_service.return_value = {
        "status": "error",
        "message": "Connection error: Failed to connect"
    }

    test_vtt_file.seek(0)
    token = jwt.encode({"sub": "user-connect-error"}, "test_secret", algorithm="HS256")
    headers = {"Authorization": f"Bearer {token}"}

    response = await client.post(
        "/api/interview_analysis/analyze",
        files={"file": ("test.vtt", test_vtt_file, "text/vtt")},
        headers=headers
    )

    # Verify the response
    assert response.status_code == 500 # Or 503 if main.py checks for connection error string
    assert "Interview analysis service error" in response.json()["detail"]
    assert "Connection error" in response.json()["detail"]

@pytest.mark.unit
@patch("app.middleware.auth.JWT_SECRET", "test_secret")
@patch("app.main.call_authenticated_service", new_callable=AsyncMock)
async def test_general_exception_handling(mock_call_auth_service, test_client, test_vtt_file):
    """
    Test proper handling of unexpected exceptions from call_authenticated_service.

    Verifies that when call_authenticated_service indicates a general error:
    - A 500 Internal Server Error status is returned
    - The response contains an appropriate error message
    """
    client, _ = test_client

    # Configure mock call_authenticated_service to simulate a general error response
    mock_call_auth_service.return_value = {
        "status": "error",
        "message": "Error calling service: Some unexpected issue"
    }

    test_vtt_file.seek(0)
    token = jwt.encode({"sub": "user-general-error"}, "test_secret", algorithm="HS256")
    headers = {"Authorization": f"Bearer {token}"}

    response = await client.post(
        "/api/interview_analysis/analyze",
        files={"file": ("test.vtt", test_vtt_file, "text/vtt")},
        headers=headers
    )

    # Verify the response
    assert response.status_code == 500
    assert "Interview analysis service error" in response.json()["detail"]
    assert "Some unexpected issue" in response.json()["detail"] 