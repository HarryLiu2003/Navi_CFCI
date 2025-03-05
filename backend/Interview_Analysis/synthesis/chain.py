from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.chains import SequentialChain
from langchain.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from .prompts import PROBLEM_PROMPT, EXCERPT_PROMPT, SYNTHESIS_PROMPT
from .models import ProblemArea, Excerpt, AnalysisSynthesis
import logging
import json
from typing import Dict, Any

logger = logging.getLogger(__name__)

class SynthesisChain:
    def __init__(self, api_key: str):
        """Initialize the synthesis chain with required components."""
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            google_api_key=api_key,
            temperature=0.7
        )
        
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
            logger.debug("Starting problem area extraction")
            result = await self.problem_chain.ainvoke({"transcript": transcript})
            logger.debug(f"Problem areas extracted: {json.dumps(result, indent=2)}")
            return result
        except Exception as e:
            logger.error(f"Error extracting problem areas: {str(e)}", exc_info=True)
            raise ValueError(f"Problem area extraction failed: {str(e)}")

    async def extract_excerpts(self, transcript_data: Dict[str, Any], problem_areas: Dict[str, list[ProblemArea]]) -> Dict[str, list[Excerpt]]:
        """Extract supporting excerpts for each problem area."""
        try:
            logger.debug("Starting excerpt extraction")
            result = await self.excerpt_chain.ainvoke({
                "transcript": transcript_data["chunks"],
                "max_chunk_number": transcript_data["max_chunk"],
                "problem_areas": json.dumps(problem_areas)
            })
            logger.debug(f"Excerpts extracted: {json.dumps(result, indent=2)}")
            return result
        except Exception as e:
            logger.error(f"Error extracting excerpts: {str(e)}", exc_info=True)
            raise ValueError(f"Excerpt extraction failed: {str(e)}")

    async def generate_synthesis(self, analyzed_content: Dict[str, Any]) -> AnalysisSynthesis:
        """Generate final synthesis from analyzed content."""
        try:
            logger.debug("Starting synthesis generation")
            result = await self.synthesis_chain.ainvoke({
                "analyzed_content": json.dumps(analyzed_content)
            })
            logger.debug(f"Synthesis generated: {json.dumps(result, indent=2)}")
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