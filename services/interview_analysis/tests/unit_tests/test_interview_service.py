"""
Unit tests for the InterviewWorkflow class.

These tests verify the domain layer's functionality with mocked service implementations.
"""
import pytest
import pytest_asyncio
from unittest.mock import patch, MagicMock, AsyncMock
from app.domain.workflows import InterviewWorkflow
from app.services.storage.repository import InterviewRepository
from app.services.analysis.analyzer import TranscriptAnalyzer
from app.utils.errors import AnalysisError, StorageError

@pytest.fixture
def mock_analyzer():
    """Create a mock for the TranscriptAnalyzer class."""
    mock = AsyncMock()
    mock.analyze_transcript = AsyncMock()
    return mock

@pytest.fixture
def mock_repository():
    """Create a mock for the InterviewRepository class."""
    mock = AsyncMock()
    mock.store_interview = AsyncMock()
    return mock

@pytest.fixture
def sample_analysis_result():
    """Return a sample analysis result for testing."""
    return {
        "problem_areas": [
            {
                "problem_id": "test-1",
                "title": "Test Problem",
                "description": "This is a test problem description"
            }
        ],
        "transcript": [
            {
                "chunk_number": 1,
                "speaker": "Interviewer",
                "text": "Tell me about your biggest challenge."
            }
        ],
        "synthesis": {
            "background": "User testing session",
            "problem_areas": ["Test problem"],
            "next_steps": ["Improve UX"]
        },
        "metadata": {
            "transcript_length": 10,
            "problem_areas_count": 1,
            "excerpts_count": 0
        }
    }

@pytest.fixture
def sample_metadata():
    """Return sample metadata for testing."""
    return {
        "project_id": "project-123",
        "interviewer": "Test Interviewer",
        "interview_date": "2025-03-31T12:00:00",
        "title": "Test Interview"
    }

@pytest.fixture
def sample_stored_interview():
    """Return a sample stored interview response."""
    return {
        "id": "interview-123",
        "created_at": "2025-03-31T12:00:00"
    }

@pytest.mark.unit
@pytest.mark.asyncio
async def test_process_interview(mock_analyzer, mock_repository, sample_analysis_result, sample_metadata, sample_stored_interview):
    """
    Test the process_interview method of the workflow.
    
    Args:
        mock_analyzer: Mocked TranscriptAnalyzer
        mock_repository: Mocked InterviewRepository
        sample_analysis_result: Sample analysis result fixture
        sample_metadata: Sample metadata fixture
        sample_stored_interview: Sample stored interview fixture
    """
    # Set up mocks
    mock_analyzer.analyze_transcript.return_value = sample_analysis_result
    mock_repository.store_interview.return_value = sample_stored_interview
    
    # Create workflow
    workflow = InterviewWorkflow(mock_analyzer, mock_repository)
    
    # Execute workflow
    file_content = b"WEBVTT\n\n1\n00:00:00.000 --> 00:00:05.000\nInterviewer: Test"
    result = await workflow.process_interview(file_content, sample_metadata)
    
    # Verify method calls
    mock_analyzer.analyze_transcript.assert_called_once_with(file_content)
    mock_repository.store_interview.assert_called_once()
    
    # Verify results
    assert result["problem_areas"] == sample_analysis_result["problem_areas"]
    assert result["synthesis"] == sample_analysis_result["synthesis"]
    assert result["storage"]["id"] == sample_stored_interview["id"]

@pytest.mark.unit
@pytest.mark.asyncio
async def test_analyzer_error_handling(mock_analyzer, mock_repository, sample_metadata):
    """
    Test error handling when analyzer service fails.
    
    Args:
        mock_analyzer: Mocked TranscriptAnalyzer
        mock_repository: Mocked InterviewRepository
        sample_metadata: Sample metadata fixture
    """
    # Configure mock analyzer to raise exception
    mock_analyzer.analyze_transcript.side_effect = AnalysisError("Analysis failed")
    
    # Create workflow
    workflow = InterviewWorkflow(mock_analyzer, mock_repository)
    
    # Process interview and expect exception
    file_content = b"WEBVTT\n\n1\n00:00:00.000 --> 00:00:05.000\nInterviewer: Test"
    with pytest.raises(AnalysisError) as excinfo:
        await workflow.process_interview(file_content, sample_metadata)
    
    # Verify exception message
    assert "Analysis failed" in str(excinfo.value)
    
    # Verify repository was never called
    mock_repository.store_interview.assert_not_called()

@pytest.mark.unit
@pytest.mark.asyncio
async def test_storage_error_handling(mock_analyzer, mock_repository, sample_analysis_result, sample_metadata):
    """
    Test error handling when storage service fails but analysis succeeds.
    
    Args:
        mock_analyzer: Mocked TranscriptAnalyzer
        mock_repository: Mocked InterviewRepository
        sample_analysis_result: Sample analysis result fixture
        sample_metadata: Sample metadata fixture
    """
    # Configure mocks
    mock_analyzer.analyze_transcript.return_value = sample_analysis_result
    mock_repository.store_interview.side_effect = StorageError("Storage failed")
    
    # Create workflow
    workflow = InterviewWorkflow(mock_analyzer, mock_repository)
    
    # Execute workflow with storage error
    file_content = b"WEBVTT\n\n1\n00:00:00.000 --> 00:00:05.000\nInterviewer: Test"
    result = await workflow.process_interview(file_content, sample_metadata)
    
    # Verify result contains analysis but with storage error
    assert "problem_areas" in result
    assert "transcript" in result
    assert "synthesis" in result
    assert "metadata" in result
    assert "storage" in result
    assert "error" in result["storage"]
    assert "Storage failed" in result["storage"]["error"] 