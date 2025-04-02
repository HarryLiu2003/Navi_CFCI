"""
Basic integration tests for the interview analysis service.

These tests verify that components work together correctly
without mocking the entire system.
"""
import pytest
from fastapi.testclient import TestClient
import io
from unittest.mock import patch, AsyncMock, MagicMock

from app.main import app
from app.services.analysis.analyzer import TranscriptAnalyzer
from app.domain.workflows import InterviewWorkflow

@pytest.mark.integration
def test_file_upload_integration(test_client, test_vtt_file):
    """
    Test file upload and analysis workflow integration.
    
    Args:
        test_client: FastAPI test client fixture
        test_vtt_file: Fixture providing a test VTT file
    
    Test Steps:
        1. Mock the workflow process_interview method
        2. Submit VTT file through API endpoint
        3. Verify successful response code
        4. Validate response structure and status
    """
    # Mock the workflow to avoid actual LLM calls and database writes
    with patch('app.domain.workflows.InterviewWorkflow.process_interview') as mock_process:
        # Configure mock response
        mock_response = {
            "problem_areas": [
                {
                    "problem_id": "p1",
                    "title": "Test Problem",
                    "description": "A test problem description",
                    "excerpts": [
                        {
                            "text": "Relevant excerpt from interview",
                            "categories": ["UX", "Navigation"],
                            "insight_summary": "User had difficulty navigating",
                            "chunk_number": 5
                        }
                    ]
                }
            ],
            "transcript": [
                {
                    "chunk_number": 1,
                    "speaker": "Interviewer",
                    "text": "Tell me about your experience."
                },
                {
                    "chunk_number": 2,
                    "speaker": "User",
                    "text": "It was difficult to navigate the interface."
                }
            ],
            "synthesis": {
                "background": "User testing the application",
                "problem_areas": ["Navigation issues"],
                "next_steps": ["Improve navigation"]
            },
            "metadata": {
                "transcript_length": 2,
                "problem_areas_count": 1,
                "excerpts_count": 1
            },
            "storage": {
                "id": "test-id-12345",
                "created_at": "2025-01-01T00:00:00Z"
            }
        }
        
        # Set the mock return value
        mock_process.return_value = mock_response
        
        # Make the API request
        response = test_client.post(
            "/api/interview_analysis/analyze",
            files={"file": ("test.vtt", test_vtt_file, "text/vtt")}
        )
        
        # Assert successful response
        assert response.status_code == 200
        
        # Validate response structure
        data = response.json()
        assert data["status"] == "success"
        assert "data" in data
        
        # Check specific data
        result = data["data"]
        assert "problem_areas" in result
        assert "transcript" in result
        assert "synthesis" in result
        assert "metadata" in result
        assert "storage" in result
        
        # Verify the mock was called
        mock_process.assert_called_once() 