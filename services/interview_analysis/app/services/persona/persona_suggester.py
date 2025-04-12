"""
Core logic for suggesting personas based on interview content using Gemini.
"""
import logging
from typing import Dict, Any, List

# Import the pipeline
from .gemini_pipeline.pipeline import GeminiPersonaPipeline
from ...utils.errors import AnalysisError # Reusing AnalysisError or create SuggestionError

logger = logging.getLogger(__name__)

class PersonaSuggester:
    def __init__(self, pipeline: GeminiPersonaPipeline):
        """Initialize with the Gemini pipeline for persona suggestions."""
        self.pipeline = pipeline
        logger.info("PersonaSuggester initialized with Gemini pipeline.")

    async def suggest_personas(
        self, 
        transcript: str, 
        existing_personas: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Analyzes transcript and suggests personas using the Gemini pipeline.

        Args:
            transcript: The interview transcript text.
            existing_personas: A list of existing persona dictionaries.

        Returns:
            A dictionary containing suggested existing persona IDs and new persona details.
            
        Raises:
            AnalysisError: If the underlying Gemini pipeline fails.
        """
        logger.info(f"Suggesting personas using Gemini for transcript (length: {len(transcript)}) and {len(existing_personas)} existing personas.")
        
        try:
            # Call the pipeline's run_suggestion method
            suggestions = await self.pipeline.run_suggestion(transcript, existing_personas)
            logger.info(f"Gemini generated suggestions: {suggestions}")
            return suggestions
        except Exception as e:
            logger.error(f"Error during Gemini suggestion call: {str(e)}", exc_info=True)
            # Re-raise the error (potentially wrapped if needed)
            # Using AnalysisError for now as defined in the pipeline
            raise AnalysisError(f"Failed to get persona suggestions from Gemini: {str(e)}") 