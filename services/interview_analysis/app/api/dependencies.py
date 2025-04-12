"""
Dependency injection for the API routes.
"""
import logging # Add logging import
from fastapi import Depends, HTTPException, Request
from ..domain.workflows import InterviewWorkflow
from ..services.analysis.analyzer import TranscriptAnalyzer
from ..services.storage.repository import InterviewRepository
from ..services.analysis.gemini_pipeline.analysis_pipeline import create_analysis_pipeline

# Import new dependencies for Persona Workflow
from ..services.persona.workflow import PersonaWorkflow
from ..services.persona.persona_suggester import PersonaSuggester
# Import the persona Gemini pipeline creator
from ..services.persona.gemini_pipeline.pipeline import create_persona_pipeline

# Setup logger for this module
logger = logging.getLogger(__name__)

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


def get_persona_workflow() -> PersonaWorkflow:
    """Dependency provider for PersonaWorkflow."""
    repository = InterviewRepository()
    # Instantiate the actual Gemini pipeline for persona suggestion
    try:
        persona_pipeline = create_persona_pipeline()
        suggester = PersonaSuggester(pipeline=persona_pipeline)
    except ValueError as e:
        # If pipeline creation fails (e.g., missing API key), log error and potentially raise HTTPException
        # This prevents the app from starting if core dependencies are missing.
        logger.critical(f"Failed to create Persona Suggestion Pipeline: {str(e)}")
        # Depending on desired behavior, could raise HTTPException(503, ...) or allow app to start degraded.
        # For now, let's re-raise to prevent startup without the pipeline.
        raise RuntimeError(f"Persona Suggestion Pipeline initialization failed: {str(e)}") 
        
    return PersonaWorkflow(repository=repository, suggester=suggester)


# Dependency to get User ID from forwarded header
def get_forwarded_user_id(request: Request) -> str:
    """Dependency to extract User ID from the X-Forwarded-User-ID header."""
    user_id = request.headers.get("x-forwarded-user-id") # Headers are case-insensitive
    if not user_id:
        # This should ideally not happen if the gateway is configured correctly
        logger.error("Missing X-Forwarded-User-ID header in request from gateway.")
        raise HTTPException(status_code=401, detail="User context missing from request.")
    logger.debug(f"Extracted forwarded user ID: {user_id}")
    return user_id 