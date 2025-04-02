"""
Unit tests for the InterviewWorkflow class in the domain layer.

These tests verify the core business logic of processing interviews,
focusing on workflow orchestration and error handling.
"""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import io
from datetime import datetime

from app.domain.workflows import InterviewWorkflow
from app.utils.errors import AnalysisError, StorageError

@pytest.mark.unit
@pytest.mark.asyncio
async def test_workflow_initialization():
    """
    Test that the workflow can be properly initialized with its dependencies.
    
    Test Steps:
        1. Create mock services
        2. Initialize workflow with mocks
        3. Verify services are properly stored
    """
    # Create mock services
    mock_analyzer = AsyncMock()
    mock_repository = AsyncMock()
    
    # Initialize workflow
    workflow = InterviewWorkflow(mock_analyzer, mock_repository)
    
    # Verify services are properly assigned
    assert workflow.analyzer is mock_analyzer
    assert workflow.storage is mock_repository

@pytest.mark.unit
@pytest.mark.asyncio
async def test_successful_workflow_execution():
    """
    Test a successful end-to-end workflow execution.
    
    Test Steps:
        1. Set up mock services with expected behavior
        2. Initialize workflow
        3. Process sample file content
        4. Verify services were called with correct parameters
        5. Verify result structure
    """
    # Create mock services
    mock_analyzer = AsyncMock()
    mock_repository = AsyncMock()
    
    # Configure mock analyzer
    analysis_result = {
        "problem_areas": [
            {
                "problem_id": "p1",
                "title": "Test Problem",
                "description": "A test problem description",
                "excerpts": []
            }
        ],
        "transcript": [],
        "synthesis": {
            "background": "Test background",
            "problem_areas": ["Test problem area"],
            "next_steps": ["Test next step"]
        },
        "metadata": {
            "transcript_length": 10,
            "problem_areas_count": 1,
            "excerpts_count": 0
        }
    }
    mock_analyzer.analyze_transcript.return_value = analysis_result
    
    # Configure mock repository
    storage_result = {
        "id": "test-id",
        "created_at": datetime.now().isoformat()
    }
    mock_repository.store_interview.return_value = storage_result
    
    # Initialize workflow
    workflow = InterviewWorkflow(mock_analyzer, mock_repository)
    
    # Sample file content and metadata
    file_content = b"WEBVTT\n\n1\n00:00:00.000 --> 00:00:05.000\nTest content"
    metadata = {
        "project_id": "test-project",
        "interviewer": "Test Interviewer",
        "interview_date": "2025-01-01",
        "title": "Test Interview"
    }
    
    # Process the interview
    result = await workflow.process_interview(file_content, metadata)
    
    # Verify services were called with correct parameters
    mock_analyzer.analyze_transcript.assert_called_once_with(file_content)
    mock_repository.store_interview.assert_called_once()
    storage_call_args = mock_repository.store_interview.call_args[0]
    assert storage_call_args[0] == analysis_result
    assert storage_call_args[1]["project_id"] == "test-project"
    
    # Verify result structure
    assert "problem_areas" in result
    assert "transcript" in result
    assert "synthesis" in result
    assert "metadata" in result
    assert "storage" in result
    assert result["storage"]["id"] == "test-id"

@pytest.mark.unit
@pytest.mark.asyncio
async def test_analyzer_error_handling():
    """
    Test error handling when analyzer service fails.
    
    Test Steps:
        1. Configure analyzer service to raise an exception
        2. Process interview with workflow
        3. Verify the error is properly propagated
    """
    # Create mock services
    mock_analyzer = AsyncMock()
    mock_repository = AsyncMock()
    
    # Configure mock analyzer to raise exception
    mock_analyzer.analyze_transcript.side_effect = AnalysisError("Analysis failed")
    
    # Initialize workflow
    workflow = InterviewWorkflow(mock_analyzer, mock_repository)
    
    # Sample file content and metadata
    file_content = b"WEBVTT\n\n1\n00:00:00.000 --> 00:00:05.000\nTest content"
    metadata = {"title": "Test Interview"}
    
    # Process the interview and expect exception
    with pytest.raises(AnalysisError) as excinfo:
        await workflow.process_interview(file_content, metadata)
    
    # Verify exception message
    assert "Analysis failed" in str(excinfo.value)
    
    # Verify repository was never called
    mock_repository.store_interview.assert_not_called()

@pytest.mark.unit
@pytest.mark.asyncio
async def test_storage_error_handling():
    """
    Test error handling when storage service fails but analysis succeeds.
    
    Test Steps:
        1. Configure analyzer to return valid results
        2. Configure storage service to raise an exception
        3. Process interview with workflow
        4. Verify analysis result is returned but with storage error
    """
    # Create mock services
    mock_analyzer = AsyncMock()
    mock_repository = AsyncMock()
    
    # Configure mock analyzer
    analysis_result = {
        "problem_areas": [],
        "transcript": [],
        "synthesis": {},
        "metadata": {
            "transcript_length": 10,
            "problem_areas_count": 0,
            "excerpts_count": 0
        }
    }
    mock_analyzer.analyze_transcript.return_value = analysis_result
    
    # Configure mock repository to raise exception
    mock_repository.store_interview.side_effect = StorageError("Storage failed")
    
    # Initialize workflow
    workflow = InterviewWorkflow(mock_analyzer, mock_repository)
    
    # Sample file content and metadata
    file_content = b"WEBVTT\n\n1\n00:00:00.000 --> 00:00:05.000\nTest content"
    metadata = {"title": "Test Interview"}
    
    # Process the interview
    result = await workflow.process_interview(file_content, metadata)
    
    # Verify result contains analysis but with storage error
    assert "problem_areas" in result
    assert "transcript" in result
    assert "synthesis" in result
    assert "metadata" in result
    assert "storage" in result
    assert "error" in result["storage"]
    assert "Storage failed" in result["storage"]["error"] 