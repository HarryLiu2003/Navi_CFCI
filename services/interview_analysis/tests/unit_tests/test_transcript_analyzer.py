"""
Unit tests for the TranscriptAnalyzer class.

These tests verify the functionality of the transcript analyzer,
including parsing VTT files and integrating with LLM chains.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import io
import json
from datetime import datetime

from app.services.analysis.analyzer import TranscriptAnalyzer
from app.utils.errors import FileProcessingError, AnalysisError

@pytest.mark.unit
@pytest.mark.asyncio
@patch('app.services.analysis.analyzer.create_analysis_chain')
async def test_analyzer_initialization(mock_chain_factory):
    """
    Test the initialization of the TranscriptAnalyzer.
    
    Test Steps:
        1. Create analyzer instance with mocked chain factory
        2. Verify initialization completes without errors
    """
    # Create a mock chain
    mock_chain = AsyncMock()
    mock_chain_factory.return_value = mock_chain
    
    # Create an instance
    analyzer = TranscriptAnalyzer()
    
    # Verify basic properties
    assert isinstance(analyzer, TranscriptAnalyzer)
    assert analyzer.analysis_chain is mock_chain

@pytest.mark.unit
@pytest.mark.asyncio
@patch('app.services.analysis.analyzer.create_analysis_chain')
async def test_transcript_analysis(mock_chain_factory, test_vtt_content):
    """
    Test the transcript analysis process.
    
    Args:
        mock_chain_factory: Mocked chain factory function
        test_vtt_content: Sample VTT content
    
    Test Steps:
        1. Mock LLM chain to return test data
        2. Run analysis on sample transcript
        3. Verify analysis result structure
    """
    # Create mock chain
    mock_chain = AsyncMock()
    mock_chain_factory.return_value = mock_chain
    
    # Configure mock chain response
    mock_response = {
        "problem_areas": [
            {
                "problem_id": "p1",
                "title": "Test Problem",
                "description": "A test problem description",
                "excerpts": []
            }
        ],
        "synthesis": {
            "background": "User testing session",
            "problem_areas": ["Confusion", "Navigation"],
            "next_steps": ["Simplify UI"]
        },
        "metadata": {
            "transcript_length": 2,
            "problem_areas_count": 1,
            "excerpts_count": 0
        }
    }
    mock_chain.run_analysis.return_value = mock_response
    
    # Initialize analyzer
    analyzer = TranscriptAnalyzer()
    
    # Run analysis
    result = await analyzer.analyze_transcript(test_vtt_content.encode())
    
    # Verify result structure
    assert "problem_areas" in result
    assert "transcript" in result
    assert "synthesis" in result
    assert "metadata" in result
    
    # Verify mock was called
    mock_chain.run_analysis.assert_called_once()
    
@pytest.mark.unit
@pytest.mark.asyncio
@patch('app.services.analysis.analyzer.create_analysis_chain')
async def test_empty_transcript(mock_chain_factory):
    """
    Test handling of empty transcript.
    
    Test Steps:
        1. Create analyzer instance with mocked chain
        2. Provide empty content
        3. Verify appropriate error is raised
    """
    # Create mock chain
    mock_chain = AsyncMock()
    mock_chain_factory.return_value = mock_chain
    
    # Create an instance
    analyzer = TranscriptAnalyzer()
    
    # Test with empty bytes
    with pytest.raises(FileProcessingError) as exc_info:
        await analyzer.analyze_transcript(b"")
    
    # Verify error message contains relevant text
    assert "No valid content" in str(exc_info.value)
    
    # Verify that the chain was not called (because error was raised before analysis)
    mock_chain.run_analysis.assert_not_called()

@pytest.mark.unit
@pytest.mark.asyncio
@patch('app.services.analysis.analyzer.create_analysis_chain')
async def test_invalid_vtt_format(mock_chain_factory):
    """
    Test handling of invalid VTT format.
    
    Test Steps:
        1. Create analyzer instance with mocked chain
        2. Provide invalid content
        3. Verify appropriate error is raised
    """
    # Create mock chain
    mock_chain = AsyncMock()
    mock_chain_factory.return_value = mock_chain
    
    # Create an instance
    analyzer = TranscriptAnalyzer()
    
    # Invalid VTT content (missing WEBVTT header)
    invalid_content = b"This is not a valid VTT file"
    
    # Should raise an error
    with pytest.raises(FileProcessingError) as exc_info:
        await analyzer.analyze_transcript(invalid_content)
    
    # Verify error message
    assert "No valid content" in str(exc_info.value)
    
    # Verify chain was not called
    mock_chain.run_analysis.assert_not_called()

@pytest.mark.unit
@pytest.mark.asyncio
@patch('app.services.analysis.analyzer.create_analysis_chain')
async def test_llm_error_handling(mock_chain_factory, test_vtt_content):
    """
    Test handling of LLM chain errors.
    
    Args:
        mock_chain_factory: Mocked chain factory function
        test_vtt_content: Sample VTT content
    
    Test Steps:
        1. Configure LLM chain to raise an exception
        2. Run analysis
        3. Verify error is propagated correctly
    """
    # Create mock chain that raises an error
    mock_chain = AsyncMock()
    mock_chain_factory.return_value = mock_chain
    mock_chain.run_analysis.side_effect = ValueError("LLM processing error")
    
    # Initialize analyzer
    analyzer = TranscriptAnalyzer()
    
    # Run analysis, expect error
    with pytest.raises(AnalysisError) as exc_info:
        await analyzer.analyze_transcript(test_vtt_content.encode())
    
    # Verify error message includes our custom message text
    assert "Analysis failed" in str(exc_info.value)
    
    # Verify chain was called
    mock_chain.run_analysis.assert_called_once() 