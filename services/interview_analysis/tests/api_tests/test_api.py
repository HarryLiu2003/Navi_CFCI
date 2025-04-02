"""
API endpoint tests for the interview analysis service.

These tests verify individual API endpoints, request validation, error handling,
and response formats. Tests are focused on API behavior rather than business logic.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app
import io
import json
from unittest.mock import patch, AsyncMock

client = TestClient(app)

@pytest.mark.api
def test_root_endpoint(test_client):
    """
    Test the root endpoint health check functionality.
    
    Args:
        test_client: FastAPI test client fixture
    
    Test Steps:
        1. Send GET request to root endpoint
        2. Verify 200 status code
        3. Validate response structure
        4. Check health check information fields
    """
    response = test_client.get("/")
    
    # Check status code
    assert response.status_code == 200
    
    # Check content - should be health check info
    data = response.json()
    assert "status" in data
    assert data["status"] == "online"
    assert "version" in data
    assert "service" in data
    assert "endpoints" in data

@pytest.mark.api
def test_file_format_validation(test_client, test_invalid_file):
    """
    Test file format validation for non-VTT files.
    
    Args:
        test_client: FastAPI test client fixture
        test_invalid_file: Fixture providing an invalid file format
    
    Test Steps:
        1. Submit non-VTT file to analysis endpoint
        2. Verify error response
        3. Validate error message format
        4. Check specific error details
    """
    # Create a test file for the API request
    invalid_file = test_invalid_file
    
    # Make the request with an invalid file
    response = test_client.post(
        "/api/interview_analysis/analyze",
        files={"file": ("test.txt", invalid_file, "text/plain")}
    )
    
    # Check response
    assert response.status_code == 200  # API returns 200 but with error message
    data = response.json()
    assert "message" in data
    assert "Invalid file format" in data["message"]
    assert data["status"] == "error"

@pytest.mark.api
def test_empty_file(test_client, test_empty_file):
    """
    Test handling of empty VTT files.
    
    Args:
        test_client: FastAPI test client fixture
        test_empty_file: Fixture providing an empty file
    
    Test Steps:
        1. Submit empty VTT file
        2. Verify error response
        3. Validate error message
        4. Check error status
    """
    # Create a test file for the API request
    empty_file = test_empty_file
    
    # Make the request with an empty file
    response = test_client.post(
        "/api/interview_analysis/analyze",
        files={"file": ("empty.vtt", empty_file, "text/vtt")}
    )
    
    # Check response
    assert response.status_code == 200  # API returns 200 but with error message
    data = response.json()
    assert "message" in data
    assert "Empty file" in data["message"]
    assert data["status"] == "error"

@pytest.mark.api
def test_vtt_processing(test_client, test_vtt_file):
    """
    Test successful VTT file processing workflow.
    
    Args:
        test_client: FastAPI test client fixture
        test_vtt_file: Fixture providing a valid VTT file
    
    Test Steps:
        1. Mock the InterviewWorkflow process_interview method
        2. Submit valid VTT file
        3. Verify successful response
        4. Validate response structure and content
        5. Check specific analysis results
    """
    # Mock the workflow to avoid actual LLM calls
    with patch('app.domain.workflows.InterviewWorkflow.process_interview') as mock_process:
        # Set up a realistic mock response
        mock_response = {
            "problem_areas": [
                {
                    "problem_id": "test-1",
                    "title": "Infrastructure Scaling",
                    "description": "Current systems can't handle growth",
                    "excerpts": [
                        {
                            "text": "Our main issue is scaling our infrastructure",
                            "categories": ["Technical", "Growth"],
                            "insight_summary": "Infrastructure scaling challenges",
                            "chunk_number": 2
                        }
                    ]
                }
            ],
            "transcript": [
                {
                    "chunk_number": 1,
                    "speaker": "Interviewer",
                    "text": "Tell me about your biggest challenge."
                },
                {
                    "chunk_number": 2,
                    "speaker": "Interviewee",
                    "text": "Our main issue is scaling our infrastructure."
                }
            ],
            "synthesis": {
                "background": "The company is experiencing rapid growth.",
                "problem_areas": ["Infrastructure scaling challenges"],
                "next_steps": ["Evaluate cloud solutions"]
            },
            "metadata": {
                "transcript_length": 2,
                "problem_areas_count": 1,
                "excerpts_count": 1
            },
            "storage": {
                "id": "test-interview-id",
                "created_at": "2025-03-31T12:00:00"
            }
        }
        
        # Configure the workflow mock
        mock_process.return_value = mock_response
        
        # Make the request
        response = test_client.post(
            "/api/interview_analysis/analyze",
            files={"file": ("test.vtt", test_vtt_file, "text/vtt")}
        )
        
        # Verify response status
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "status" in data
        assert data["status"] == "success"
        assert "data" in data
        
        # Verify data content
        result = data["data"]
        assert "problem_areas" in result
        assert "synthesis" in result
        assert "metadata" in result
        
        # Verify specific content
        assert len(result["problem_areas"]) == 1
        assert result["problem_areas"][0]["title"] == "Infrastructure Scaling"
        assert "Infrastructure scaling challenges" in result["synthesis"]["problem_areas"]
        
        # Verify storage information is included
        assert "storage" in result
        assert result["storage"]["id"] == "test-interview-id"
        
        # Verify the workflow was called
        mock_process.assert_called_once()

@pytest.mark.api
def test_missing_file(test_client):
    """
    Test API behavior when no file is provided.
    
    Args:
        test_client: FastAPI test client fixture
    
    Test Steps:
        1. Send request without file attachment
        2. Verify 422 status code
        3. Validate error response format
    """
    # Make the request without a file
    response = test_client.post("/api/interview_analysis/analyze")
    
    # Check response
    assert response.status_code == 422  # Unprocessable Entity
    data = response.json()
    assert "detail" in data  # FastAPI validation error format

@pytest.mark.api
def test_error_response_format(test_client, test_empty_file):
    """
    Test standardized error response format.
    
    Args:
        test_client: FastAPI test client fixture
        test_empty_file: Fixture providing an empty file
    
    Test Steps:
        1. Trigger error with empty file
        2. Verify error response structure
        3. Validate required error fields
        4. Check error status value
    """
    # Use an empty file to trigger an error
    response = test_client.post(
        "/api/interview_analysis/analyze",
        files={"file": ("empty.vtt", test_empty_file, "text/vtt")}
    )
    
    # Check error format
    data = response.json()
    assert "message" in data
    assert isinstance(data["message"], str)
    assert "status" in data
    assert data["status"] == "error" 