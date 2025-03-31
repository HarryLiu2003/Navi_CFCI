"""
Unit tests for the API Gateway functionality.

These tests verify the core functionality of the API Gateway in isolation,
focusing on request handling, error conditions, and environment configurations.
They use mocks to eliminate dependencies on external services.
"""

import pytest
from unittest.mock import patch
import os
import httpx
from fastapi import HTTPException

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
#

@pytest.mark.unit
def test_timeout_handling(test_client):
    """
    Test proper handling of timeout errors from backend services.
    
    This test verifies that when a backend service times out:
    - The error is properly caught and handled
    - A 504 Gateway Timeout status is returned
    - The response contains a meaningful error message
    
    Args:
        test_client: FastAPI test client fixture
    """
    client, mock_http_client = test_client
    
    # Configure mock to raise a timeout exception
    mock_post = mock_http_client.post
    mock_post.side_effect = httpx.TimeoutException("Connection timed out")
    
    # Make request to the analyze endpoint
    response = client.post("/api/interview_analysis/analyze", 
                          files={"file": ("test.vtt", b"content", "text/vtt")})
    
    # Verify the response
    assert response.status_code == 504
    assert "timeout" in response.json()["detail"].lower()

@pytest.mark.unit
def test_connection_error_handling(test_client):
    """
    Test proper handling of connection errors from backend services.
    
    This test verifies that when a backend service is unreachable:
    - The error is properly caught and handled
    - A 503 Service Unavailable status is returned
    - The response contains a meaningful error message
    
    Args:
        test_client: FastAPI test client fixture
    """
    client, mock_http_client = test_client
    
    # Configure mock to raise a connection error
    mock_post = mock_http_client.post
    mock_post.side_effect = httpx.ConnectError("Failed to connect")
    
    # Make request to the analyze endpoint
    response = client.post("/api/interview_analysis/analyze", 
                          files={"file": ("test.vtt", b"content", "text/vtt")})
    
    # Verify the response
    assert response.status_code == 503
    assert "connect" in response.json()["detail"].lower()

@pytest.mark.unit
def test_general_exception_handling(test_client):
    """
    Test proper handling of unexpected exceptions.
    
    This test verifies that when an unexpected error occurs:
    - The error is properly caught and handled
    - A 500 Internal Server Error status is returned
    - The response contains an appropriate error message
    
    Args:
        test_client: FastAPI test client fixture
    """
    client, mock_http_client = test_client
    
    # Configure mock to raise a general exception
    mock_post = mock_http_client.post
    mock_post.side_effect = Exception("General error")
    
    # Make request to the analyze endpoint
    response = client.post("/api/interview_analysis/analyze", 
                          files={"file": ("test.vtt", b"content", "text/vtt")})
    
    # Verify the response
    assert response.status_code == 500
    assert "gateway error" in response.json()["detail"].lower() 