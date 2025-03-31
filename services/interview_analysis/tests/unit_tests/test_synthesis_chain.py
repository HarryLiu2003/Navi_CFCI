"""
Unit tests for the synthesis chain component.

These tests verify the core functionality of the SynthesisChain class, including problem area extraction,
excerpt generation, and synthesis creation. All LLM interactions are mocked.
"""
import pytest
import json
from typing import Dict, Any
from unittest.mock import patch, AsyncMock, MagicMock
from app.utils.analysis_chain.chain import SynthesisChain
from app.utils.analysis_chain.prompts import PROBLEM_PROMPT, EXCERPT_PROMPT, SYNTHESIS_PROMPT


@pytest.fixture
def sample_problem_areas():
    """Fixture providing sample problem areas for testing."""
    return {
        "problem_areas": [
            {
                "problem_id": "p1",
                "title": "Infrastructure Scaling",
                "description": "Current systems can't handle growth",
                "excerpts": []
            }
        ]
    }


@pytest.fixture
def sample_excerpts():
    """Fixture providing sample excerpts for testing."""
    return {
        "problem_areas": [
            {
                "problem_id": "p1",
                "excerpts": [
                    {
                        "quote": "Our main issue is scaling our infrastructure",
                        "categories": ["Pain Point"],
                        "insight": "Growth causing scaling issues",
                        "chunk_number": 2
                    }
                ]
            }
        ]
    }


@pytest.fixture
def sample_synthesis():
    """Fixture providing sample synthesis result for testing."""
    return {
        "synthesis": "The interviewee discussed challenges with infrastructure. Infrastructure doesn't scale well with growth. They should evaluate cloud-based solutions."
    }


@pytest.fixture
def sample_transcript_data():
    """Fixture providing sample transcript data for testing."""
    return {
        "chunks": [
            {
                "number": 1,
                "start": "00:00:00.000",
                "end": "00:00:05.000",
                "text": "Interviewer: Tell me about your biggest challenge."
            },
            {
                "number": 2,
                "start": "00:00:05.000",
                "end": "00:00:15.000",
                "text": "Interviewee: Our main issue is scaling our infrastructure."
            }
        ],
        "max_chunk": 2
    }


@pytest.fixture
def chain():
    """Fixture providing a SynthesisChain instance with mock API key."""
    return SynthesisChain("test_api_key")


@pytest.mark.asyncio
@pytest.mark.unit
@patch("langchain_google_genai.ChatGoogleGenerativeAI")
async def test_synthesis_chain_initialization(mock_llm):
    """
    Test SynthesisChain initialization and component setup.
    
    Args:
        mock_llm: Mock for the LLM component
    
    Test Steps:
        1. Initialize SynthesisChain with test API key
        2. Verify all required components are created
        3. Check chain components are properly configured
    """
    # Arrange & Act
    chain = SynthesisChain("test_api_key")
    
    # Assert
    assert chain.llm is not None
    assert chain.problem_parser is not None
    assert chain.excerpt_parser is not None
    assert chain.synthesis_parser is not None
    assert chain.problem_chain is not None
    assert chain.excerpt_chain is not None
    assert chain.synthesis_chain is not None


@pytest.mark.asyncio
@pytest.mark.unit
async def test_extract_problem_areas(chain, sample_problem_areas):
    """
    Test problem area extraction from transcript.
    
    Args:
        chain: SynthesisChain fixture
        sample_problem_areas: Sample problem areas fixture
    
    Test Steps:
        1. Mock problem chain response
        2. Call extract_problem_areas with test transcript
        3. Verify chain invocation
        4. Validate returned problem areas
    """
    # Arrange
    chain.problem_chain = AsyncMock()
    chain.problem_chain.ainvoke.return_value = sample_problem_areas
    transcript = "This is a test transcript"
    
    # Act
    result = await chain.extract_problem_areas(transcript)
    
    # Assert
    assert result == sample_problem_areas
    chain.problem_chain.ainvoke.assert_called_once_with({"transcript": transcript})


@pytest.mark.asyncio
@pytest.mark.unit
async def test_extract_problem_areas_error(chain):
    """
    Test error handling in problem area extraction.
    
    Args:
        chain: SynthesisChain fixture
    
    Test Steps:
        1. Mock problem chain to raise exception
        2. Attempt problem area extraction
        3. Verify error handling
        4. Validate error message
    """
    # Arrange
    chain.problem_chain = AsyncMock()
    chain.problem_chain.ainvoke.side_effect = Exception("Test error")
    transcript = "This is a test transcript"
    
    # Act & Assert
    with pytest.raises(ValueError) as exc_info:
        await chain.extract_problem_areas(transcript)
    
    assert "Problem area extraction failed" in str(exc_info.value)


@pytest.mark.asyncio
@pytest.mark.unit
async def test_extract_excerpts(chain, sample_problem_areas, sample_excerpts, sample_transcript_data):
    """
    Test excerpt extraction from transcript and problem areas.
    
    Args:
        chain: SynthesisChain fixture
        sample_problem_areas: Sample problem areas fixture
        sample_excerpts: Sample excerpts fixture
        sample_transcript_data: Sample transcript data fixture
    
    Test Steps:
        1. Mock excerpt chain response
        2. Call extract_excerpts with test data
        3. Verify chain invocation parameters
        4. Validate returned excerpts
    """
    # Arrange
    chain.excerpt_chain = AsyncMock()
    chain.excerpt_chain.ainvoke.return_value = sample_excerpts
    
    # Act
    result = await chain.extract_excerpts(sample_transcript_data, sample_problem_areas)
    
    # Assert
    assert result == sample_excerpts
    chain.excerpt_chain.ainvoke.assert_called_once()
    # Verify that the transcript and max_chunk_number were extracted correctly
    call_args = chain.excerpt_chain.ainvoke.call_args[0][0]
    assert call_args["transcript"] == sample_transcript_data["chunks"]
    assert call_args["max_chunk_number"] == sample_transcript_data["max_chunk"]
    assert json.loads(call_args["problem_areas"]) == sample_problem_areas


@pytest.mark.asyncio
@pytest.mark.unit
async def test_extract_excerpts_missing_max_chunk(chain, sample_problem_areas, sample_excerpts):
    """
    Test excerpt extraction with missing max_chunk parameter.
    
    Args:
        chain: SynthesisChain fixture
        sample_problem_areas: Sample problem areas fixture
        sample_excerpts: Sample excerpts fixture
    
    Test Steps:
        1. Create transcript data without max_chunk
        2. Call extract_excerpts
        3. Verify max_chunk calculation
        4. Validate excerpt extraction
    """
    # Arrange
    chain.excerpt_chain = AsyncMock()
    chain.excerpt_chain.ainvoke.return_value = sample_excerpts
    transcript_data = {
        "chunks": [
            {"number": 1, "text": "Test chunk 1"},
            {"number": 2, "text": "Test chunk 2"}
        ]
    }
    
    # Act
    result = await chain.extract_excerpts(transcript_data, sample_problem_areas)
    
    # Assert
    assert result == sample_excerpts
    chain.excerpt_chain.ainvoke.assert_called_once()
    # Verify that it calculated max_chunk correctly
    call_args = chain.excerpt_chain.ainvoke.call_args[0][0]
    assert call_args["max_chunk_number"] == 2  # Length of chunks


@pytest.mark.asyncio
@pytest.mark.unit
async def test_extract_excerpts_error(chain, sample_problem_areas, sample_transcript_data):
    """
    Test error handling in excerpt extraction.
    
    Args:
        chain: SynthesisChain fixture
        sample_problem_areas: Sample problem areas fixture
        sample_transcript_data: Sample transcript data fixture
    
    Test Steps:
        1. Mock excerpt chain to raise exception
        2. Attempt excerpt extraction
        3. Verify error handling
        4. Validate error message
    """
    # Arrange
    chain.excerpt_chain = AsyncMock()
    chain.excerpt_chain.ainvoke.side_effect = Exception("Test error")
    
    # Act & Assert
    with pytest.raises(ValueError) as exc_info:
        await chain.extract_excerpts(sample_transcript_data, sample_problem_areas)
    
    assert "Excerpt extraction failed" in str(exc_info.value)


@pytest.mark.asyncio
@pytest.mark.unit
async def test_generate_synthesis(chain, sample_problem_areas, sample_synthesis):
    """
    Test synthesis generation from problem areas.
    
    Args:
        chain: SynthesisChain fixture
        sample_problem_areas: Sample problem areas fixture
        sample_synthesis: Sample synthesis fixture
    
    Test Steps:
        1. Mock synthesis chain response
        2. Call generate_synthesis
        3. Verify chain invocation
        4. Validate generated synthesis
    """
    # Arrange
    chain.synthesis_chain = AsyncMock()
    chain.synthesis_chain.ainvoke.return_value = sample_synthesis
    
    # Act
    result = await chain.generate_synthesis(sample_problem_areas)
    
    # Assert
    assert result == sample_synthesis
    chain.synthesis_chain.ainvoke.assert_called_once()
    call_args = chain.synthesis_chain.ainvoke.call_args[0][0]
    assert json.loads(call_args["analyzed_content"]) == sample_problem_areas


@pytest.mark.asyncio
@pytest.mark.unit
async def test_generate_synthesis_error(chain, sample_problem_areas):
    """
    Test error handling in synthesis generation.
    
    Args:
        chain: SynthesisChain fixture
        sample_problem_areas: Sample problem areas fixture
    
    Test Steps:
        1. Mock synthesis chain to raise exception
        2. Attempt synthesis generation
        3. Verify error handling
        4. Validate error message
    """
    # Arrange
    chain.synthesis_chain = AsyncMock()
    chain.synthesis_chain.ainvoke.side_effect = Exception("Test error")
    
    # Act & Assert
    with pytest.raises(ValueError) as exc_info:
        await chain.generate_synthesis(sample_problem_areas)
    
    assert "Synthesis generation failed" in str(exc_info.value)


@pytest.mark.asyncio
@pytest.mark.unit
async def test_run_analysis(chain, sample_problem_areas, sample_excerpts, sample_synthesis):
    """
    Test complete analysis workflow execution.
    
    Args:
        chain: SynthesisChain fixture
        sample_problem_areas: Sample problem areas fixture
        sample_excerpts: Sample excerpts fixture
        sample_synthesis: Sample synthesis fixture
    
    Test Steps:
        1. Mock all chain components
        2. Execute complete analysis workflow
        3. Verify each step's invocation
        4. Validate final analysis result
    """
    # Arrange
    chain.extract_problem_areas = AsyncMock(return_value=sample_problem_areas)
    chain.extract_excerpts = AsyncMock(return_value=sample_excerpts)
    chain.generate_synthesis = AsyncMock(return_value=sample_synthesis)
    transcript = "This is a test transcript"
    
    # Act
    result = await chain.run_analysis(transcript)
    
    # Assert
    assert "problem_areas" in result
    assert "synthesis" in result
    assert "metadata" in result
    assert result["problem_areas"] == sample_problem_areas["problem_areas"]
    assert result["synthesis"] == sample_synthesis["synthesis"]
    
    chain.extract_problem_areas.assert_called_once_with(transcript)
    chain.extract_excerpts.assert_called_once()
    chain.generate_synthesis.assert_called_once()


@pytest.mark.asyncio
@pytest.mark.unit
async def test_run_analysis_error(chain):
    """
    Test error handling in complete analysis workflow.
    
    Args:
        chain: SynthesisChain fixture
    
    Test Steps:
        1. Mock extract_problem_areas to raise exception
        2. Attempt complete analysis
        3. Verify error propagation
        4. Validate error message
    """
    # Arrange
    chain.extract_problem_areas = AsyncMock(side_effect=Exception("Test error"))
    transcript = "This is a test transcript"
    
    # Act & Assert
    with pytest.raises(ValueError) as exc_info:
        await chain.run_analysis(transcript)
    
    assert "Analysis pipeline failed" in str(exc_info.value) 