import pytest
from fastapi.testclient import TestClient
import io
import json
import httpx
import sys
import os
from unittest.mock import patch, MagicMock, AsyncMock

# Add the parent directory to path to find the app module
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

try:
    from app.main import app
except ImportError:
    # If app module is not found at the current path, try the absolute path
    sys.path.insert(0, "/app")
    from app.main import app

#
# MOCK-BASED TEST FIXTURES (for unit/integration/API tests)
#

@pytest.fixture
def test_client():
    """
    Create a test client for the FastAPI application with mocked HTTP client.
    
    Returns:
        tuple: (TestClient, AsyncMock) - The FastAPI test client and mocked HTTP client
    """
    with patch("app.main.http_client") as mock_client:
        # Configure the mock for async usage
        mock_client.post = AsyncMock()
        client = TestClient(app)
        yield client, mock_client

@pytest.fixture
def test_vtt_content():
    """
    Return sample VTT content for testing.
    
    Returns:
        str: Sample VTT content with basic interview dialog
    """
    return """WEBVTT

1
00:00:00.000 --> 00:00:05.000
Interviewer: Hello, welcome to the interview.

2
00:00:05.000 --> 00:00:10.000
Interviewee: Thank you for having me."""

@pytest.fixture
def test_vtt_file(test_vtt_content):
    """
    Create a test VTT file as an in-memory file-like object.
    
    Args:
        test_vtt_content: Fixture providing VTT content
        
    Returns:
        BytesIO: File-like object containing VTT content
    """
    return io.BytesIO(test_vtt_content.encode())

@pytest.fixture
def test_invalid_file():
    """
    Create an invalid test file as an in-memory file-like object.
    
    Returns:
        BytesIO: File-like object containing non-VTT content
    """
    content = b"This is not a VTT file"
    return io.BytesIO(content)

@pytest.fixture
def mock_service_success_response():
    """
    Create a mock successful response from a service.
    
    Returns:
        MagicMock: Configured mock object simulating a successful response
    """
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "status": "success",
        "message": "Operation completed successfully",
        "data": {
            "result": "Sample result",
            "metadata": {
                "processing_time": "1.5s"
            }
        }
    }
    return mock_response

@pytest.fixture
def mock_service_error_response():
    """
    Create a mock error response from a service.
    
    Returns:
        MagicMock: Configured mock object simulating an error response
    """
    mock_response = MagicMock()
    mock_response.status_code = 500
    mock_response.text = "Internal Server Error"
    mock_response.json.return_value = {
        "status": "error",
        "message": "Service error occurred"
    }
    return mock_response

#
# E2E TEST FIXTURES (for tests against real services)
#

@pytest.fixture
def e2e_client():
    """
    Create a real HTTP client for E2E testing against the actual API Gateway.
    
    Returns:
        httpx.Client: Configured HTTP client pointing to the real API Gateway
    """
    # Use the deployed API Gateway URL - adjust if needed for different environments
    base_url = "http://localhost:8000"
    with httpx.Client(base_url=base_url, timeout=30.0) as client:
        yield client

@pytest.fixture
def e2e_test_vtt_content():
    """
    Return more complex sample VTT content for E2E testing.
    
    Returns:
        str: Sample VTT content with realistic interview dialog
    """
    return """WEBVTT

1
00:00:00.000 --> 00:00:05.000
Interviewer: What challenges have you faced with the current system?

2
00:00:05.000 --> 00:00:15.000
Interviewee: The main issue is the navigation. It's really confusing to find the settings menu.
The interface is not intuitive and I often get lost trying to find basic functions.

3
00:00:15.000 --> 00:00:20.000
Interviewer: How has that affected your productivity?

4
00:00:20.000 --> 00:00:30.000
Interviewee: I waste at least 15 minutes every day just looking for features I know exist somewhere in the system.
It's very frustrating and definitely impacts my work efficiency."""

@pytest.fixture
def e2e_test_vtt_file(e2e_test_vtt_content):
    """
    Create a test VTT file for E2E testing as an in-memory file-like object.
    
    Args:
        e2e_test_vtt_content: Fixture providing complex VTT content
        
    Returns:
        BytesIO: File-like object containing VTT content
    """
    return io.BytesIO(e2e_test_vtt_content.encode())

@pytest.fixture
def e2e_test_invalid_file():
    """
    Create an invalid test file for E2E testing as an in-memory file-like object.
    
    Returns:
        BytesIO: File-like object containing non-VTT content
    """
    content = b"This is not a VTT file, but a plain text file for testing error handling"
    return io.BytesIO(content) 