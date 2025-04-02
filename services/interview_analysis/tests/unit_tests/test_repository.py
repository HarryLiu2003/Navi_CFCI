"""
Unit tests for the InterviewRepository class.

These tests verify the functionality of the storage repository,
focusing on database interactions and error handling.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import httpx
import json
from datetime import datetime

from app.services.storage.repository import InterviewRepository
from app.utils.errors import StorageError

@pytest.mark.unit
def test_repository_initialization():
    """
    Test the initialization of the InterviewRepository.
    
    Test Steps:
        1. Create repository instance
        2. Verify API URL is properly set
    """
    # Create the repository
    repository = InterviewRepository()
    
    # Verify API URL property
    assert repository.api_url is not None
    assert "database" in repository.api_url or "localhost" in repository.api_url

@pytest.mark.unit
@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_store_interview_success(mock_client_class):
    """
    Test successful interview storage.
    
    Args:
        mock_client_class: Mock for the httpx.AsyncClient
    
    Test Steps:
        1. Mock HTTP client response
        2. Call store_interview with test data
        3. Verify API call parameters
        4. Validate the result
    """
    # Configure mock client
    mock_client = AsyncMock()
    mock_client_class.return_value.__aenter__.return_value = mock_client
    
    # Set up mock response
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "status": "success",
        "message": "Interview stored successfully",
        "data": {
            "id": "test-id-123",
            "created_at": "2025-01-01T12:00:00Z"
        }
    }
    mock_client.post.return_value = mock_response
    
    # Test data
    analysis_data = {
        "problem_areas": [],
        "transcript": [],
        "synthesis": {},
        "metadata": {
            "transcript_length": 10,
            "problem_areas_count": 0,
            "excerpts_count": 0
        }
    }
    
    metadata = {
        "project_id": "project-123",
        "interviewer": "Test User",
        "interview_date": "2025-01-01",
        "title": "Test Interview"
    }
    
    # Create repository and store data
    repository = InterviewRepository()
    result = await repository.store_interview(analysis_data, metadata)
    
    # Verify client call
    mock_client.post.assert_called_once()
    args, kwargs = mock_client.post.call_args
    
    # Check URL
    assert args[0].endswith("interviews")
    
    # Check payload directly without trying to load it as JSON
    payload = kwargs["json"]
    assert payload["title"] == metadata["title"]
    assert payload["project_id"] == metadata["project_id"]
    assert payload["interviewer"] == metadata["interviewer"]
    assert payload["interview_date"] == metadata["interview_date"]
    assert "analysis_data" in payload
    
    # Check result
    assert "id" in result
    assert result["id"] == "test-id-123"
    assert "created_at" in result

@pytest.mark.unit
@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_store_interview_minimal_metadata(mock_client_class):
    """
    Test storage with minimal metadata.
    
    Args:
        mock_client_class: Mock for the httpx.AsyncClient
    
    Test Steps:
        1. Mock HTTP client response
        2. Call store_interview with minimal metadata
        3. Verify default values are used
    """
    # Configure mock client
    mock_client = AsyncMock()
    mock_client_class.return_value.__aenter__.return_value = mock_client
    
    # Set up mock response
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "status": "success",
        "data": {
            "id": "test-id-minimal"
        }
    }
    mock_client.post.return_value = mock_response
    
    # Test data
    analysis_data = {
        "problem_areas": [],
        "transcript": [],
        "synthesis": {},
        "metadata": {}
    }
    
    # Minimal metadata
    metadata = {}
    
    # Create repository and store data
    repository = InterviewRepository()
    result = await repository.store_interview(analysis_data, metadata)
    
    # Verify client call
    mock_client.post.assert_called_once()
    
    # Check payload
    args, kwargs = mock_client.post.call_args
    payload = kwargs["json"]
    
    # Check default title
    assert "title" in payload
    assert "Untitled" in payload["title"] or "Interview Analysis" in payload["title"]
    
    # Check result
    assert result["id"] == "test-id-minimal"

@pytest.mark.unit
@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_store_interview_error_status_code(mock_client_class):
    """
    Test handling of HTTP error status codes.
    
    Args:
        mock_client_class: Mock for the httpx.AsyncClient
    
    Test Steps:
        1. Mock HTTP client to return error status
        2. Call store_interview
        3. Verify error is properly handled
    """
    # Configure mock client
    mock_client = AsyncMock()
    mock_client_class.return_value.__aenter__.return_value = mock_client
    
    # Set up mock response with error status
    mock_response = MagicMock()
    mock_response.status_code = 500
    mock_response.text = "Internal Server Error"
    mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
        "500 Internal Server Error",
        request=MagicMock(),
        response=mock_response
    )
    mock_client.post.return_value = mock_response
    
    # Test data
    analysis_data = {"problem_areas": [], "transcript": [], "synthesis": {}, "metadata": {}}
    metadata = {"title": "Error Test"}
    
    # Create repository
    repository = InterviewRepository()
    
    # Call store_interview and verify error handling
    with pytest.raises(StorageError) as excinfo:
        await repository.store_interview(analysis_data, metadata)
    
    # Verify error message
    assert "500" in str(excinfo.value)

@pytest.mark.unit
@pytest.mark.asyncio
@patch('httpx.AsyncClient')
async def test_store_interview_network_error(mock_client_class):
    """
    Test handling of network errors.
    
    Args:
        mock_client_class: Mock for the httpx.AsyncClient
    
    Test Steps:
        1. Mock HTTP client to raise connection error
        2. Call store_interview
        3. Verify error is properly handled
    """
    # Configure mock client
    mock_client = AsyncMock()
    mock_client_class.return_value.__aenter__.return_value = mock_client
    
    # Set up mock to raise connection error
    mock_client.post.side_effect = httpx.RequestError("Connection failed")
    
    # Test data
    analysis_data = {"problem_areas": [], "transcript": [], "synthesis": {}, "metadata": {}}
    metadata = {"title": "Network Error Test"}
    
    # Create repository
    repository = InterviewRepository()
    
    # Call store_interview and verify error handling
    with pytest.raises(StorageError) as excinfo:
        await repository.store_interview(analysis_data, metadata)
    
    # Verify error message
    assert "Connection failed" in str(excinfo.value) 