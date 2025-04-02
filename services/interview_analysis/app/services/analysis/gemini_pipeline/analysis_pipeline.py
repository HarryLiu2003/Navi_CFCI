"""
Module for creating and managing Gemini API pipeline for interview analysis.
"""
import os
import logging
import google.generativeai as genai
from typing import Dict, Any, List, Optional
import json
from pydantic import ValidationError
from .response_models import AnalysisResult, ProblemArea, Excerpt
from .analysis_prompts import SYSTEM_PROMPT
from ....config.api_config import APIConfig

# Set up logging
logger = logging.getLogger(__name__)

def create_analysis_pipeline():
    """
    Create and configure an analysis pipeline with Google Gemini.
    
    Returns:
        An initialized pipeline that can analyze transcripts.
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
        
        # Create a GeminiAnalysisPipeline instance
        return GeminiAnalysisPipeline(model_name)
        
    except Exception as e:
        logger.error(f"Error creating analysis pipeline: {str(e)}")
        raise ValueError(f"Failed to create Gemini pipeline: {str(e)}")

class GeminiAnalysisPipeline:
    """
    Pipeline implementation using Google's Gemini API for transcript analysis.
    """
    
    def __init__(self, model_name):
        """Initialize with a specific model."""
        self.model = genai.GenerativeModel(model_name=model_name)
        self.system_prompt = SYSTEM_PROMPT
    
    async def run_analysis(self, transcript_text: str) -> Dict[str, Any]:
        """
        Run the analysis pipeline on the given transcript.
        
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
            
            # Parse and validate the response
            result = self._parse_response(response.text)
            
            logger.info("Analysis completed successfully")
            return result
        
        except Exception as e:
            logger.error(f"Error in analysis pipeline: {str(e)}")
            raise ValueError(f"Analysis pipeline failed: {str(e)}")
    
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
        Parse and validate the response from the model using Pydantic models.
        
        Args:
            response_text: Raw text response from the model
            
        Returns:
            Structured analysis results
            
        Raises:
            ValueError: If parsing fails
        """
        try:
            # Try to extract JSON first
            json_str = response_text
            
            # Extract JSON if it's wrapped in markdown code blocks
            if "```json" in response_text and "```" in response_text:
                start_idx = response_text.find("```json") + 7
                end_idx = response_text.find("```", start_idx)
                json_str = response_text[start_idx:end_idx].strip()
            
            # Parse the JSON
            try:
                parsed_data = json.loads(json_str)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON: {str(e)}")
                raise ValueError(f"Invalid JSON in response: {str(e)}")
            
            # Validate with Pydantic models
            try:
                # First attempt to validate the entire response
                analysis_result = AnalysisResult(**parsed_data)
                return analysis_result.model_dump()
            except ValidationError as e:
                logger.warning(f"Validation error with Pydantic model: {str(e)}")
                
                # If validation fails, try to fix common issues and retry
                logger.info("Attempting to fix response structure and revalidate")
                fixed_data = self._fix_response_structure(parsed_data)
                
                try:
                    analysis_result = AnalysisResult(**fixed_data)
                    logger.info("Successfully fixed and validated response")
                    return analysis_result.model_dump()
                except ValidationError as e:
                    logger.error(f"Failed to validate even after fixing: {str(e)}")
                    
                    # Return the best we can with manual validation as fallback
                    return self._manual_validation_fallback(parsed_data)
                
        except Exception as e:
            logger.error(f"Error parsing model response: {str(e)}")
            raise ValueError(f"Failed to parse model response: {str(e)}")
    
    def _fix_response_structure(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Fix common issues in the response structure to make it valid.
        
        Args:
            data: Parsed but potentially invalid response data
            
        Returns:
            Fixed data structure
        """
        # Create a copy to avoid modifying the original
        fixed_data = data.copy()
        
        # Ensure required top-level fields exist
        if "problem_areas" not in fixed_data:
            fixed_data["problem_areas"] = []
            
        if "synthesis" not in fixed_data:
            fixed_data["synthesis"] = "No synthesis provided by the model."
            
        if "metadata" not in fixed_data:
            fixed_data["metadata"] = {}
        
        # Fix problem areas
        for i, problem_area in enumerate(fixed_data.get("problem_areas", []), 1):
            # Add or fix problem_id
            if "problem_id" not in problem_area or not problem_area["problem_id"].isdigit():
                problem_area["problem_id"] = str(i)
                
            # Ensure excerpts exist and are properly formatted
            if "excerpts" not in problem_area:
                problem_area["excerpts"] = []
                
            for excerpt in problem_area.get("excerpts", []):
                # Ensure quote field exists
                if "quote" not in excerpt and "text" in excerpt:
                    excerpt["quote"] = excerpt["text"]
                    
                # Ensure categories is a list
                if "categories" not in excerpt:
                    excerpt["categories"] = ["Pain Point"]
                elif isinstance(excerpt["categories"], str):
                    excerpt["categories"] = [excerpt["categories"]]
                    
                # Ensure insight field exists
                if "insight" not in excerpt and "insight_summary" in excerpt:
                    excerpt["insight"] = excerpt["insight_summary"]
                elif "insight" not in excerpt:
                    excerpt["insight"] = "No insight provided."
        
        return fixed_data
    
    def _manual_validation_fallback(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Fallback validation method when Pydantic validation fails completely.
        
        Args:
            data: Parsed but invalid response data
            
        Returns:
            Manually validated data
        """
        logger.warning("Using manual validation fallback")
        
        # Basic structure check
        if not isinstance(data, dict):
            data = {"problem_areas": [], "synthesis": "Invalid response format", "metadata": {}}
            
        # Check and fix required fields
        required_fields = ["problem_areas", "synthesis"]
        for field in required_fields:
            if field not in data:
                if field == "problem_areas":
                    data[field] = []
                else:
                    data[field] = "Missing field in response"
        
        # Ensure problem_areas is a list
        if not isinstance(data["problem_areas"], list):
            data["problem_areas"] = []
            
        # Check each problem area
        for i, problem_area in enumerate(data["problem_areas"], 1):
            # Ensure problem_id is a string number
            if "problem_id" not in problem_area:
                problem_area["problem_id"] = str(i)
            elif not problem_area["problem_id"].isdigit():
                problem_area["problem_id"] = str(i)
                
            # Ensure required fields in problem area
            for field in ["title", "description"]:
                if field not in problem_area:
                    problem_area[field] = f"Missing {field}"
                    
            # Ensure excerpts exist
            if "excerpts" not in problem_area or not isinstance(problem_area["excerpts"], list):
                problem_area["excerpts"] = []
                
        # Add metadata if missing
        if "metadata" not in data:
            data["metadata"] = {}
            
        # Add basic metadata
        data["metadata"]["manually_validated"] = True
        data["metadata"]["problem_areas_count"] = len(data["problem_areas"])
        
        return data 