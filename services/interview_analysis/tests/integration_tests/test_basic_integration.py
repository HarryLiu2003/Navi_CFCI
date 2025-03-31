"""
Basic integration tests for the interview analysis service.

These tests verify core integration points between components, focusing on file upload
functionality and basic analysis workflow with mocked LLM responses.
"""
import pytest
import io
from unittest.mock import patch, MagicMock
from fastapi import UploadFile
from fastapi.testclient import TestClient
from app.main import app

@pytest.mark.integration
def test_file_upload_integration(test_client, test_vtt_file):
    """
    Test file upload and analysis workflow integration.
    
    Args:
        test_client: FastAPI test client fixture
        test_vtt_file: Fixture providing a test VTT file
    
    Test Steps:
        1. Mock transcript analyzer response
        2. Submit VTT file through API endpoint
        3. Verify successful response code
        4. Validate response structure and status
    """
    # Mock the analysis to avoid actual LLM calls
    with patch('app.services.analyze.TranscriptAnalyzer.analyze_transcript') as mock_analyze:
        # Set up mock response
        mock_analyze.return_value = {
            "problem_areas": [],
            "excerpts": [],
            "synthesis": "Test synthesis"
        }
        
        # Submit the file
        response = test_client.post(
            "/api/interview_analysis/analyze",
            files={"file": ("test.vtt", test_vtt_file, "text/vtt")}
        )
        
        # Verify the response
        assert response.status_code == 200
        data = response.json()
        
        # In the real app, response might be wrapped, check the response structure
        assert "status" in data
        assert data["status"] in ["success", "ok"] 