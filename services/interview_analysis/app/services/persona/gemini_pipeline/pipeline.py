"""
Module for creating and managing the Gemini API pipeline for persona suggestion.
"""
import os
import logging
import google.generativeai as genai
from typing import Dict, Any, List
import json
from pydantic import ValidationError

from .persona_response_models import PersonaSuggestions
from .persona_prompts import SYSTEM_PROMPT
from ....config.api_config import APIConfig
from ....utils.errors import AnalysisError # Reusing AnalysisError, or could create a SuggestionError

# Set up logging
logger = logging.getLogger(__name__)

def create_persona_pipeline():
    """
    Create and configure a persona suggestion pipeline with Google Gemini.
    
    Returns:
        An initialized GeminiPersonaPipeline instance.
        
    Raises:
        ValueError: If API key is missing or configuration fails.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        logger.error("GEMINI_API_KEY not found in environment variables")
        raise ValueError("GEMINI_API_KEY environment variable not set")
    
    try:
        genai.configure(api_key=api_key)
        model_name = APIConfig.GEMINI_MODEL # Use the same configured model
        logger.info(f"Creating Persona Suggestion Pipeline using model: {model_name}")
        return GeminiPersonaPipeline(model_name)
    except Exception as e:
        logger.error(f"Error creating persona suggestion pipeline: {str(e)}")
        raise ValueError(f"Failed to create Gemini persona pipeline: {str(e)}")

class GeminiPersonaPipeline:
    """
    Pipeline using Google's Gemini API for persona suggestion.
    """
    
    def __init__(self, model_name):
        """Initialize with a specific model."""
        self.model = genai.GenerativeModel(model_name=model_name)
        self.system_prompt = SYSTEM_PROMPT
    
    async def run_suggestion(
        self, 
        transcript_text: str, 
        existing_personas: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Run the suggestion pipeline.
        
        Args:
            transcript_text: Formatted transcript text.
            existing_personas: List of existing persona objects (e.g., {'id': '...', 'name': '...'}).
            
        Returns:
            Dictionary containing suggestion results validated by PersonaSuggestions model.
            
        Raises:
            AnalysisError: If suggestion generation or parsing fails.
        """
        try:
            logger.info("Starting persona suggestion generation")
            prompt = self._create_prompt(transcript_text, existing_personas)
            
            # Use circuit breaker from main? Or internal retry?
            # For now, direct call.
            logger.debug("Sending request to Gemini model")
            response = self.model.generate_content(prompt)
            logger.debug("Received response from Gemini model")
            
            result = self._parse_response(response.text)
            logger.info("Persona suggestion parsing completed successfully")
            return result
        
        except Exception as e:
            logger.error(f"Error in persona suggestion pipeline: {str(e)}", exc_info=True)
            # Wrap in a specific error if desired, using AnalysisError for now
            raise AnalysisError(f"Persona suggestion pipeline failed: {str(e)}")
    
    def _create_prompt(
        self, 
        transcript_text: str, 
        existing_personas: List[Dict[str, Any]]
    ) -> str:
        """
        Create the full prompt for the Gemini model.
        """
        # Format existing personas for the prompt
        try:
            existing_personas_json = json.dumps(existing_personas, indent=2)
            logger.debug(f"Formatted existing personas for prompt: {existing_personas_json}") 
        except Exception as e:
            logger.error(f"Failed to serialize existing personas to JSON: {str(e)}")
            existing_personas_json = "[] # Error serializing personas"
            
        # Combine system prompt, existing personas, and transcript
        full_prompt = (
            f"{self.system_prompt}\n\n"
            f"**Existing Personas:**\n{existing_personas_json}\n\n"
            f"**Interview Transcript:**\n{transcript_text}"
        )
        return full_prompt
    
    def _parse_response(self, response_text: str) -> Dict[str, Any]:
        """
        Parse and validate the JSON response from the model using PersonaSuggestions.
        Handles potential markdown code blocks and surrounding text.
        """
        try:
            logger.debug(f"Raw Gemini response text (first 500 chars): {response_text[:500]}...")
            json_str = response_text

            # Attempt to find JSON within potential markdown fences or other text
            json_start = json_str.find('{')
            json_end = json_str.rfind('}')

            if json_start != -1 and json_end != -1 and json_end > json_start:
                json_str = json_str[json_start:json_end+1]
                logger.debug(f"Attempting to parse extracted JSON: {json_str}")
            else:
                 logger.warning("Could not find valid JSON object delimiters {{...}} in response. Trying to parse raw text.")
                 # Fallback: Try parsing the whole string if no clear delimiters found
                 # (This might fail more often if there's extra text)

            # Parse the JSON
            try:
                parsed_data = json.loads(json_str)
                logger.debug(f"Successfully parsed JSON: {parsed_data}")
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON response: {str(e)}. Response text: {json_str}")
                raise ValueError(f"Invalid JSON in response: {str(e)}")
            
            # Validate with Pydantic model
            try:
                suggestions = PersonaSuggestions(**parsed_data)
                logger.info("Successfully validated response against PersonaSuggestions model.")
                return suggestions.model_dump() # Return as dict
            except ValidationError as e:
                logger.error(f"Pydantic validation failed: {str(e)}. Parsed data: {parsed_data}")
                # Unlike analysis, suggestions are simpler. If validation fails, 
                # maybe return empty suggestions rather than complex fixing?
                # For now, re-raise the error to signal a problem.
                raise ValueError(f"Model response validation failed: {str(e)}")
                
        except Exception as e:
            logger.error(f"Error parsing suggestion model response: {str(e)}", exc_info=True)
            raise ValueError(f"Failed to parse suggestion model response: {str(e)}") 