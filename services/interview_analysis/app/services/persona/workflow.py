"""
Workflow for handling persona suggestion logic.
"""
import logging
from typing import Dict, Any

from ..storage.repository import InterviewRepository
from .persona_suggester import PersonaSuggester
from ...utils.errors import NotFoundError, WorkflowError
from ...utils.transcript_utils import format_chunks_for_analysis # Import the utility

logger = logging.getLogger(__name__)

class PersonaWorkflow:
    """Orchestrates the persona suggestion process."""

    def __init__(self, repository: InterviewRepository, suggester: PersonaSuggester):
        """Initialize the workflow with dependencies."""
        self.repository = repository
        self.suggester = suggester
        logger.info("PersonaWorkflow initialized")

    async def suggest_personas_for_interview(self, interview_id: str, user_id: str) -> Dict[str, Any]:
        """
        Fetch interview data, existing personas, and generate suggestions.

        Args:
            interview_id: The ID of the interview.
            user_id: The ID of the user making the request.

        Returns:
            A dictionary containing persona suggestions.

        Raises:
            NotFoundError: If the interview is not found.
            WorkflowError: If any step in the workflow fails.
        """
        logger.info(f"Starting persona suggestion workflow for interview {interview_id} and user {user_id}")
        try:
            # 1. Fetch interview data
            logger.debug(f"Fetching interview {interview_id}")
            interview = await self.repository.get_interview_by_id(interview_id)
            
            # Extract the list of transcript chunks
            transcript_chunks = interview.get("analysis_data", {}).get("transcript", []) 
            if not transcript_chunks or not isinstance(transcript_chunks, list):
                logger.warning(f"Transcript chunk list not found or invalid for interview {interview_id}. Analysis Data Keys: {list(interview.get('analysis_data', {}).keys())}")
                # If no transcript chunks, we cannot generate suggestions.
                raise WorkflowError(f"Transcript chunk data is missing or invalid for interview {interview_id}")

            # Format chunks into a single string using the utility
            logger.debug(f"Formatting {len(transcript_chunks)} transcript chunks for analysis.")
            formatted_transcript = format_chunks_for_analysis(transcript_chunks)
            
            if not formatted_transcript:
                # Handle case where formatting results in an empty string (e.g., all chunks were empty)
                 logger.warning(f"Formatted transcript is empty for interview {interview_id}. Cannot generate suggestions.")
                 raise WorkflowError(f"Formatted transcript is empty for interview {interview_id}")

            logger.debug(f"Formatted transcript length: {len(formatted_transcript)}")

            # 2. Fetch existing personas for the user
            logger.debug(f"Fetching personas for user {user_id}")
            existing_personas = await self.repository.get_personas_for_user(user_id)
            logger.debug(f"Fetched {len(existing_personas)} existing personas")

            # 3. Call the suggestion service with the formatted transcript
            logger.debug("Calling persona suggester service")
            suggestions = await self.suggester.suggest_personas(formatted_transcript, existing_personas)
            logger.info(f"Successfully generated suggestions for interview {interview_id}")
            
            return suggestions

        except NotFoundError as e:
            logger.warning(f"Interview not found during suggestion workflow: {str(e)}")
            raise  # Re-raise NotFoundError to be handled by the API layer
        
        except Exception as e:
            logger.error(f"Error during persona suggestion workflow for interview {interview_id}: {str(e)}", exc_info=True)
            # Wrap other exceptions in a generic WorkflowError
            raise WorkflowError(f"Failed to suggest personas: {str(e)}") 