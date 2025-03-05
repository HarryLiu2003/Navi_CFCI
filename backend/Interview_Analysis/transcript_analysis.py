from fastapi import APIRouter, UploadFile, File
import logging
import os
from dotenv import load_dotenv
from utils.api_responses import APIResponse
from Preprocessing.preprocessing import TranscriptPreprocessor
from .synthesis.chain import SynthesisChain
from langchain_core.output_parsers import JsonOutputParser
from langchain_google_genai import ChatGoogleGenerativeAI

# Load environment variables
load_dotenv()

# Configure logging
logger = logging.getLogger(__name__)

# Initialize components
router = APIRouter()
preprocessor = TranscriptPreprocessor()

# Initialize synthesis chain
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    logger.error("GEMINI_API_KEY not found in environment variables")
    raise ValueError("GEMINI_API_KEY not found in environment variables")

synthesis_chain = SynthesisChain(api_key)

@router.post("/synthesis",
    summary="Synthesize Interview Analysis",
    description="Performs multi-step analysis of interview transcript.",
    tags=["interview_analysis"],
    responses={
        200: {
            "description": "Successfully synthesized interview",
            "content": {
                "application/json": {
                    "example": {
                        "status": "success",
                        "data": {
                            "problem_areas": [
                                {
                                    "problem_id": "example-problem",
                                    "title": "Example Problem Title",
                                    "description": "Problem description here",
                                    "excerpts": [
                                        {
                                            "text": "Quote from transcript",
                                            "categories": ["Pain Point"],
                                            "insight_summary": "Brief insight",
                                            "transcript_reference": "00:01:23"
                                        }
                                    ]
                                }
                            ],
                            "synthesis": {
                                "background": "Interview context",
                                "problem_areas": ["List of problems"],
                                "next_steps": ["Action items"]
                            },
                            "metadata": {
                                "transcript_length": 1000,
                                "problem_areas_count": 3,
                                "excerpts_count": 9
                            }
                        }
                    }
                }
            }
        },
        400: {
            "description": "Invalid file format",
            "content": {
                "application/json": {
                    "example": {
                        "status": "error",
                        "message": "Invalid file format. Only .vtt files are accepted"
                    }
                }
            }
        },
        500: {
            "description": "Internal Server Error",
            "content": {
                "application/json": {
                    "example": {
                        "status": "error",
                        "message": "Analysis failed: [error details]"
                    }
                }
            }
        }
    }
)
async def synthesize_interview(file: UploadFile = File(..., description="VTT file to analyze")):
    """
    Analyze and synthesize insights from a VTT format interview transcript.
    Performs problem area identification, excerpt extraction, and final synthesis.
    """
    try:
        logger.info(f"Received file: {file.filename}")
        
        # Validate file format
        if not file.filename.endswith('.vtt'):
            logger.warning(f"Invalid file format: {file.filename}")
            raise APIResponse.error(
                "Invalid file format. Only .vtt files are accepted",
                status_code=400
            )
        
        # Preprocess the transcript
        transcript_data = await preprocessor.read_vtt_file(file)
        logger.debug(f"Preprocessed transcript data: {len(transcript_data['chunks'])} chunks")
        
        # Convert chunks to text for problem area extraction
        transcript_text = " ".join(chunk["text"] for chunk in transcript_data["chunks"])
        
        if not transcript_text.strip():
            logger.warning("Empty transcript after preprocessing")
            raise APIResponse.error(
                "No valid text content found in VTT file",
                status_code=400
            )
        
        # Run the synthesis pipeline
        logger.info("Starting synthesis pipeline")
        
        # Extract problem areas using plain text
        problem_areas = await synthesis_chain.extract_problem_areas(transcript_text)
        
        # Extract excerpts using structured data
        excerpts_result = await synthesis_chain.extract_excerpts(transcript_data, problem_areas)
        
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
        
        # Generate final synthesis
        synthesis = await synthesis_chain.generate_synthesis(problem_areas)
        
        # Prepare metadata
        metadata = {
            "transcript_length": len(transcript_text),
            "problem_areas_count": len(problem_areas["problem_areas"]),
            "excerpts_total_count": sum(len(area.get("excerpts", [])) for area in problem_areas["problem_areas"]),
            "total_chunks": len(transcript_data["chunks"])
        }
        
        result = {
            "problem_areas": problem_areas["problem_areas"],
            "synthesis": synthesis["synthesis"],
            "metadata": metadata
        }
        
        # Validate result structure
        if not isinstance(result, dict) or not all(k in result for k in ["problem_areas", "synthesis", "metadata"]):
            logger.error("Invalid synthesis result structure")
            raise APIResponse.error("Invalid analysis result format", status_code=500)
            
        logger.info("Synthesis pipeline completed successfully")
        return APIResponse.success(result)
        
    except Exception as e:
        logger.error(f"Error processing transcript: {str(e)}", exc_info=True)
        if isinstance(e, ValueError):
            raise APIResponse.error(str(e), status_code=400)
        if isinstance(e, JsonOutputParser.ParserError):
            raise APIResponse.error("Failed to parse LLM response", status_code=422)
        if isinstance(e, ChatGoogleGenerativeAI.APIError):
            raise APIResponse.error("LLM service error", status_code=503)
        raise APIResponse.error(f"Analysis failed: {str(e)}") 