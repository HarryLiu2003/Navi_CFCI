"""
Module for creating and managing LLM chains for interview analysis.
"""
import os
import logging
import google.generativeai as genai
from typing import Dict, Any, List, Optional
import json
from pydantic import ValidationError
from .models import SynthesisResult
from .prompts import SYSTEM_PROMPT
from ....config.api_config import APIConfig

# Set up logging
logger = logging.getLogger(__name__)

def create_analysis_chain():
    """
    Create and configure an analysis chain with Google Gemini.
    
    Returns:
        An initialized chain that can analyze transcripts.
    """
    # Get API key from environment 
    api_key = os.environ.get("GEMINI_API_KEY")
    
    if not api_key:
        logger.error("GEMINI_API_KEY not found in environment variables")
        raise ValueError("GEMINI_API_KEY environment variable not set")
    
    try:
        # Configure the Google API with the key
        genai.configure(api_key=api_key)
        
        # Get the configured model name
        model_name = APIConfig.GEMINI_MODEL
        logger.info(f"Using model: {model_name}")
        
        # Create a GeminiAnalysisChain instance
        return GeminiAnalysisChain(model_name)
        
    except Exception as e:
        logger.error(f"Error creating analysis chain: {str(e)}")
        raise ValueError(f"Failed to create LLM chain: {str(e)}")

class GeminiAnalysisChain:
    """
    Chain implementation using Google's Gemini API for transcript analysis.
    """
    
    def __init__(self, model_name):
        """Initialize with a specific model."""
        self.model = genai.GenerativeModel(model_name=model_name)
        self.system_prompt = SYSTEM_PROMPT
    
    async def run_analysis(self, transcript_text: str) -> Dict[str, Any]:
        """
        Run the analysis chain on the given transcript.
        
        Args:
            transcript_text: Formatted transcript text 
            
        Returns:
            Dictionary containing analysis results
            
        Raises:
            ValueError: If analysis fails
        """
        try:
            logger.info("Starting transcript analysis")
            
            # Create the structured prompt
            prompt = self._create_prompt(transcript_text)
            
            # Generate content from the model
            response = self.model.generate_content(prompt)
            
            # Parse the response
            result = self._parse_response(response.text)
            
            logger.info("Analysis completed successfully")
            return result
        
        except Exception as e:
            logger.error(f"Error in analysis chain: {str(e)}")
            raise ValueError(f"Analysis chain failed: {str(e)}")
    
    def _create_prompt(self, transcript_text: str) -> str:
        """
        Create a prompt for the Gemini model.
        
        Args:
            transcript_text: The transcript to analyze
            
        Returns:
            String prompt combining instructions and transcript
        """
        # For Gemini 2.0 Flash we can't use system role, so we combine everything into a single user prompt
        return f"{self.system_prompt}\n\nHere is the interview transcript to analyze:\n\n{transcript_text}"
    
    def _parse_response(self, response_text: str) -> Dict[str, Any]:
        """
        Parse the response from the model.
        
        Args:
            response_text: Raw text response from the model
            
        Returns:
            Structured analysis results
            
        Raises:
            ValueError: If parsing fails
        """
        try:
            # Try to parse as JSON first
            try:
                # Extract JSON if it's wrapped in markdown code blocks
                if "```json" in response_text and "```" in response_text:
                    # Find the JSON block
                    start_idx = response_text.find("```json") + 7
                    end_idx = response_text.find("```", start_idx)
                    json_str = response_text[start_idx:end_idx].strip()
                    result = json.loads(json_str)
                else:
                    # Try to parse the whole response as JSON
                    result = json.loads(response_text)
                
                # Basic validation of expected fields
                if not isinstance(result, dict):
                    raise ValueError("Response is not a dictionary")
                
                required_fields = ["problem_areas", "synthesis"]
                for field in required_fields:
                    if field not in result:
                        raise ValueError(f"Required field '{field}' missing from response")
                
                # Check if each problem area has required fields
                for problem_area in result.get("problem_areas", []):
                    # Ensure required fields are present
                    if "problem_id" not in problem_area:
                        problem_area["problem_id"] = f"problem-{len(result['problem_areas'])}"
                    
                    # Make sure excerpts exist
                    if "excerpts" not in problem_area:
                        problem_area["excerpts"] = []
                
                return result
            
            except json.JSONDecodeError:
                # If not valid JSON, try to extract structured info from text
                logger.warning("Response is not valid JSON, attempting extraction")
                
                # Simple extraction logic (would need to be enhanced for production)
                problem_areas = []
                
                # Create a simple fallback result
                result = {
                    "problem_areas": problem_areas,
                    "synthesis": "The model did not provide a valid response that could be parsed.",
                    "metadata": {
                        "parsed": False,
                        "raw_length": len(response_text)
                    }
                }
                
                return result
                
        except Exception as e:
            logger.error(f"Error parsing model response: {str(e)}")
            raise ValueError(f"Failed to parse model response: {str(e)}") 