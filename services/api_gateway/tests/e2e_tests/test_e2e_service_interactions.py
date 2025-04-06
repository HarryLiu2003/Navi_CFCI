"""
End-to-End tests for API Gateway with real services.

These tests verify that the API Gateway correctly interacts with the actual backend
services in a real Docker Compose environment. They do not use mocks.

Run these tests with: pytest tests/e2e_tests/ -v
"""
import pytest
import os
import time
import jwt

# Test secret key (must match local .env secrets)
TEST_SECRET = "NeE9JGhYhvZQKtFhPEUh5FrWGFXbZzUVMNeHAb6CLFM"

# Helper to create a valid test token (copied from api_tests)
def create_valid_test_token(user_id: str = "test-e2e-user") -> str:
    payload = {
        "sub": user_id,
        "name": "E2E Test User", # Add other claims if needed by backend/auth flow
        "email": f"{user_id}@test.com",
        "exp": int(time.time()) + 3600 # Expires in 1 hour
    }
    return jwt.encode(payload, TEST_SECRET, algorithm="HS256")


@pytest.mark.e2e
def test_api_gateway_info(e2e_client):
    """
    Test that the API Gateway is up and returns correct service information.
    (No auth required for root).
    """
    response = e2e_client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Navi CFCI API Gateway"
    assert "endpoints" in data
    assert "interview_analysis" in data["endpoints"]
    assert "sprint1_deprecated" in data["endpoints"]

@pytest.mark.e2e
def test_e2e_interview_analysis(e2e_client, e2e_test_vtt_file):
    """
    Test end-to-end interview analysis request flow with authentication.
    Verifies JWT auth, forwarding, analysis, storage, and response structure.
    """
    e2e_test_vtt_file.seek(0)
    
    # Create auth token and headers
    auth_token = create_valid_test_token("e2e-analysis-user")
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    # Prepare form data (including userId, although gateway should use token)
    form_data = {"userId": "e2e-analysis-user"} 
    files = {"file": ("test_e2e.vtt", e2e_test_vtt_file, "text/vtt")}
    
    # Send the authenticated request to the real API Gateway
    response = e2e_client.post(
        "/api/interview_analysis/analyze", 
        files=files,
        data=form_data, # Send userId in form too, as frontend does
        headers=headers
    )
    
    # Skip test if service is unavailable
    if response.status_code in (503, 504):
        pytest.skip("Interview analysis service is not available")
    
    # Verify successful response (200 OK)
    assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}. Response: {response.text}"
    data = response.json()
    
    # Validate basic structure and successful storage
    assert data.get("status") == "success"
    assert "data" in data
    analysis_data = data["data"]
    assert "problem_areas" in analysis_data
    assert "synthesis" in analysis_data
    assert "transcript" in analysis_data
    assert "metadata" in analysis_data
    # Crucially, check that storage succeeded and an ID was returned
    assert "storage" in analysis_data
    assert analysis_data["storage"].get("error") is None, f"Storage error reported: {analysis_data['storage'].get('error')}"
    assert analysis_data["storage"].get("id") is not None, "Storage ID is missing from the response"
    assert isinstance(analysis_data["storage"].get("id"), str)

@pytest.mark.e2e
def test_e2e_sprint1_preprocess(e2e_client, e2e_test_vtt_file):
    """
    Test end-to-end transcript preprocessing.
    (Assumes sprint1 endpoint doesn't require strict user auth).
    """
    e2e_test_vtt_file.seek(0)
    files = {"file": ("test_e2e.vtt", e2e_test_vtt_file, "text/vtt")}
    response = e2e_client.post("/api/sprint1_deprecated/preprocess", files=files)
    
    if response.status_code in (503, 504):
        pytest.skip("Sprint1 deprecated service is not available")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "data" in data
    assert "chunks" in data["data"]

# Note: Composite workflow might need auth for the analysis step now
@pytest.mark.e2e
def test_e2e_composite_workflow(e2e_client, e2e_test_vtt_file):
    """
    Test a complete workflow using multiple services (preprocess -> analyze).
    """
    # Step 1: Preprocess the transcript (assuming no auth needed)
    e2e_test_vtt_file.seek(0)
    files = {"file": ("test_e2e.vtt", e2e_test_vtt_file, "text/vtt")}
    preprocess_response = e2e_client.post("/api/sprint1_deprecated/preprocess", files=files)
    if preprocess_response.status_code in (503, 504):
        pytest.skip("Sprint1 deprecated service is not available")
    assert preprocess_response.status_code == 200
    preprocess_data = preprocess_response.json()
    assert preprocess_data["status"] == "success"
    
    # Step 2: Analyze the same transcript (requires auth)
    e2e_test_vtt_file.seek(0)
    auth_token = create_valid_test_token("e2e-composite-user")
    headers = {"Authorization": f"Bearer {auth_token}"}
    form_data = {"userId": "e2e-composite-user"} # Include matching userId in form
    files = {"file": ("test_e2e.vtt", e2e_test_vtt_file, "text/vtt")}
    analyze_response = e2e_client.post(
        "/api/interview_analysis/analyze", 
        files=files,
        data=form_data,
        headers=headers
    )
    if analyze_response.status_code in (503, 504):
        pytest.skip("Interview analysis service is not available")
    assert analyze_response.status_code == 200, f"Analyze step failed: {analyze_response.text}"
    analyze_data = analyze_response.json()
    assert analyze_data["status"] == "success"
    assert "problem_areas" in analyze_data["data"]
    assert "storage" in analyze_data["data"]
    assert analyze_data["data"]["storage"].get("id") is not None

@pytest.mark.e2e
def test_e2e_error_handling(e2e_client, e2e_test_invalid_file):
    """
    Test processing of invalid inputs (non-VTT file).
    (Assumes sprint1 endpoint doesn't require strict user auth).
    """
    e2e_test_invalid_file.seek(0)
    files = {"file": ("invalid.txt", e2e_test_invalid_file, "text/plain")}
    response = e2e_client.post("/api/sprint1_deprecated/preprocess", files=files)
    if response.status_code in (503, 504):
        pytest.skip("Sprint1 deprecated service is not available")
    
    # Check for appropriate error response structure from the gateway/service
    # Note: Original test expected error details in 'detail'. Adjust if structure changed.
    assert response.status_code == 500 # Or 400 depending on how gateway handles service error
    data = response.json()
    assert "detail" in data
    # Check specific error message if consistent
    # assert "Invalid file format" in data["detail"]
    # assert ".vtt files" in data["detail"] 