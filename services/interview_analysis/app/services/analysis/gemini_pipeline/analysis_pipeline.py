"""
Module for creating and managing Gemini API pipeline for interview analysis using LangChain prompts.
"""
import os
import logging
import google.generativeai as genai
from typing import Dict, Any, List, Optional, Tuple
import json
# Removed Pydantic validation imports for now, can be re-added per step
# from pydantic import ValidationError
# from .response_models import AnalysisResult, ProblemArea, Excerpt
from .analysis_prompts import PROBLEM_PROMPT, EXCERPT_PROMPT, SYNTHESIS_PROMPT # Import new LangChain prompts
from ....config.api_config import APIConfig
import traceback # For more detailed error logging

# Set up logging
logger = logging.getLogger(__name__)

# --- Helper Function for JSON Parsing ---
def _extract_and_parse_json(response_text: str) -> Optional[Dict[str, Any]]:
    """
    Extracts JSON string from potential markdown code blocks and parses it.

    Args:
        response_text: Raw text response from the model.

    Returns:
        Parsed JSON dictionary or None if parsing fails.
    """
    try:
        json_str = response_text
        # Extract JSON if it's wrapped in markdown code blocks
        if "```json" in response_text:
            start_idx = response_text.find("```json") + 7
            end_idx = response_text.rfind("```") # Use rfind for the last occurrence
            if end_idx > start_idx:
                json_str = response_text[start_idx:end_idx].strip()
            else: # Fallback if closing ``` not found correctly
                 # Find the end based on braces if markdown fails
                 first_brace = response_text.find('{', start_idx)
                 last_brace = response_text.rfind('}')
                 if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
                     json_str = response_text[first_brace:last_brace+1].strip()
                 else:
                     logger.warning("Could not reliably find JSON end after ```json marker.")
                     return None # Cannot reliably find JSON end

        elif response_text.strip().startswith('{') and response_text.strip().endswith('}'):
             json_str = response_text.strip()
        else:
             # Attempt to find the first '{' and last '}' if no ```json
             first_brace = response_text.find('{')
             last_brace = response_text.rfind('}')
             if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
                 json_str = response_text[first_brace:last_brace+1].strip()
             else:
                 logger.warning("Could not reliably find JSON structure in response.")
                 return None # Cannot reliably find JSON

        return json.loads(json_str)

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON: {str(e)}. Raw text: '{response_text[:200]}...'")
        return None
    except Exception as e:
        logger.error(f"Unexpected error during JSON extraction/parsing: {str(e)}")
        return None

# --- End Helper Function ---


def create_analysis_pipeline():
    """
    Create and configure an analysis pipeline with Google Gemini.
    
    Returns:
        An initialized GeminiAnalysisPipeline instance.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        logger.error("GEMINI_API_KEY not found in environment variables")
        raise ValueError("GEMINI_API_KEY environment variable not set")
    
    try:
        genai.configure(api_key=api_key)
        model_name = APIConfig.GEMINI_MODEL
        logger.info(f"Using model: {model_name}")
        # Configure safety settings to be less restrictive if needed (adjust as necessary)
        safety_settings = [
            { "category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE" },
            { "category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE" },
            { "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE" },
            { "category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE" },
        ]
        return GeminiAnalysisPipeline(model_name, safety_settings)
    except Exception as e:
        logger.error(f"Error creating analysis pipeline: {str(e)}")
        raise ValueError(f"Failed to create Gemini pipeline: {str(e)}")


class GeminiAnalysisPipeline:
    """
    Pipeline implementation using Google's Gemini API and LangChain prompts
    for multi-step transcript analysis.
    """

    def __init__(self, model_name, safety_settings):
        """Initialize with a specific model and safety settings."""
        self.model = genai.GenerativeModel(
            model_name=model_name,
            safety_settings=safety_settings,
            # Consider adding generation_config if needed (e.g., temperature)
            # generation_config=genai.types.GenerationConfig(temperature=0.7)
            )
        # Prompts are imported constants now, no need for self.system_prompt

    async def run_analysis(
        self,
        transcript_text: str,
        transcript_chunks: List[Dict[str, Any]], # Used to get max_chunk_number
        participants: List[str] # Pre-parsed participants
    ) -> Dict[str, Any]:
        """
        Run the multi-step analysis pipeline on the given transcript.
        
        Args:
            transcript_text: Formatted transcript text.
            transcript_chunks: List of transcript chunk dictionaries.
            participants: List of pre-parsed participant names.
            
        Returns:
            Dictionary containing analysis results or error information.
        """
        logger.info("Starting multi-step transcript analysis")
        final_result: Dict[str, Any] = {
            "participants": participants,
            "problem_areas": [],
            "synthesis": "Analysis incomplete.",
            "metadata": {"problem_areas_count": 0, "excerpts_count": 0},
            "suggested_title": None # Initialize suggested_title
        }

        try:
            # --- Step 1: Identify Problem Areas ---
            logger.info("Step 1: Identifying Problem Areas...")
            problem_prompt_formatted = PROBLEM_PROMPT.format_prompt(transcript=transcript_text).to_string()

            problem_data = None
            try:
                problem_response = await self.model.generate_content_async(problem_prompt_formatted)
                problem_data = _extract_and_parse_json(problem_response.text)
            except Exception as e:
                logger.error(f"Gemini API call failed during problem identification: {e}")

            if not problem_data or "problem_areas" not in problem_data or not isinstance(problem_data["problem_areas"], list):
                logger.error("Failed to get valid problem areas from Step 1. Proceeding without structured problems.")
                problem_areas = []
            else:
                problem_areas = problem_data["problem_areas"]
                logger.info(f"Identified {len(problem_areas)} potential problem areas.")
                problem_areas = [pa for pa in problem_areas if isinstance(pa, dict) and "problem_id" in pa and "title" in pa and "description" in pa]
                if not problem_areas:
                     logger.warning("No valid problem areas found after basic cleaning for Step 1.")
            
            final_result["problem_areas"] = problem_areas

            # --- Step 2: Extract Excerpts --- 
            if problem_areas:
                logger.info("Step 2: Extracting Excerpts...")
                if not transcript_chunks:
                    logger.warning("No transcript chunks provided, cannot determine max_chunk_number. Skipping excerpt extraction.")
                    for pa in final_result["problem_areas"]:
                         pa["excerpts"] = []
                else:
                    max_chunk_number = max(chunk.get('number', 0) for chunk in transcript_chunks) if transcript_chunks else 0
                    problem_areas_json_str = json.dumps({"problem_areas": problem_areas})

                    excerpt_prompt_formatted = EXCERPT_PROMPT.format_prompt(
                        problem_areas=problem_areas_json_str,
                        transcript=transcript_text,
                        max_chunk_number=max_chunk_number
                    ).to_string()

                    excerpt_data = None
                    try:
                        excerpt_response = await self.model.generate_content_async(excerpt_prompt_formatted)
                        excerpt_data = _extract_and_parse_json(excerpt_response.text)
                    except Exception as e:
                        logger.error(f"Gemini API call failed during excerpt extraction: {e}")

                    if not excerpt_data or "problem_areas" not in excerpt_data or not isinstance(excerpt_data["problem_areas"], list):
                        logger.warning("Failed to get valid excerpts from Step 2. Proceeding without excerpts.")
                        for pa in final_result["problem_areas"]:
                            pa["excerpts"] = []
                    else:
                        excerpts_map: Dict[str, List[Dict[str, Any]]] = {}
                        raw_excerpt_problems = excerpt_data["problem_areas"]
                        for pa_excerpt_data in raw_excerpt_problems:
                            if isinstance(pa_excerpt_data, dict) and "problem_id" in pa_excerpt_data and isinstance(pa_excerpt_data.get("excerpts"), list):
                                valid_excerpts = []
                                for ex in pa_excerpt_data["excerpts"]:
                                    if isinstance(ex, dict) and "quote" in ex and "categories" in ex and "insight" in ex and "chunk_number" in ex:
                                        if isinstance(ex["categories"], str):
                                            ex["categories"] = [ex["categories"]]
                                        try:
                                            ex["chunk_number"] = int(ex["chunk_number"])
                                            valid_excerpts.append(ex)
                                        except (ValueError, TypeError):
                                            logger.warning(f"Invalid chunk_number format skipped: {ex.get('chunk_number')}")
                                    else:
                                        logger.warning(f"Skipping invalid excerpt structure: {ex}")
                                if valid_excerpts:
                                    excerpts_map[pa_excerpt_data["problem_id"]] = valid_excerpts

                        for pa in final_result["problem_areas"]:
                            pa_id = pa.get("problem_id")
                            if pa_id in excerpts_map:
                                pa["excerpts"] = excerpts_map[pa_id]
                            else:
                                pa["excerpts"] = []
                        logger.info("Successfully merged excerpts.")
            else:
                 for pa in final_result["problem_areas"]:
                        pa["excerpts"] = []

            # --- Step 3: Synthesize Findings & Title --- 
            logger.info("Step 3: Synthesizing Results and Suggesting Title...")
            analysis_content_json_str = json.dumps({"problem_areas": final_result["problem_areas"]})
            synthesis_prompt_formatted = SYNTHESIS_PROMPT.format_prompt(
                analyzed_content=analysis_content_json_str,
                transcript=transcript_text
            ).to_string()

            synthesis_data = None
            suggested_title = None
            try:
                synthesis_response = await self.model.generate_content_async(synthesis_prompt_formatted)
                synthesis_data = _extract_and_parse_json(synthesis_response.text)
            except Exception as e:
                 logger.error(f"Gemini API call failed during synthesis/title step: {e}")

            if synthesis_data:
                if isinstance(synthesis_data.get("synthesis"), str):
                    final_result["synthesis"] = synthesis_data["synthesis"]
                    logger.info("Successfully generated synthesis.")
                else:
                    logger.warning("Failed to get valid synthesis string from Step 3.")
                    final_result["synthesis"] = "Synthesis generation failed." if not final_result["problem_areas"] else "Synthesis generation failed, but problem areas identified."
                
                if isinstance(synthesis_data.get("suggested_title"), str):
                    suggested_title = synthesis_data["suggested_title"]
                    final_result["suggested_title"] = suggested_title
                    logger.info(f"Successfully generated suggested title: {suggested_title}")
                else:
                    logger.warning("Failed to get valid suggested_title string from Step 3.")
                    final_result["suggested_title"] = None
            else:
                logger.warning("Failed to parse response from Step 3 (Synthesis/Title). Using defaults.")
                final_result["synthesis"] = "Synthesis generation failed." if not final_result["problem_areas"] else "Synthesis generation failed, but problem areas identified."
                final_result["suggested_title"] = None

            # --- Step 4: Calculate Metadata --- 
            final_result["metadata"]["problem_areas_count"] = len(final_result["problem_areas"])
            final_result["metadata"]["excerpts_count"] = sum(
                len(pa.get("excerpts", [])) for pa in final_result["problem_areas"]
            )
            logger.info(f"Final metadata calculated: Problems={final_result['metadata']['problem_areas_count']}, Excerpts={final_result['metadata']['excerpts_count']}")

            logger.info("Multi-step analysis completed.")
            return final_result
                
        except Exception as e:
            logger.error(f"Critical error in multi-step analysis pipeline: {str(e)}")
            logger.error(traceback.format_exc())
            final_result["synthesis"] = f"Analysis pipeline failed critically: {str(e)}"
            return final_result

    # _create_prompt is removed as prompts are formatted per step

    # _parse_response, _fix_response_structure, _manual_validation_fallback are removed.
    # Replaced by _extract_and_parse_json helper and per-step validation/handling.

