"""
Dependency injection for the API routes.
"""
from fastapi import Depends
from ..domain.workflows import InterviewWorkflow
from ..services.analysis.analyzer import TranscriptAnalyzer
from ..services.storage.repository import InterviewRepository


def get_analyzer() -> TranscriptAnalyzer:
    """
    Dependency to get the transcript analyzer service.
    
    Returns:
        TranscriptAnalyzer: Configured transcript analyzer
    """
    return TranscriptAnalyzer()


def get_repository() -> InterviewRepository:
    """
    Dependency to get the interview repository service.
    
    Returns:
        InterviewRepository: Configured interview repository
    """
    return InterviewRepository()


def get_interview_workflow(
    analyzer: TranscriptAnalyzer = Depends(get_analyzer),
    repository: InterviewRepository = Depends(get_repository)
) -> InterviewWorkflow:
    """
    Dependency to get the interview workflow with configured services.
    
    Args:
        analyzer: The transcript analyzer service
        repository: The interview repository service
        
    Returns:
        InterviewWorkflow: Configured interview workflow
    """
    return InterviewWorkflow(analyzer, repository) 