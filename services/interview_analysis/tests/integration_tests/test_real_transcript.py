"""
Integration tests using real transcript data.

These tests verify the system's ability to process and analyze actual interview transcripts,
focusing on the TranscriptAnalyzer component with mocked LLM responses.
"""
import pytest
from fastapi.testclient import TestClient
from fastapi import UploadFile
from app.main import app
import io
import json
from unittest.mock import patch, AsyncMock, MagicMock
from app.services.analysis.gemini_pipeline.analysis_pipeline import GeminiAnalysisPipeline

# Removed test_real_transcript_analysis - Redundant with API tests
# Removed test_real_transcript_content_verification - Redundant with API tests

@pytest.mark.asyncio
@pytest.mark.integration
async def test_analyzer_with_real_transcript(real_transcript_file):
    """
    Test transcript analyzer with real transcript content, mocking the LLM pipeline.
    Verifies the analyzer correctly handles file content and structures results.
    
    Args:
        real_transcript_file: Fixture providing a real interview transcript
    """
    
    # Import here to avoid potential circular dependencies during test discovery
    from app.services.analysis.analyzer import TranscriptAnalyzer
    from app.services.analysis.gemini_pipeline.analysis_pipeline import GeminiAnalysisPipeline
    
    # Reset file position and read the content
    real_transcript_file.seek(0)
    file_content = real_transcript_file.read()
    
    # Mock the LLM chain execution within the analyzer
    with patch('app.services.analysis.analyzer.GeminiAnalysisPipeline.run_analysis') as mock_run:
        # Define the expected output structure from the mocked pipeline
        mock_run.return_value = {
            "problem_areas": [
                {
                    "problem_id": "transcript-insights-1",
                    "title": "Healthcare Interview Process",
                    "description": "Insights about product development in healthcare space"
                },
                {
                    "problem_id": "transcript-insights-2",
                    "title": "Product Documentation Needs",
                    "description": "Discussion about how to document user interviews"
                }
            ],
            "synthesis": {
                "background": "Healthcare product development discussion",
                "problem_areas": ["Interview process", "Documentation needs"],
                "next_steps": ["Standardize documentation"]
            }
            # Note: No metadata or storage fields expected directly from run_analysis mock
        }
        
        # Instantiate the analyzer and process the real transcript bytes
        analyzer = TranscriptAnalyzer()
        result = await analyzer.analyze_transcript(file_content)
        
        # Verify the structure returned by the analyzer
        assert "problem_areas" in result
        assert "synthesis" in result
        assert "metadata" in result # Analyzer should add this
        assert "transcript" in result # Analyzer should add this
        assert len(result["problem_areas"]) == 2 # Based on mock response
        assert result["metadata"]["transcript_length"] > 0 # Should be calculated
        assert result["metadata"]["problem_areas_count"] == 2 # Based on mock response
        
        # Verify specific content from mock
        problem_titles = [p['title'] for p in result["problem_areas"]]
        assert "Healthcare Interview Process" in problem_titles
        assert "Product Documentation Needs" in problem_titles
        assert "Standardize documentation" in result["synthesis"]["next_steps"]
        
        # Ensure mock was called
        mock_run.assert_called_once() 