"""
Unit tests for the LLM chain components.

These tests verify the functionality of the GeminiAnalysisChain class,
focusing on prompt creation, response parsing, and error handling.
"""
import pytest
import json
from typing import Dict, Any
from unittest.mock import patch, AsyncMock, MagicMock

from app.services.analysis.llm_chains.chain import GeminiAnalysisChain
from app.config.api_config import APIConfig


@pytest.fixture
def sample_transcript():
    """Fixture providing sample transcript for testing."""
    return (
        "[Interviewer] (Chunk 1): Tell me about your biggest challenge.\n"
        "[Interviewee] (Chunk 2): Our main issue is scaling our infrastructure.\n"
        "[Interviewee] (Chunk 3): We need a more robust solution that can handle increased load."
    )


@pytest.fixture
def sample_chain_response():
    """Fixture providing sample chain response for testing."""
    return {
        "problem_areas": [
            {
                "problem_id": "p1",
                "title": "Infrastructure Scaling",
                "description": "Current systems cannot handle growth",
                "excerpts": [
                    {
                        "text": "Our main issue is scaling our infrastructure",
                        "categories": ["Technical", "Infrastructure"],
                        "insight_summary": "Current architecture doesn't scale",
                        "chunk_number": 2
                    }
                ]
            }
        ],
        "synthesis": {
            "background": "Interview about technical challenges",
            "problem_areas": ["Infrastructure scaling issues"],
            "next_steps": ["Evaluate cloud solutions"]
        }
    }


@pytest.fixture
def mock_gemini():
    """Create a mock for the Gemini model."""
    mock = MagicMock()
    mock.generate_content = MagicMock()
    return mock


@pytest.mark.asyncio
@pytest.mark.unit
async def test_chain_initialization():
    """
    Test GeminiAnalysisChain initialization.
    
    Test Steps:
        1. Initialize GeminiAnalysisChain
        2. Verify model is properly set up
    """
    # Initialize chain with a patch to prevent actual API call
    with patch('google.generativeai.GenerativeModel') as MockModel:
        chain = GeminiAnalysisChain(model_name="gemini-2.0-flash")
        assert chain.model is not None
        

@pytest.mark.asyncio
@pytest.mark.unit
async def test_chain_prompt_creation(sample_transcript):
    """
    Test prompt creation for analysis.
    
    Args:
        sample_transcript: Sample transcript fixture
    
    Test Steps:
        1. Initialize chain
        2. Create prompt for transcript
        3. Verify prompt contains transcript content
    """
    # Arrange
    with patch('google.generativeai.GenerativeModel') as MockModel:
        chain = GeminiAnalysisChain(model_name="gemini-2.0-flash")
        
        # Act
        prompt = chain._create_prompt(sample_transcript)
        
        # Assert
        if isinstance(prompt, str):
            assert sample_transcript in prompt
        else:
            # For structured prompts, check that the transcript is included
            prompt_text = str(prompt)
            assert "challenge" in prompt_text
            assert "infrastructure" in prompt_text
            assert "robust solution" in prompt_text


@pytest.mark.asyncio
@pytest.mark.unit
async def test_parse_response():
    """
    Test response parsing.
    
    Test Steps:
        1. Initialize chain
        2. Parse sample JSON response
        3. Verify parsed structure
    """
    # Sample LLM response with proper JSON format
    response_text = """```json
    {
        "problem_areas": [
            {
                "problem_id": "p1", 
                "title": "Infrastructure Scaling",
                "description": "Systems cannot handle growth",
                "excerpts": [
                    {
                        "text": "Our main issue is scaling our infrastructure",
                        "categories": ["Technical"],
                        "insight_summary": "Growth issues",
                        "chunk_number": 2
                    }
                ]
            }
        ],
        "synthesis": {
            "background": "Technical interview",
            "problem_areas": ["Infrastructure scaling"],
            "next_steps": ["Evaluate solutions"]
        }
    }
    ```"""

    # Arrange
    with patch('google.generativeai.GenerativeModel') as MockModel:
        chain = GeminiAnalysisChain(model_name="gemini-2.0-flash")
        
        # Act
        result = chain._parse_response(response_text)
        
        # Assert
        assert "problem_areas" in result
        assert "synthesis" in result
        assert result["problem_areas"][0]["title"] == "Infrastructure Scaling"
        assert result["synthesis"]["background"] == "Technical interview"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_parse_malformed_response():
    """
    Test handling of malformed response.
    
    Test Steps:
        1. Initialize chain
        2. Parse invalid JSON response
        3. Verify fallback response structure
    """
    # Malformed JSON response
    response_text = """Some text
    not valid JSON
    {
        "incomplete": "structure
    }"""

    # Arrange
    with patch('google.generativeai.GenerativeModel') as MockModel:
        chain = GeminiAnalysisChain(model_name="gemini-2.0-flash")
        
        # Act
        # This should handle the error and provide a fallback
        result = chain._parse_response(response_text)
        
        # Assert
        assert isinstance(result, dict)
        assert "problem_areas" in result
        assert "synthesis" in result
        assert "metadata" in result
        assert result["metadata"]["parsed"] is False


@pytest.mark.asyncio
@pytest.mark.unit
@patch('google.generativeai.GenerativeModel')
async def test_run_analysis_success(mock_model_class, mock_gemini, sample_transcript, sample_chain_response):
    """
    Test successful analysis run.
    
    Args:
        mock_model_class: Mocked GenerativeModel class
        mock_gemini: Mock Gemini model fixture
        sample_transcript: Sample transcript fixture
        sample_chain_response: Sample chain response fixture
    
    Test Steps:
        1. Mock Gemini model response
        2. Run analysis with transcript
        3. Verify analysis result structure
    """
    # Arrange
    # Configure mock
    mock_model_class.return_value = mock_gemini
    
    mock_response = MagicMock()
    mock_response.text = json.dumps(sample_chain_response)
    mock_gemini.generate_content.return_value = mock_response
    
    # Create chain
    chain = GeminiAnalysisChain(model_name="gemini-2.0-flash")
    chain.model = mock_gemini
    
    # Act
    result = await chain.run_analysis(sample_transcript)
    
    # Assert
    assert "problem_areas" in result
    assert "synthesis" in result
    assert result["problem_areas"][0]["title"] == "Infrastructure Scaling"
    mock_gemini.generate_content.assert_called_once()


@pytest.mark.asyncio
@pytest.mark.unit
@patch('google.generativeai.GenerativeModel')
async def test_run_analysis_error(mock_model_class, mock_gemini, sample_transcript):
    """
    Test error handling during analysis.
    
    Args:
        mock_model_class: Mocked GenerativeModel class
        mock_gemini: Mock Gemini model fixture
        sample_transcript: Sample transcript fixture
    
    Test Steps:
        1. Mock Gemini to raise exception
        2. Attempt analysis
        3. Verify error is propagated
    """
    # Arrange
    mock_model_class.return_value = mock_gemini
    mock_gemini.generate_content.side_effect = ValueError("API error")
    
    # Create chain
    chain = GeminiAnalysisChain(model_name="gemini-2.0-flash")
    chain.model = mock_gemini
    
    # Act & Assert
    with pytest.raises(ValueError) as excinfo:
        await chain.run_analysis(sample_transcript)
    
    assert "Analysis chain failed" in str(excinfo.value) 