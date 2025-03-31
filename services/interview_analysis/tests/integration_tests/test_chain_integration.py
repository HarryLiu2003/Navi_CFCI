"""
Integration tests for the analysis chain components.

These tests verify the integration between different chain components (problem, excerpt, synthesis)
and their prompt templates. Tests ensure proper variable handling and chain communication.
"""
import pytest
import json
from unittest.mock import patch, AsyncMock, MagicMock, mock_open, Mock
from app.utils.analysis_chain.chain import SynthesisChain
from app.utils.analysis_chain.prompts import PROBLEM_PROMPT, EXCERPT_PROMPT, SYNTHESIS_PROMPT
from langchain_core.output_parsers import JsonOutputParser


def mock_llm_for_chain(chain, response_content):
    """
    Helper function to mock LLM responses in a chain.
    
    Args:
        chain: The chain instance to mock
        response_content: Content to return in mock responses
    
    Returns:
        None, but modifies the chain's LLM to return mock responses
    """
    # Create a mock for the LLM's invoke method that returns the provided content
    mock_response = Mock()
    mock_response.content = response_content
    
    # Replace the LLM's invoke method with our mock
    chain.llm.invoke = MagicMock(return_value=mock_response)
    
    # Also create an async version for ainvoke
    async def mock_ainvoke(*args, **kwargs):
        return mock_response
    
    chain.llm.ainvoke = AsyncMock(side_effect=mock_ainvoke)


@pytest.mark.asyncio
@pytest.mark.integration
async def test_problem_prompt_format():
    """
    Test problem prompt template integration with chain.
    
    Test Steps:
        1. Verify prompt template variables
        2. Create chain with mocked components
        3. Test problem area extraction
        4. Validate response structure
    """
    # This tests if the template variables in PROBLEM_PROMPT are properly defined
    variables = PROBLEM_PROMPT.input_variables
    
    # The prompt should expect transcript as a variable
    assert 'transcript' in variables
    
    # Create a SynthesisChain with properly mocked components
    with patch('langchain_google_genai.ChatGoogleGenerativeAI'):
        chain = SynthesisChain("fake_api_key")
        
        # Entirely replace the problem_chain with a mock
        mock_result = {
            "problem_areas": [
                {
                    "problem_id": "p1",
                    "title": "Infrastructure Scaling",
                    "description": "Current systems can't handle growth"
                }
            ]
        }
        
        chain.problem_chain = AsyncMock()
        chain.problem_chain.ainvoke.return_value = mock_result
        
        # Test that it processes a transcript correctly
        transcript = "This is a test transcript"
        result = await chain.extract_problem_areas(transcript)
        
        # Verify it was properly parsed
        assert "problem_areas" in result
        assert len(result["problem_areas"]) > 0
        assert chain.problem_chain.ainvoke.called


@pytest.mark.asyncio
@pytest.mark.integration
async def test_excerpt_prompt_format():
    """
    Test excerpt prompt template integration with chain.
    
    Test Steps:
        1. Verify prompt template variables
        2. Create chain with mocked components
        3. Test excerpt extraction with sample data
        4. Validate chain invocation and response
    """
    # This tests if the template variables in EXCERPT_PROMPT are properly defined
    variables = EXCERPT_PROMPT.input_variables
    
    # The prompt should expect transcript, problem_areas, and max_chunk_number
    assert 'transcript' in variables
    assert 'problem_areas' in variables
    assert 'max_chunk_number' in variables
    
    # Create a SynthesisChain with properly mocked components
    with patch('langchain_google_genai.ChatGoogleGenerativeAI'):
        chain = SynthesisChain("fake_api_key")
        
        # Entirely replace the excerpt_chain with a mock
        mock_result = {
            "problem_areas": [
                {
                    "problem_id": "p1",
                    "excerpts": [
                        {
                            "quote": "Sample excerpt",
                            "categories": ["Pain Point"],
                            "insight": "Sample insight",
                            "chunk_number": 1
                        }
                    ]
                }
            ]
        }
        
        chain.excerpt_chain = AsyncMock()
        chain.excerpt_chain.ainvoke.return_value = mock_result
        
        # Test excerpt chain
        transcript_data = {
            "chunks": [{"number": 1, "text": "Sample text"}],
            "max_chunk": 1
        }
        
        problem_areas = {
            "problem_areas": [{
                "problem_id": "p1",
                "title": "Test Problem",
                "description": "Test description"
            }]
        }
        
        # Should not raise any errors about missing variables
        result = await chain.extract_excerpts(transcript_data, problem_areas)
        
        assert "problem_areas" in result
        assert len(result["problem_areas"]) > 0
        assert chain.excerpt_chain.ainvoke.called


@pytest.mark.asyncio
@pytest.mark.integration
async def test_synthesis_prompt_format():
    """
    Test synthesis prompt template integration with chain.
    
    Test Steps:
        1. Verify prompt template variables
        2. Create chain with mocked components
        3. Test synthesis generation
        4. Validate synthesis output format
    """
    # This tests if the template variables in SYNTHESIS_PROMPT are properly defined
    variables = SYNTHESIS_PROMPT.input_variables
    
    # The prompt should expect 'analyzed_content' as a variable
    assert 'analyzed_content' in variables
    
    # Create a SynthesisChain with properly mocked components
    with patch('langchain_google_genai.ChatGoogleGenerativeAI'):
        chain = SynthesisChain("fake_api_key")
        
        # Entirely replace the synthesis_chain with a mock
        mock_result = {
            "synthesis": "Test synthesis about the identified problems and their implications."
        }
        
        chain.synthesis_chain = AsyncMock()
        chain.synthesis_chain.ainvoke.return_value = mock_result
        
        # Test synthesis chain
        analyzed_content = {
            "problem_areas": [{
                "problem_id": "p1",
                "title": "Test Problem",
                "description": "Test description",
                "excerpts": []
            }]
        }
        
        # Should not raise any errors about missing variables
        result = await chain.generate_synthesis(analyzed_content)
        
        assert "synthesis" in result
        assert isinstance(result["synthesis"], str)
        assert chain.synthesis_chain.ainvoke.called 