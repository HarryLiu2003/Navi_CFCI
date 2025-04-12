"""
API routes for persona-related operations.
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, Request 

from ..services.persona.workflow import PersonaWorkflow
from ..utils.api_responses import APIResponse
from ..utils.errors import NotFoundError, WorkflowError
from .dependencies import get_persona_workflow, get_forwarded_user_id 

# Set up logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter()

@router.post(
    "/{interview_id}/suggest_personas",
    summary="Suggest persona tags for an interview",
    description="Analyzes an interview transcript and suggests relevant personas, prioritizing existing ones.",
    tags=["Personas"],
    response_model=dict 
)
async def suggest_personas_endpoint(
    interview_id: str,
    user_id: str = Depends(get_forwarded_user_id), 
    workflow: PersonaWorkflow = Depends(get_persona_workflow) 
):
    """
    Endpoint to trigger persona suggestion for a given interview.
    Relies on user context being passed via X-Forwarded-User-ID header from gateway.
    """
    logger.info(f"Received request to suggest personas for interview {interview_id} by user {user_id}")
    try:
        suggestions = await workflow.suggest_personas_for_interview(interview_id, user_id)
        return APIResponse.success(
            message="Persona suggestions generated successfully",
            data=suggestions
        )
    except NotFoundError as e:
        logger.warning(f"Not found error for suggest personas request: {str(e)}")
        return APIResponse.error(message=str(e), status_code=404)
    except WorkflowError as e:
        logger.error(f"Workflow error during persona suggestion: {str(e)}", exc_info=True)
        return APIResponse.error(message="Failed to generate suggestions due to an internal error.", status_code=500)
    except HTTPException as e:
        # Re-raise HTTPExceptions (like auth errors from dependency)
        raise e
    except Exception as e:
        logger.error(f"Unexpected error suggesting personas: {str(e)}", exc_info=True)
        return APIResponse.error(
            message="An unexpected error occurred while suggesting personas.", 
            status_code=500
        ) 