from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.output_parsers import JsonOutputParser
from .prompts import PROBLEM_PROMPT, EXCERPT_PROMPT, SYNTHESIS_PROMPT
from .models import ProblemArea, Excerpt, AnalysisSynthesis
import logging
import json
from typing import Dict, Any
import langchain_core.exceptions

logger = logging.getLogger(__name__)

class SynthesisChain:
    def __init__(self, api_key: str):
        """Initialize the synthesis chain with required components."""
        # Validate API key
        if not api_key:
            logger.error("Gemini API key is missing")
            raise ValueError("Missing API key for Gemini. Set the GEMINI_API_KEY environment variable.")
            
        try:
            self.llm = ChatGoogleGenerativeAI(
                model="gemini-2.0-flash",
                google_api_key=api_key,
                temperature=0.7
            )
            logger.info("Successfully initialized Gemini LLM")
        except Exception as e:
            logger.error(f"Failed to initialize Gemini LLM: {str(e)}")
            raise ValueError(f"Error initializing Gemini API client: {str(e)}")
        
        # Initialize output parsers
        self.problem_parser = JsonOutputParser(pydantic_object=Dict[str, list[ProblemArea]])
        self.excerpt_parser = JsonOutputParser(pydantic_object=Dict[str, list[Excerpt]])
        self.synthesis_parser = JsonOutputParser(pydantic_object=AnalysisSynthesis)
        
        # Create individual chains
        self.problem_chain = PROBLEM_PROMPT | self.llm | self.problem_parser
        self.excerpt_chain = EXCERPT_PROMPT | self.llm | self.excerpt_parser
        self.synthesis_chain = SYNTHESIS_PROMPT | self.llm | self.synthesis_parser

    async def extract_problem_areas(self, transcript: str) -> Dict[str, list[ProblemArea]]:
        """Extract main problem areas from the transcript."""
        try:
            result = await self.problem_chain.ainvoke({"transcript": transcript})
            return result
        except Exception as e:
            logger.error(f"Error extracting problem areas: {str(e)}", exc_info=True)
            raise ValueError(f"Problem area extraction failed: {str(e)}")

    async def extract_excerpts(self, transcript_data: Dict[str, Any], problem_areas: Dict[str, list[ProblemArea]]) -> Dict[str, list[Excerpt]]:
        """Extract supporting excerpts for each problem area."""
        try:
            # Check if transcript_data is a string (formatted transcript) or a dictionary of chunks
            if isinstance(transcript_data, str):
                # Create a simple dictionary with chunks from the formatted transcript
                lines = transcript_data.strip().split("\n")
                chunks = []
                for i, line in enumerate(lines):
                    chunks.append(f"Chunk {i+1}: {line}")
                
                transcript_dict = {
                    "chunks": chunks,
                    "max_chunk_number": len(chunks)
                }
            else:
                transcript_dict = transcript_data
            
            # Handle different key naming conventions that might be used
            max_chunk = transcript_dict.get("max_chunk")
            if max_chunk is None and "max_chunk_number" not in transcript_dict:
                # If neither key exists, try to calculate it
                chunks = transcript_dict.get("chunks", [])
                max_chunk = len(chunks) if chunks else 0
                
            # Use the appropriate key for max_chunk_number
            max_chunk_number = transcript_dict.get("max_chunk_number", max_chunk)
            
            # Get the chunks data
            chunks = transcript_dict.get("chunks", [])
            
            result = await self.excerpt_chain.ainvoke({
                "transcript": chunks,
                "max_chunk_number": max_chunk_number,
                "problem_areas": json.dumps(problem_areas)
            })
            return result
        except Exception as e:
            logger.error(f"Error extracting excerpts: {str(e)}", exc_info=True)
            raise ValueError(f"Excerpt extraction failed: {str(e)}")

    async def generate_synthesis(self, analyzed_content: Dict[str, Any]) -> Dict[str, str]:
        """Generate final synthesis from analyzed content."""
        try:
            result = await self.synthesis_chain.ainvoke({
                "analyzed_content": json.dumps(analyzed_content)
            })
            return result
        except Exception as e:
            logger.error(f"Error generating synthesis: {str(e)}", exc_info=True)
            raise ValueError(f"Synthesis generation failed: {str(e)}")

    async def run_analysis(self, transcript: str) -> Dict[str, Any]:
        """Run the complete analysis pipeline."""
        try:
            # Step 1: Extract problem areas
            problem_areas = await self.extract_problem_areas(transcript)
            
            # Step 2: Extract supporting excerpts and merge with problem areas
            excerpts_result = await self.extract_excerpts(transcript, problem_areas)
            
            # Merge excerpts into problem areas
            for area in problem_areas["problem_areas"]:
                matching_area = next(
                    (pa for pa in excerpts_result["problem_areas"] 
                     if pa["problem_id"] == area["problem_id"]), 
                    None
                )
                if matching_area:
                    area["excerpts"] = matching_area["excerpts"]
                else:
                    area["excerpts"] = []
            
            # Step 3: Generate final synthesis
            synthesis = await self.generate_synthesis(problem_areas)
            
            # Prepare metadata
            metadata = {
                "transcript_length": len(transcript),
                "problem_areas_count": len(problem_areas["problem_areas"]),
                "excerpts_total_count": sum(len(area.get("excerpts", [])) for area in problem_areas["problem_areas"])
            }
            
            # Return complete analysis results
            return {
                "problem_areas": problem_areas["problem_areas"],
                "synthesis": synthesis["synthesis"],
                "metadata": metadata
            }
            
        except Exception as e:
            logger.error(f"Error in analysis pipeline: {str(e)}", exc_info=True)
            raise ValueError(f"Analysis pipeline failed: {str(e)}")

def create_analysis_chain():
    """Create a SynthesisChain instance with the API key from environment."""
    import os
    from ...config.api_config import APIConfig
    
    api_key = APIConfig.GEMINI_API_KEY
    
    # Double-check API key is available
    if not api_key:
        logger.error("Gemini API key is missing. Check your .env file and environment variables.")
        raise ValueError("Missing GEMINI_API_KEY. This is required for the analysis service to function.")
        
    logger.info("Creating Analysis Chain with Gemini")
    return SynthesisChain(api_key=api_key) 