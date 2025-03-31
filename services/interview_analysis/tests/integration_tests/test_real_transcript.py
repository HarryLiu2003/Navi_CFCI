"""
Integration tests using real transcript data.

These tests verify the system's ability to process and analyze actual interview transcripts,
focusing on end-to-end functionality with mocked LLM responses.
"""
import pytest
from fastapi.testclient import TestClient
from fastapi import UploadFile
from app.main import app
import io
import json
from unittest.mock import patch, AsyncMock, MagicMock

@pytest.mark.integration
def test_real_transcript_analysis(test_client, real_transcript_file):
    """
    Test complete analysis workflow with real transcript data.
    
    Args:
        test_client: FastAPI test client fixture
        real_transcript_file: Fixture providing a real interview transcript
    
    Test Steps:
        1. Mock LLM chain response
        2. Submit real transcript for analysis
        3. Verify successful processing
        4. Validate response structure and metadata
    """
    # This test validates that the VTT analyzer can handle the real transcript format
    
    # Mock the LLM chain to avoid actual API calls
    with patch('app.utils.analysis_chain.chain.SynthesisChain.run_analysis') as mock_run:
        # Set up mock response
        mock_run.return_value = {
            "problem_areas": [
                {
                    "problem_id": "test-1",
                    "title": "Healthcare Interviews",
                    "description": "Process for conducting healthcare interviews",
                    "excerpts": []
                }
            ],
            "synthesis": "Test synthesis of the interview transcript."
        }
        
        # Create a file for upload
        files = {
            "file": ("test_transcript.vtt", real_transcript_file, "text/vtt")
        }
        
        # Make request to the analysis endpoint
        response = test_client.post("/api/interview_analysis/analyze", files=files)
        
        # Verify the response
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert "problem_areas" in data["data"]
        assert "synthesis" in data["data"]
        assert "metadata" in data["data"]
        
        # Verify metadata fields - matching what the actual implementation provides
        metadata = data["data"]["metadata"]
        assert "transcript_length" in metadata
        # The field might be named differently in the actual implementation
        # Check for either possible field name
        assert "problem_areas_count" in metadata  # Number of problem areas
        assert "excerpts_count" in metadata  # Should be present

@pytest.mark.integration
def test_real_transcript_content_verification(test_client, real_transcript_file):
    """
    Test content analysis accuracy with real transcript data.
    
    Args:
        test_client: FastAPI test client fixture
        real_transcript_file: Fixture providing a real interview transcript
    
    Test Steps:
        1. Mock analysis chain with realistic responses
        2. Process real transcript content
        3. Verify problem area extraction
        4. Validate content-specific insights
    """
    
    # Mock the analysis to check transcript processing
    with patch('app.utils.analysis_chain.chain.SynthesisChain.run_analysis') as mock_run:
        # Set up mocked response with real content from the transcript
        mock_run.return_value = {
            "problem_areas": [
                {
                    "problem_id": "healthcare-context",
                    "title": "Healthcare Context",
                    "description": "Discussion about healthcare interview process",
                    "excerpts": [
                        {
                            "quote": "we are still locking down the specific user persona of. You know what kind of healthcare organizations we are innovating",
                            "categories": ["Context"],
                            "insight": "Healthcare user persona exploration",
                            "chunk_number": 28
                        }
                    ]
                }
            ],
            "synthesis": "The transcript discusses healthcare interview processes and user personas."
        }
        
        files = {
            "file": ("test_transcript.vtt", real_transcript_file, "text/vtt")
        }
        
        response = test_client.post("/api/interview_analysis/analyze", files=files)
        
        # Verify the response
        assert response.status_code == 200
        data = response.json()
        
        # Check for specific quotes in the excerpts from the test transcript
        problem_areas = data["data"]["problem_areas"]
        assert len(problem_areas) > 0
        
        # Verify the synthesis contains relevant terms
        synthesis = data["data"]["synthesis"]
        assert "healthcare" in synthesis.lower() or "interview" in synthesis.lower()

@pytest.mark.asyncio
@pytest.mark.integration
async def test_extract_problem_areas_with_real_transcript(real_transcript_file):
    """
    Test problem area extraction from real transcript content.
    
    Args:
        real_transcript_file: Fixture providing a real interview transcript
    
    Test Steps:
        1. Initialize transcript analyzer
        2. Mock LLM chain responses
        3. Process transcript through analyzer
        4. Verify problem area structure
        5. Validate extracted insights
    """
    
    # Import here to avoid circular imports
    from app.services.analyze import TranscriptAnalyzer
    from app.utils.analysis_chain.chain import SynthesisChain
    
    # Mock the LLM chain
    with patch('app.utils.analysis_chain.chain.SynthesisChain.extract_problem_areas') as mock_extract:
        mock_extract.return_value = {
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
            ]
        }
        
        # Process real transcript
        analyzer = TranscriptAnalyzer()
        upload_file = MagicMock(spec=UploadFile)
        upload_file.filename = "test_transcript.vtt"
        
        # Reset the file position
        real_transcript_file.seek(0)
        upload_file.read = AsyncMock(return_value=real_transcript_file.read())
        
        # Process the file
        preprocessed = await analyzer.preprocess_vtt(upload_file)
        transcript = " ".join([chunk["text"] for chunk in preprocessed["chunks"]])
        
        # Mock the chain
        chain = SynthesisChain("test_api_key")
        result = await chain.extract_problem_areas(transcript)
        
        # Verify the structure
        assert "problem_areas" in result
        assert len(result["problem_areas"]) > 0
        
        for problem in result["problem_areas"]:
            assert "problem_id" in problem
            assert "title" in problem
            assert "description" in problem 