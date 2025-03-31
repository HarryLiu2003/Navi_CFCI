"""
API endpoint tests for the API Gateway service.

These tests verify that the API Gateway endpoints correctly handle requests 
and properly forward them to their respective backend services using mocks.
They focus on testing the routing and handling of responses without requiring
real backend services.
"""
import pytest
from unittest.mock import patch

@pytest.mark.api
def test_interview_analysis_endpoint(test_client, test_vtt_file, mock_service_success_response):
    """
    Test the interview analysis endpoint properly forwards requests.
    
    This test verifies:
    - Requests to /api/interview_analysis/analyze are correctly forwarded
    - The correct backend service URL is used
    - Responses from the backend service are properly returned
    
    Args:
        test_client: FastAPI test client fixture
        test_vtt_file: Fixture providing a test VTT file
        mock_service_success_response: Mock successful response from the service
    """
    client, mock_http_client = test_client
    
    # Configure mock to return success response
    mock_post = mock_http_client.post
    mock_post.return_value = mock_service_success_response
    
    # Reset file position
    test_vtt_file.seek(0)
    
    # Make the request
    response = client.post(
        "/api/interview_analysis/analyze",
        files={"file": ("test.vtt", test_vtt_file, "text/vtt")}
    )
    
    # Verify the request was forwarded to the correct URL
    mock_post.assert_called_once()
    call_args = mock_post.call_args
    assert "interview_analysis:8001/api/interview_analysis/analyze" in call_args[0][0]
    
    # Verify the response is returned correctly
    assert response.status_code == 200
    assert response.json() == mock_service_success_response.json.return_value

@pytest.mark.api
def test_sprint1_preprocess_endpoint(test_client, test_vtt_file, mock_service_success_response):
    """
    Test the sprint1 preprocess endpoint properly forwards requests.
    
    This test verifies:
    - Requests to /api/sprint1_deprecated/preprocess are correctly forwarded
    - The correct backend service URL is used
    - Responses from the backend service are properly returned
    
    Args:
        test_client: FastAPI test client fixture
        test_vtt_file: Fixture providing a test VTT file
        mock_service_success_response: Mock successful response from the service
    """
    client, mock_http_client = test_client
    
    # Configure mock to return success response
    mock_post = mock_http_client.post
    mock_post.return_value = mock_service_success_response
    
    # Reset file position
    test_vtt_file.seek(0)
    
    # Make the request
    response = client.post(
        "/api/sprint1_deprecated/preprocess",
        files={"file": ("test.vtt", test_vtt_file, "text/vtt")}
    )
    
    # Verify the request was forwarded to the correct URL
    mock_post.assert_called_once()
    call_args = mock_post.call_args
    assert "sprint1_deprecated:8002/api/sprint1_deprecated/preprocess" in call_args[0][0]
    
    # Verify the response is returned correctly
    assert response.status_code == 200
    assert response.json() == mock_service_success_response.json.return_value

@pytest.mark.api
def test_sprint1_summarize_endpoint(test_client, test_vtt_file, mock_service_success_response):
    """
    Test the sprint1 summarize endpoint properly forwards requests.
    
    This test verifies:
    - Requests to /api/sprint1_deprecated/summarize are correctly forwarded
    - The correct backend service URL is used
    - Responses from the backend service are properly returned
    
    Args:
        test_client: FastAPI test client fixture
        test_vtt_file: Fixture providing a test VTT file
        mock_service_success_response: Mock successful response from the service
    """
    client, mock_http_client = test_client
    
    # Configure mock to return success response
    mock_post = mock_http_client.post
    mock_post.return_value = mock_service_success_response
    
    # Reset file position
    test_vtt_file.seek(0)
    
    # Make the request
    response = client.post(
        "/api/sprint1_deprecated/summarize",
        files={"file": ("test.vtt", test_vtt_file, "text/vtt")}
    )
    
    # Verify the request was forwarded to the correct URL
    mock_post.assert_called_once()
    call_args = mock_post.call_args
    assert "sprint1_deprecated:8002/api/sprint1_deprecated/summarize" in call_args[0][0]
    
    # Verify the response is returned correctly
    assert response.status_code == 200
    assert response.json() == mock_service_success_response.json.return_value

@pytest.mark.api
def test_sprint1_keywords_endpoint(test_client, test_vtt_file, mock_service_success_response):
    """
    Test the sprint1 keywords endpoint properly forwards requests.
    
    This test verifies:
    - Requests to /api/sprint1_deprecated/keywords are correctly forwarded
    - The correct backend service URL is used
    - Responses from the backend service are properly returned
    
    Args:
        test_client: FastAPI test client fixture
        test_vtt_file: Fixture providing a test VTT file
        mock_service_success_response: Mock successful response from the service
    """
    client, mock_http_client = test_client
    
    # Configure mock to return success response
    mock_post = mock_http_client.post
    mock_post.return_value = mock_service_success_response
    
    # Reset file position
    test_vtt_file.seek(0)
    
    # Make the request
    response = client.post(
        "/api/sprint1_deprecated/keywords",
        files={"file": ("test.vtt", test_vtt_file, "text/vtt")}
    )
    
    # Verify the request was forwarded to the correct URL
    mock_post.assert_called_once()
    call_args = mock_post.call_args
    assert "sprint1_deprecated:8002/api/sprint1_deprecated/keywords" in call_args[0][0]
    
    # Verify the response is returned correctly
    assert response.status_code == 200
    assert response.json() == mock_service_success_response.json.return_value

@pytest.mark.api
def test_service_error_handling(test_client, test_vtt_file, mock_service_error_response):
    """
    Test handling of error responses from backend services.
    
    This test verifies:
    - The API Gateway correctly propagates errors from backend services
    - Error status codes and messages are preserved
    - The proper error format is returned to the client
    
    Args:
        test_client: FastAPI test client fixture
        test_vtt_file: Fixture providing a test VTT file
        mock_service_error_response: Mock error response from the service
    """
    client, mock_http_client = test_client
    
    # Configure mock to return error response
    mock_post = mock_http_client.post
    mock_post.return_value = mock_service_error_response
    
    # Reset file position
    test_vtt_file.seek(0)
    
    # Make the request
    response = client.post(
        "/api/interview_analysis/analyze",
        files={"file": ("test.vtt", test_vtt_file, "text/vtt")}
    )
    
    # Verify the error response is propagated correctly
    assert response.status_code == 500
    assert "Analysis service error" in response.json()["detail"] 