"""
End-to-End tests for API Gateway with real services.

These tests verify that the API Gateway correctly interacts with the actual backend
services in a real Docker Compose environment. They do not use mocks.

Run these tests with: pytest tests/e2e_tests/ -v
"""
import pytest
import os

@pytest.mark.e2e
def test_api_gateway_info(e2e_client):
    """
    Test that the API Gateway is up and returns correct service information.
    
    This test verifies:
    - The root endpoint is accessible
    - The service information is correctly returned
    - Expected endpoints are defined
    
    Args:
        e2e_client: HTTPx client for the API Gateway
    """
    response = e2e_client.get("/")
    
    # Verify basic response
    assert response.status_code == 200
    data = response.json()
    
    # Check service info
    assert data["name"] == "Navi CFCI API Gateway"
    assert "version" in data
    assert "endpoints" in data
    
    # Check that all expected endpoints are present
    assert "interview_analysis" in data["endpoints"]
    assert "sprint1_deprecated" in data["endpoints"]

@pytest.mark.e2e
def test_e2e_interview_analysis(e2e_client, e2e_test_vtt_file):
    """
    Test end-to-end interview analysis request flow with real services.
    
    This test verifies that:
    1. API Gateway accepts the VTT file upload
    2. It forwards the request to the interview_analysis service
    3. It receives and returns a valid response with expected structure
    
    Args:
        e2e_client: HTTPx client for the API Gateway
        e2e_test_vtt_file: Sample VTT file for testing
    """
    # Reset file position to beginning
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
    
    # Validate basic structure - actual content will depend on the live service
    assert data["status"] == "success"
    assert "data" in data
    assert "problem_areas" in data["data"]

@pytest.mark.e2e
def test_e2e_sprint1_preprocess(e2e_client, e2e_test_vtt_file):
    """
    Test end-to-end transcript preprocessing with real services.
    
    This test verifies that:
    1. API Gateway accepts the VTT file upload
    2. It forwards the request to the sprint1_deprecated service
    3. It receives and returns a valid preprocessed response with expected structure
    
    Args:
        e2e_client: HTTPx client for the API Gateway
        e2e_test_vtt_file: Sample VTT file for testing
    """
    # Reset file position to beginning
    e2e_test_vtt_file.seek(0)
    
    # Send the request to the real API Gateway
    files = {"file": ("test_e2e.vtt", e2e_test_vtt_file, "text/vtt")}
    response = e2e_client.post("/api/sprint1_deprecated/preprocess", files=files)
    
    # Skip test if service is unavailable
    if response.status_code in (503, 504):
        pytest.skip("Sprint1 deprecated service is not available")
    
    # Verify successful response
    assert response.status_code == 200
    data = response.json()
    
    # Validate basic structure
    assert data["status"] == "success"
    assert "data" in data
    assert "chunks" in data["data"]

@pytest.mark.e2e
def test_e2e_composite_workflow(e2e_client, e2e_test_vtt_file):
    """
    Test a complete workflow that uses multiple services in sequence.
    
    This test simulates a real user workflow:
    1. First preprocessing a transcript with sprint1_deprecated service
    2. Then analyzing the same transcript with interview_analysis service
    3. Verifying both operations produce valid and expected results
    
    This end-to-end test is particularly valuable as it verifies the complete
    user journey across multiple services.
    
    Args:
        e2e_client: HTTPx client for the API Gateway
        e2e_test_vtt_file: Sample VTT file for testing
    """
    # Step 1: Preprocess the transcript
    e2e_test_vtt_file.seek(0)
    files = {"file": ("test_e2e.vtt", e2e_test_vtt_file, "text/vtt")}
    preprocess_response = e2e_client.post("/api/sprint1_deprecated/preprocess", files=files)
    
    # Skip test if first service is unavailable
    if preprocess_response.status_code in (503, 504):
        pytest.skip("Sprint1 deprecated service is not available")
    
    # Verify preprocessing succeeded
    assert preprocess_response.status_code == 200
    preprocess_data = preprocess_response.json()
    assert preprocess_data["status"] == "success"
    
    # Step 2: Analyze the same transcript
    e2e_test_vtt_file.seek(0)
    files = {"file": ("test_e2e.vtt", e2e_test_vtt_file, "text/vtt")}
    analyze_response = e2e_client.post("/api/interview_analysis/analyze", files=files)
    
    # Skip test if second service is unavailable
    if analyze_response.status_code in (503, 504):
        pytest.skip("Interview analysis service is not available")
    
    # Verify analysis succeeded
    assert analyze_response.status_code == 200
    analyze_data = analyze_response.json()
    assert analyze_data["status"] == "success"
    
    # Verify we have both preprocessing results and analysis results
    assert "chunks" in preprocess_data["data"]
    assert "problem_areas" in analyze_data["data"]

@pytest.mark.e2e
def test_e2e_error_handling(e2e_client, e2e_test_invalid_file):
    """
    Test processing of invalid inputs in a real environment.
    
    This test verifies how the API Gateway and services handle invalid inputs by:
    1. Submitting an invalid non-VTT file
    2. Verifying the service rejects it appropriately
    3. Checking that the error response contains the expected error message
    
    Note: The service returns a 200 status code with an error message in the 
    response body rather than a 400 status code.
    
    Args:
        e2e_client: HTTPx client for the API Gateway
        e2e_test_invalid_file: Invalid file for testing error handling
    """
    # Reset file position to beginning
    e2e_test_invalid_file.seek(0)
    
    # Send invalid file to preprocess endpoint
    files = {"file": ("invalid.txt", e2e_test_invalid_file, "text/plain")}
    response = e2e_client.post("/api/sprint1_deprecated/preprocess", files=files)
    
    # Skip test if service is unavailable
    if response.status_code in (503, 504):
        pytest.skip("Sprint1 deprecated service is not available")
    
    # Get the response JSON
    data = response.json()
    
    # The service returns a specific error message for invalid files
    assert "detail" in data
    assert "Invalid file format" in data["detail"]
    assert ".vtt files" in data["detail"] 