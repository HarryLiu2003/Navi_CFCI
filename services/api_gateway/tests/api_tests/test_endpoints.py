"""
API endpoint tests for the API Gateway service.

These tests verify that the API Gateway endpoints correctly handle requests 
and properly forward them to their respective backend services using mocks.
They focus on testing the routing and handling of responses without requiring
real backend services.
"""
import pytest
import time
import jwt # Needed for creating test tokens
from unittest.mock import patch, MagicMock

# Test secret key (ensure this matches .env or is consistently mocked)
# Using the one from the example .env/TEAM_SETUP for consistency in tests
TEST_SECRET = "NeE9JGhYhvZQKtFhPEUh5FrWGFXbZzUVMNeHAb6CLFM"

# Helper to create a valid test token
def create_valid_test_token(user_id: str = "test-user-api") -> str:
    """Creates a JWT token signed with the TEST_SECRET."""
    payload = {
        "sub": user_id,
        "name": f"Test User {user_id}",
        "email": f"{user_id}@test.com",
        "exp": int(time.time()) + 3600 # Expires in 1 hour
    }
    return jwt.encode(payload, TEST_SECRET, algorithm="HS256")

@pytest.mark.api
# Patch the JWT_SECRET *within the auth middleware module* where it's used
@patch("app.middleware.auth.JWT_SECRET", TEST_SECRET)
# Patch the main function used for forwarding authenticated requests
@patch("app.main.call_authenticated_service")
def test_interview_analysis_endpoint(mock_call_auth_service, test_client, test_vtt_file, mock_service_success_response):
    """
    Test the interview analysis endpoint properly forwards requests *with authentication*.
    Verifies that the gateway correctly authenticates the user (via JWT),
    calls the forwarding function, and returns the backend service response.
    """
    client, _ = test_client # We don't need the low-level httpx mock

    # Configure the mock call_authenticated_service to return success
    # Use the .json() part of the fixture as that's what the real function returns
    mock_call_auth_service.return_value = mock_service_success_response.json()

    test_vtt_file.seek(0)

    # Create a valid token for the request header
    auth_token = create_valid_test_token("user-for-analysis")
    headers = {"Authorization": f"Bearer {auth_token}"}

    # Make the authenticated request
    response = client.post(
        "/api/interview_analysis/analyze",
        files={"file": ("test.vtt", test_vtt_file, "text/vtt")},
        headers=headers
        # No need to send userId in form data, rely on token
    )

    # Verify the API Gateway endpoint returned success
    assert response.status_code == 200
    assert response.json() == mock_service_success_response.json()

    # Verify call_authenticated_service was called (meaning auth passed)
    mock_call_auth_service.assert_called_once()
    # Check specific args passed to the downstream service
    call_args, call_kwargs = mock_call_auth_service.call_args
    assert "interview_analysis:8001/api/interview_analysis/analyze" in call_kwargs.get("service_url", "")
    assert call_kwargs.get("method") == "POST"
    # Check that the userId from the token was included in the 'data' dict passed down
    assert call_kwargs["data"]["userId"] == "user-for-analysis"

@pytest.mark.api
@patch("app.middleware.auth.JWT_SECRET", TEST_SECRET)
def test_auth_me_endpoint_valid_token(test_client):
    """Test the /api/auth/me endpoint with a valid token."""
    client, _ = test_client

    auth_token = create_valid_test_token("user12345")
    headers = {"Authorization": f"Bearer {auth_token}"}

    response = client.get("/api/auth/me", headers=headers)

    assert response.status_code == 200
    data = response.json()
    assert data["userId"] == "user12345"
    assert data["isAuthenticated"] is True

@pytest.mark.api
# No secret patch needed here as auth should fail before checking secret
def test_auth_me_endpoint_no_token(test_client):
    """Test the /api/auth/me endpoint without a token (should fail)."""
    client, _ = test_client
    response = client.get("/api/auth/me")
    assert response.status_code == 401 # verify_token dependency in endpoint enforces this
    # Check the specific error detail from verify_token when credentials are None
    assert "Missing authentication credentials" in response.json()["detail"]

@pytest.mark.api
@patch("app.middleware.auth.JWT_SECRET", TEST_SECRET)
def test_auth_me_endpoint_invalid_token(test_client):
    """Test the /api/auth/me endpoint with an invalid token signature."""
    client, _ = test_client
    invalid_token = create_valid_test_token("user123")[:-5] + "XXXXX" # Tamper token
    headers = {"Authorization": f"Bearer {invalid_token}"}
    response = client.get("/api/auth/me", headers=headers)
    assert response.status_code == 401
    # Check the specific error from verify_token for signature issues
    assert "Invalid token signature" in response.json()["detail"]

# --- Sprint1 Deprecated Endpoints --- 
# Assuming these endpoints DO NOT require strict JWT auth based on current main.py
# If they were updated to require auth, they'd need tests similar to test_interview_analysis_endpoint

@pytest.mark.api
@patch("app.main.http_client") # Mock the lower-level client for non-auth calls
def test_sprint1_preprocess_endpoint(mock_http_client, test_client, test_vtt_file, mock_service_success_response):
    """
    Test the sprint1 preprocess endpoint properly forwards requests.
    (Assumes no strict auth needed for this legacy endpoint).
    """
    client, _ = test_client # Use the FastAPI client
    # Configure the mock httpx client directly
    mock_http_client.post.return_value = mock_service_success_response
    test_vtt_file.seek(0)
    response = client.post(
        "/api/sprint1_deprecated/preprocess",
        files={"file": ("test.vtt", test_vtt_file, "text/vtt")}
    )
    # Verify the mock httpx client was called
    mock_http_client.post.assert_called_once()
    call_args, call_kwargs = mock_http_client.post.call_args
    assert "sprint1_deprecated:8002/api/sprint1_deprecated/preprocess" in call_args[0]
    assert response.status_code == 200
    assert response.json() == mock_service_success_response.json()

@pytest.mark.api
@patch("app.main.http_client")
def test_sprint1_summarize_endpoint(mock_http_client, test_client, test_vtt_file, mock_service_success_response):
    """
    Test the sprint1 summarize endpoint properly forwards requests.
    (Assumes no strict auth needed for this legacy endpoint).
    """
    client, _ = test_client
    mock_http_client.post.return_value = mock_service_success_response
    test_vtt_file.seek(0)
    response = client.post(
        "/api/sprint1_deprecated/summarize",
        files={"file": ("test.vtt", test_vtt_file, "text/vtt")}
    )
    mock_http_client.post.assert_called_once()
    call_args, call_kwargs = mock_http_client.post.call_args
    assert "sprint1_deprecated:8002/api/sprint1_deprecated/summarize" in call_args[0]
    assert response.status_code == 200
    assert response.json() == mock_service_success_response.json()

@pytest.mark.api
@patch("app.main.http_client")
def test_sprint1_keywords_endpoint(mock_http_client, test_client, test_vtt_file, mock_service_success_response):
    """
    Test the sprint1 keywords endpoint properly forwards requests.
    (Assumes no strict auth needed for this legacy endpoint).
    """
    client, _ = test_client
    mock_http_client.post.return_value = mock_service_success_response
    test_vtt_file.seek(0)
    response = client.post(
        "/api/sprint1_deprecated/keywords",
        files={"file": ("test.vtt", test_vtt_file, "text/vtt")}
    )
    mock_http_client.post.assert_called_once()
    call_args, call_kwargs = mock_http_client.post.call_args
    assert "sprint1_deprecated:8002/api/sprint1_deprecated/keywords" in call_args[0]
    assert response.status_code == 200
    assert response.json() == mock_service_success_response.json()

@pytest.mark.api
@patch("app.middleware.auth.JWT_SECRET", TEST_SECRET)
@patch("app.main.call_authenticated_service")
def test_service_error_handling(mock_call_auth_service, test_client, test_vtt_file, mock_service_error_response):
    """
    Test handling of error responses from backend services via authenticated endpoint.
    (Using analyze endpoint as an example, requires auth).
    """
    client, _ = test_client # Don't need low-level httpx mock

    # Configure mock call_authenticated_service to return an error structure
    # Use the .json() part of the fixture as that's what the real function returns
    error_json = mock_service_error_response.json()
    mock_call_auth_service.return_value = error_json # Return the dict directly

    test_vtt_file.seek(0)
    auth_token = create_valid_test_token("user-for-error-test")
    headers = {"Authorization": f"Bearer {auth_token}"}

    response = client.post(
        "/api/interview_analysis/analyze",
        files={"file": ("test.vtt", test_vtt_file, "text/vtt")},
        headers=headers
    )

    # Verify the error response is propagated correctly by the gateway
    # The gateway raises HTTPException based on the error from call_authenticated_service
    assert response.status_code == 500 # Default if service returns generic error status
    assert "Interview analysis service error" in response.json()["detail"]
    # Check if the original message from the mock service is included
    assert mock_service_error_response.json()["message"] in response.json()["detail"]

# TODO: Add tests for /api/interviews and /api/interviews/{id} endpoints
# These will need to mock call_authenticated_service for GET requests
# and verify correct userId and parameters are passed. 