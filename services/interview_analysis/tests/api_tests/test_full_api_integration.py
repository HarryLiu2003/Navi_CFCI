"""
API integration tests for the interview analysis service.

These tests verify the complete API workflow including file upload, processing, and analysis response.
Focus is on end-to-end functionality with mocked LLM responses.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app
import io
import json
from unittest.mock import patch, AsyncMock, MagicMock

@pytest.mark.integration
@pytest.mark.api
def test_full_api_workflow(test_client, real_transcript_file):
    """
    Test the complete interview analysis API workflow.
    
    Args:
        test_client: FastAPI test client fixture
        real_transcript_file: Fixture providing a real transcript file
    
    Test Steps:
        1. Set up mock analysis responses
        2. Submit transcript file to analysis endpoint
        3. Verify response structure and content
        4. Validate problem areas, excerpts, and synthesis
    """
    # Define realistic mock responses based on the transcript content
    mock_problem_areas = [
        {
            "problem_id": "healthcare-integration",
            "title": "Integration in Healthcare Systems",
            "description": "Difficulty connecting disparate healthcare systems and data sources",
            "relevance": "High"
        },
        {
            "problem_id": "user-adoption",
            "title": "User Adoption Challenges",
            "description": "Resistance to new technologies from healthcare providers",
            "relevance": "Medium"
        }
    ]
    
    mock_excerpts = [
        {
            "excerpt_id": "exc-1",
            "problem_id": "healthcare-integration",
            "chunk_indices": [45, 46, 47],
            "transcript_text": "Our systems don't talk to each other effectively.",
            "relevance": "High"
        },
        {
            "excerpt_id": "exc-2",
            "problem_id": "user-adoption",
            "chunk_indices": [120, 121],
            "transcript_text": "Doctors are reluctant to adopt new technologies.",
            "relevance": "Medium"
        }
    ]
    
    mock_synthesis = "The interview revealed significant challenges in integrating healthcare systems and driving user adoption among healthcare providers."
    
    # Create the mock response structure
    mock_analysis_result = {
        "problem_areas": mock_problem_areas,
        "excerpts": mock_excerpts,
        "synthesis": mock_synthesis
    }
    
    # Reset the file pointer
    real_transcript_file.seek(0)
    
    # Mock the analysis process
    with patch('app.services.analyze.TranscriptAnalyzer.analyze_transcript') as mock_analyze:
        # Set up the mock response
        mock_analyze.return_value = mock_analysis_result
        
        # Make the request
        response = test_client.post(
            "/api/interview_analysis/analyze",
            files={"file": ("test_transcript_20250218.vtt", real_transcript_file, "text/vtt")}
        )
        
        # Verify the API response
        assert response.status_code == 200
        result = response.json()
        
        # Check structure
        assert "problem_areas" in result["data"]
        assert "excerpts" in result["data"]
        assert "synthesis" in result["data"]
        
        # Verify content
        assert len(result["data"]["problem_areas"]) == len(mock_problem_areas)
        assert result["data"]["problem_areas"][0]["problem_id"] == "healthcare-integration"
        assert result["data"]["problem_areas"][1]["problem_id"] == "user-adoption"
        
        assert len(result["data"]["excerpts"]) == len(mock_excerpts)
        assert result["data"]["excerpts"][0]["problem_id"] == "healthcare-integration"
        assert result["data"]["excerpts"][1]["problem_id"] == "user-adoption"
        
        assert result["data"]["synthesis"] == mock_synthesis 