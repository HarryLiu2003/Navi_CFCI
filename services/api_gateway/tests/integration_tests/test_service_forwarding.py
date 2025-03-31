"""
Integration tests for API Gateway service interactions.

These tests verify that the API Gateway correctly interacts with backend services,
focusing on end-to-end request/response flows with mocked services. They go beyond
unit tests by testing more complex interaction scenarios.
"""
import pytest
from unittest.mock import MagicMock
import httpx

@pytest.mark.integration
def test_interview_analysis_end_to_end(test_client, test_vtt_file):
    """
    Test end-to-end interview analysis flow with realistic responses.
    
    This test simulates a complete transaction with the interview analysis service,
    using a realistic mock response structure to verify the gateway correctly 
    processes and returns structured data.
    
    Args:
        test_client: FastAPI test client fixture
        test_vtt_file: Fixture providing a test VTT file
    """
    client, mock_http_client = test_client
    
    # Create a realistic mock response with complex structure
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
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
            ]
        }
    }
    
    # Configure mock to return the realistic response
    mock_post = mock_http_client.post
    mock_post.return_value = mock_response
    
    # Reset file position
    test_vtt_file.seek(0)
    
    # Make the request
    response = client.post(
        "/api/interview_analysis/analyze",
        files={"file": ("test.vtt", test_vtt_file, "text/vtt")}
    )
    
    # Verify the response structure in detail
    assert response.status_code == 200
    data = response.json()
    
    # Check top-level structure
    assert data["status"] == "success"
    assert "problem_areas" in data["data"]
    assert "synthesis" in data["data"]
    assert "transcript" in data["data"]
    assert "metadata" in data["data"]
    
    # Check detailed inner structure
    problem_area = data["data"]["problem_areas"][0]
    assert problem_area["title"] == "Interface Usability Concerns"
    assert len(problem_area["excerpts"]) == 1
    assert problem_area["excerpts"][0]["text"] == "It's really confusing to find the settings menu"

@pytest.mark.integration
def test_timeout_retry_mechanism(test_client, test_vtt_file):
    """
    Test error handling for transient service timeouts.
    
    This test verifies the API Gateway properly handles timeout errors from
    backend services and returns appropriate error responses.
    
    Args:
        test_client: FastAPI test client fixture
        test_vtt_file: Fixture providing a test VTT file
    """
    client, mock_http_client = test_client
    
    # Configure mock to raise a timeout exception
    mock_post = mock_http_client.post
    mock_post.side_effect = httpx.TimeoutException("Connection timed out")
    
    # Reset file position
    test_vtt_file.seek(0)
    
    # Make the request
    response = client.post(
        "/api/interview_analysis/analyze",
        files={"file": ("test.vtt", test_vtt_file, "text/vtt")}
    )
    
    # Verify the error response
    assert response.status_code == 504
    assert "timeout" in response.json()["detail"].lower()
    
    # Note: This test could be enhanced in the future to test a retry mechanism
    # if one is implemented in the API Gateway 