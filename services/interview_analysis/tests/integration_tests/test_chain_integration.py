"""
Integration tests for the analysis chain components.

These tests verify the integration between different chain components
and their prompt templates. Tests ensure proper variable handling and chain communication.
"""
import pytest
import json
from unittest.mock import patch, AsyncMock, MagicMock, mock_open, Mock
from app.services.analysis.gemini_pipeline.analysis_pipeline import GeminiAnalysisPipeline
from app.config.api_config import APIConfig

def mock_gemini_response(response_content):
    """
    Helper function to mock Gemini responses.
    
    Args:
        response_content: Content to return in mock responses
    
    Returns:
        A mocked response object
    """
    mock_response = Mock()
    mock_response.text = json.dumps(response_content) if isinstance(response_content, dict) else response_content
    return mock_response


@pytest.mark.asyncio
@pytest.mark.integration
@patch('google.generativeai.GenerativeModel')
async def test_analysis_chain_integration(mock_model_class):
    """
    Test integration of analysis chain.
    
    Test Steps:
        1. Create chain with mocked Gemini model
        2. Test analysis with sample transcript
        3. Validate response structure
    """
    # Create a mock for the Gemini model
    mock_model = MagicMock()
    mock_model_class.return_value = mock_model
    
    # Mock response for generate_content
    mock_result = {
        "problem_areas": [
            {
                "problem_id": "p1",
                "title": "Infrastructure Scaling",
                "description": "Current systems can't handle growth",
                "excerpts": [
                    {
                        "text": "Our main issue is scaling",
                        "categories": ["Technical"],
                        "insight_summary": "Scaling challenges",
                        "chunk_number": 1
                    }
                ]
            }
        ],
        "synthesis": {
            "background": "Technical discussion",
            "problem_areas": ["Infrastructure scaling"],
            "next_steps": ["Evaluate solutions"]
        }
    }
    
    mock_response = mock_gemini_response(mock_result)
    mock_model.generate_content.return_value = mock_response
    
    # Create the chain
    chain = GeminiAnalysisPipeline(model_name="gemini-2.0-flash")
    chain.model = mock_model
    
    # Test analysis with a transcript
    transcript = "[Interviewer] (Chunk 1): What's your biggest challenge?\n[Interviewee] (Chunk 2): Our main issue is scaling."
    
    # Run the analysis
    result = await chain.run_analysis(transcript)
    
    # Verify response format
    assert "problem_areas" in result
    assert "synthesis" in result
    assert len(result["problem_areas"]) > 0
    assert result["problem_areas"][0]["title"] == "Infrastructure Scaling"
    assert mock_model.generate_content.called


@pytest.mark.asyncio
@pytest.mark.integration
@patch('google.generativeai.GenerativeModel')
async def test_chain_error_handling(mock_model_class):
    """
    Test error handling in the analysis chain.
    
    Test Steps:
        1. Create chain with mocked Gemini model that raises an exception
        2. Verify error handling when model fails
    """
    # Create a mock for the Gemini model
    mock_model = MagicMock()
    mock_model_class.return_value = mock_model
    
    # Mock response to raise an exception
    mock_model.generate_content.side_effect = ValueError("API error")
    
    # Create chain
    chain = GeminiAnalysisPipeline(model_name="gemini-2.0-flash")
    chain.model = mock_model
    
    # Test with a transcript
    transcript = "[Interviewer] (Chunk 1): What's your biggest challenge?\n[Interviewee] (Chunk 2): Our main issue is scaling."
    
    # Run analysis and expect an error
    with pytest.raises(ValueError) as excinfo:
        await chain.run_analysis(transcript)
    
    assert "Analysis chain failed" in str(excinfo.value)
    assert mock_model.generate_content.called 