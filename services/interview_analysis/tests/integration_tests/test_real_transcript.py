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
from app.services.analysis.gemini_pipeline.analysis_pipeline import GeminiAnalysisPipeline

@pytest.mark.integration
def test_real_transcript_analysis(test_client, real_transcript_file):
    """
    Test complete analysis workflow with real transcript data.
    
    Args:
        test_client: FastAPI test client fixture
        real_transcript_file: Fixture providing a real interview transcript
    
    Test Steps:
        1. Mock domain workflow response
        2. Submit real transcript for analysis
        3. Verify successful processing
        4. Validate response structure and metadata
    """
    # Mock the workflow to avoid actual API calls
    with patch('app.domain.workflows.InterviewWorkflow.process_interview') as mock_process:
        # Set up mock response
        mock_process.return_value = {
            "problem_areas": [
                {
                    "problem_id": "test-1",
                    "title": "Healthcare Interviews",
                    "description": "Process for conducting healthcare interviews",
                    "excerpts": []
                }
            ],
            "synthesis": {
                "background": "Healthcare interview discussion",
                "problem_areas": ["Interview process challenges"],
                "next_steps": ["Refine interview protocol"]
            },
            "metadata": {
                "transcript_length": 150,
                "problem_areas_count": 1,
                "excerpts_count": 0
            },
            "storage": {
                "id": "interview-123",
                "created_at": "2025-04-02T01:02:22"
            }
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
        
        # Verify metadata fields
        metadata = data["data"]["metadata"]
        assert "transcript_length" in metadata
        assert "problem_areas_count" in metadata
        assert "excerpts_count" in metadata

@pytest.mark.integration
def test_real_transcript_content_verification(test_client, real_transcript_file):
    """
    Test content analysis accuracy with real transcript data.
    
    Args:
        test_client: FastAPI test client fixture
        real_transcript_file: Fixture providing a real interview transcript
    
    Test Steps:
        1. Mock domain workflow with realistic responses
        2. Process real transcript content
        3. Verify problem area extraction
        4. Validate content-specific insights
    """
    
    # Mock the workflow to check transcript processing
    with patch('app.domain.workflows.InterviewWorkflow.process_interview') as mock_process:
        # Set up mocked response with real content from the transcript
        mock_process.return_value = {
            "problem_areas": [
                {
                    "problem_id": "healthcare-context",
                    "title": "Healthcare Context",
                    "description": "Discussion about healthcare interview process",
                    "excerpts": [
                        {
                            "text": "we are still locking down the specific user persona of. You know what kind of healthcare organizations we are innovating",
                            "categories": ["Context"],
                            "insight_summary": "Healthcare user persona exploration",
                            "chunk_number": 28
                        }
                    ]
                }
            ],
            "synthesis": {
                "background": "The transcript discusses healthcare interview processes and user personas.",
                "problem_areas": ["Healthcare context understanding"],
                "next_steps": ["Define target personas"]
            },
            "metadata": {
                "transcript_length": 150,
                "problem_areas_count": 1,
                "excerpts_count": 1
            },
            "storage": {
                "id": "interview-456",
                "created_at": "2025-04-02T01:02:22"
            }
        }
        
        files = {
            "file": ("test_transcript.vtt", real_transcript_file, "text/vtt")
        }
        
        response = test_client.post("/api/interview_analysis/analyze", files=files)
        
        # Verify the response
        assert response.status_code == 200
        data = response.json()
        
        # Check for specific problem areas
        problem_areas = data["data"]["problem_areas"]
        assert len(problem_areas) > 0
        
        # Verify the synthesis contains relevant terms
        synthesis = data["data"]["synthesis"]
        assert "healthcare" in str(synthesis).lower() or "interview" in str(synthesis).lower()

@pytest.mark.asyncio
@pytest.mark.integration
async def test_analyzer_with_real_transcript(real_transcript_file):
    """
    Test transcript analyzer with real transcript content.
    
    Args:
        real_transcript_file: Fixture providing a real interview transcript
    
    Test Steps:
        1. Initialize transcript analyzer
        2. Mock GeminiAnalysisPipeline responses
        3. Process transcript through analyzer
        4. Verify analysis result structure
        5. Validate extracted insights
    """
    
    # Import here to avoid circular imports
    from app.services.analysis.analyzer import TranscriptAnalyzer
    from app.services.analysis.gemini_pipeline.analysis_pipeline import GeminiAnalysisPipeline
    
    # Reset file position and read the content
    real_transcript_file.seek(0)
    file_content = real_transcript_file.read()
    
    # Mock the LLM chain
    with patch('app.services.analysis.gemini_pipeline.analysis_pipeline.GeminiAnalysisPipeline.run_analysis') as mock_run:
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
        }
        
        # Process real transcript by directly providing the byte content
        analyzer = TranscriptAnalyzer()
        
        # Process the file directly with bytes
        result = await analyzer.analyze_transcript(file_content)
        
        # Verify the structure
        assert "problem_areas" in result
        assert "synthesis" in result
        assert len(result["problem_areas"]) > 0
        
        for problem in result["problem_areas"]:
            assert "problem_id" in problem
            assert "title" in problem
            assert "description" in problem

        """
        This test follows the complete flow:
        1. Load a real transcript file from test fixtures
        2. Mock GeminiAnalysisPipeline responses
        3. Process the transcript through the analyzer
        4. Verify the full analysis result has expected format and information
        """ 