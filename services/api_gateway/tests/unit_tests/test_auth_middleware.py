"""
Tests for the authentication middleware.
"""
import pytest
import jwt
import time
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from app.middleware.auth import verify_token, get_optional_user, get_user_id_from_payload
from unittest.mock import patch, MagicMock

# Test secret key
TEST_SECRET = "NeE9JGhYhvZQKtFhPEUh5FrWGFXbZzUVMNeHAb6CLFM"

# Helper function to create test tokens
def create_test_token(sub=None, exp=None, name=None, email=None):
    """Create a test JWT token."""
    payload = {}
    if sub:
        payload["sub"] = sub
    if name:
        payload["name"] = name # Add name claim
    if email:
        payload["email"] = email # Add email claim
    if exp:
        payload["exp"] = exp
    else:
        # Default expiry: 1 hour from now
        payload["exp"] = int(time.time()) + 3600

    return jwt.encode(payload, TEST_SECRET, algorithm="HS256")

@pytest.mark.asyncio
@patch("app.middleware.auth.JWT_SECRET", TEST_SECRET)
async def test_verify_token_valid():
    """Test that verify_token accepts valid tokens."""
    # Create a test token with required 'sub' claim
    token = create_test_token(sub="user123", name="Test User", email="test@user.com")
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    # Verify token
    payload = await verify_token(credentials)

    # Check that verification succeeded and returned the payload
    assert payload["sub"] == "user123"
    assert payload["name"] == "Test User"
    assert payload["email"] == "test@user.com"

@pytest.mark.asyncio
@patch("app.middleware.auth.JWT_SECRET", TEST_SECRET)
async def test_verify_token_missing_sub():
    """Test that verify_token rejects tokens without a sub claim."""
    # Create a test token without a sub claim
    token = create_test_token(name="No Sub User") # Missing sub
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    # Verify token should raise an error
    with pytest.raises(HTTPException) as excinfo:
        await verify_token(credentials)

    assert excinfo.value.status_code == 401
    # Updated error message check
    assert "Token is missing required 'sub' claim" in excinfo.value.detail

@pytest.mark.asyncio
@patch("app.middleware.auth.JWT_SECRET", TEST_SECRET)
async def test_verify_token_expired():
    """Test that verify_token rejects expired tokens."""
    # Create a test token that expired 10 seconds ago
    token = create_test_token(sub="user123", exp=int(time.time()) - 10)
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    # Verify token should raise an error
    with pytest.raises(HTTPException) as excinfo:
        await verify_token(credentials)

    assert excinfo.value.status_code == 401
    assert "Token has expired" in excinfo.value.detail

@pytest.mark.asyncio
# No secret patch needed, checks before decoding
async def test_verify_token_missing_credentials():
    """Test that verify_token rejects missing credentials."""
    # Verify token should raise an error when credentials are None
    with pytest.raises(HTTPException) as excinfo:
        await verify_token(None)

    assert excinfo.value.status_code == 401
    assert "Missing authentication credentials" in excinfo.value.detail

@pytest.mark.asyncio
@patch("app.middleware.auth.JWT_SECRET", TEST_SECRET)
async def test_get_optional_user_valid():
    """Test that get_optional_user returns payload for valid tokens."""
    # Create a test token
    token = create_test_token(sub="user123")

    # Create mock request with Authorization header
    request = MagicMock()
    request.headers.get.return_value = f"Bearer {token}"

    # Get optional user
    payload = await get_optional_user(request)

    # Check that the function returned the payload
    assert payload is not None
    assert payload["sub"] == "user123"

@pytest.mark.asyncio
# No secret patch needed
async def test_get_optional_user_missing_header():
    """Test that get_optional_user returns None for missing headers."""
    # Create mock request without Authorization header
    request = MagicMock()
    request.headers.get.return_value = None

    # Get optional user
    payload = await get_optional_user(request)

    # Check that the function returned None
    assert payload is None

@pytest.mark.asyncio
@patch("app.middleware.auth.JWT_SECRET", TEST_SECRET)
@patch("app.middleware.auth.ENABLE_DEV_AUTH", False) # Ensure dev auth is off
async def test_get_optional_user_invalid_token_no_dev_auth():
    """Test get_optional_user returns None for invalid tokens when dev auth is OFF."""
    # Create mock request with invalid token
    request = MagicMock()
    request.headers.get.return_value = "Bearer invalid_token"

    # Get optional user
    payload = await get_optional_user(request)

    # Check that the function returned None
    assert payload is None

@pytest.mark.asyncio
@patch("app.middleware.auth.JWT_SECRET", TEST_SECRET)
@patch("app.middleware.auth.ENABLE_DEV_AUTH", True)
@patch("app.middleware.auth.DEVELOPMENT_USER_ID", "dev-fallback-user")
async def test_get_optional_user_invalid_token_with_dev_auth():
    """Test get_optional_user returns dev fallback for invalid tokens when dev auth is ON."""
    request = MagicMock()
    request.headers.get.return_value = "Bearer invalid_token"

    payload = await get_optional_user(request)

    # Check that it returned the development fallback payload
    assert payload is not None
    assert payload["sub"] == "dev-fallback-user"
    assert payload["name"] == "Development User"

def test_get_user_id_from_payload():
    """Test that get_user_id_from_payload extracts the user ID."""
    # Check with valid payload
    payload = {"sub": "user123", "other": "data"}
    assert get_user_id_from_payload(payload) == "user123"

    # Check with missing sub claim
    payload = {"other": "data"}
    assert get_user_id_from_payload(payload) is None

    # Check with None payload
    assert get_user_id_from_payload(None) is None 