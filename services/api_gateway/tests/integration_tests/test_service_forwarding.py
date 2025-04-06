"""
Integration tests for API Gateway service interactions.

These tests verify that the API Gateway correctly interacts with backend services,
focusing on end-to-end request/response flows with mocked services. They go beyond
unit tests by testing more complex interaction scenarios.
"""
import pytest
from unittest.mock import MagicMock
import httpx
from unittest.mock import patch
from unittest.mock import AsyncMock
import jwt

@pytest.mark.integration
@patch("app.middleware.auth.JWT_SECRET", "test_secret") # Use a consistent test secret
@patch("app.main.call_authenticated_service", new_callable=AsyncMock)
async def test_interview_analysis_end_to_end(mock_call_auth_service, test_client, test_vtt_file):
    """
    Test end-to-end interview analysis flow using the authenticated call mock.
    
    This integration test verifies that the gateway correctly processes
    an authenticated request and handles the structured response from the
    mocked call_authenticated_service function.
    """
    client, _ = test_client
    
    # Create a realistic mock response structure (as if returned by call_authenticated_service)
    realistic_success_data = {
        "status": "success",
        "message": "Interview analysis completed successfully",
        "data": {
            "problem_areas": [
                {
                    "problem_id": "usability-issue",
                    "title": "Interface Usability Concerns",
                    "description": "Users reported difficulty navigating the interface",
                    "excerpts": [
                        {
                            "text": "It's really confusing to find the settings menu",
                            "categories": ["Pain Point", "UX Issue"],
                            "insight_summary": "Navigation confusion",
                            "chunk_number": 5
                        }
                    ]
                }
            ],
            "synthesis": "The interview revealed issues with interface usability...",
            "metadata": {
                "transcript_length": 250,
                "problem_areas_count": 1,
                "excerpts_count": 1,
                "total_chunks": 10
            },
            "transcript": [
                {
                    "chunk_number": 5,
                    "speaker": "Interviewee",
                    "text": "It's really confusing to find the settings menu"
                }
            ],
            # Simulate successful storage info added by Interview Analysis service
            "storage": {"id": "mock-interview-id-123", "error": None} 
        }
    }
    
    # Configure mock to return the realistic response
    mock_call_auth_service.return_value = realistic_success_data
    
    # Reset file position
    test_vtt_file.seek(0)

    # Create a dummy valid token
    token = jwt.encode({"sub": "user-int-test"}, "test_secret", algorithm="HS256")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Make the authenticated request
    response = await client.post(
        "/api/interview_analysis/analyze",
        files={"file": ("test.vtt", test_vtt_file, "text/vtt")},
        headers=headers
    )
    
    # Verify the response structure in detail
    assert response.status_code == 200
    data = response.json()
    
    # Check top-level structure (should match the mocked return value)
    assert data == realistic_success_data 
    assert data["status"] == "success"
    assert "problem_areas" in data["data"]
    assert "synthesis" in data["data"]
    assert data["data"]["storage"]["id"] == "mock-interview-id-123"

@pytest.mark.integration
@patch("app.middleware.auth.JWT_SECRET", "test_secret")
@patch("app.main.call_authenticated_service", new_callable=AsyncMock)
async def test_timeout_retry_mechanism(mock_call_auth_service, test_client, test_vtt_file):
    """
    Test error handling for transient service timeouts via authenticated call mock.
    """
    client, _ = test_client
    
    # Configure mock to simulate a timeout response from call_authenticated_service
    mock_call_auth_service.return_value = {
        "status": "error",
        "message": "Request timed out: Connection timed out"
    }
    
    # Reset file position
    test_vtt_file.seek(0)

    # Create a dummy valid token
    token = jwt.encode({"sub": "user-int-timeout"}, "test_secret", algorithm="HS256")
    headers = {"Authorization": f"Bearer {token}"}
    
    # Make the request
    response = await client.post(
        "/api/interview_analysis/analyze",
        files={"file": ("test.vtt", test_vtt_file, "text/vtt")},
        headers=headers
    )
    
    # Verify the error response based on main.py handling
    assert response.status_code == 500 # Or 504 if specific check added
    assert "Interview analysis service error" in response.json()["detail"]
    assert "Request timed out" in response.json()["detail"]
    
    # Note: This test could be enhanced in the future to test a retry mechanism
    # if one is implemented in the API Gateway 