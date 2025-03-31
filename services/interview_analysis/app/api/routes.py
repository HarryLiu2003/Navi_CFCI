from fastapi import APIRouter, UploadFile, File
from typing import Dict, Any
import logging
from ..services.analyze import TranscriptAnalyzer
from ..utils.api_responses import APIResponse, APIError

# Set up logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter()

@router.post("/analyze",
            summary="Analyze an interview transcript",
            description="Upload a VTT file to analyze an interview transcript and extract key insights.",
            response_model_exclude_none=True,
            response_model=Dict[str, Any],
            responses={
                200: {
                    "description": "Successfully analyzed interview",
                    "content": {
                        "application/json": {
                            "example": {
                                "status": "success",
                                "message": "Interview analysis completed successfully",
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
                                                    "chunk_number": 42
                                                }
                                            ]
                                        }
                                    ],
                                    "synthesis": "The interview revealed several key challenges in the current workflow...",
                                    "metadata": {
                                        "transcript_length": 1000,
                                        "problem_areas_count": 3,
                                        "excerpts_count": 9,
                                        "total_chunks": 50
                                    },
                                    "transcript": [
                                        {
                                            "chunk_number": 42,
                                            "speaker": "Participant",
                                            "text": "Quote from transcript"
                                        }
                                    ]
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
                422: {
                    "description": "Error parsing LLM response",
                    "content": {
                        "application/json": {
                            "example": {
                                "status": "error",
                                "message": "Failed to parse LLM response"
                            }
                        }
                    }
                },
                503: {
                    "description": "LLM service unavailable",
                    "content": {
                        "application/json": {
                            "example": {
                                "status": "error",
                                "message": "LLM service error"
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
            })
async def analyze_interview(
    file: UploadFile = File(..., description="VTT file containing the interview transcript"),
):
    """
    Process an interview transcript to extract key insights.
    
    - Analyzes the transcript to identify main problem areas
    - Extracts relevant excerpts supporting each problem area
    - Generates a comprehensive analysis of the findings
    
    The VTT file should contain timestamped interview segments with speakers identified.
    
    Args:
        file: VTT file containing the interview transcript
    
    Returns:
        Structured analysis of the interview with problem areas and synthesis
    """
    try:
        # Log the received file
        logger.info(f"Received file: {file.filename}")
        
        # Validate file format
        if not file.filename.endswith('.vtt'):
            logger.warning(f"Invalid file format: {file.filename}")
            return APIResponse.error(
                message="Invalid file format. Only .vtt files are accepted",
                detail={"file": file.filename}
            )

        # Initialize analyzer and process transcript
        analyzer = TranscriptAnalyzer()
        analysis_result = await analyzer.analyze_transcript(file)
        
        # Log successful completion
        logger.info("Analysis completed successfully")
        
        # Transform the result format to match frontend expectations if needed
        # Make sure the excerpts structure matches the frontend interface
        problem_areas = analysis_result.get("problem_areas", [])
        for problem_area in problem_areas:
            excerpts = problem_area.get("excerpts", [])
            for excerpt in excerpts:
                # Clean up and standardize excerpt fields
                if "quote" in excerpt:
                    # Move quote to text and remove quote
                    excerpt["text"] = excerpt.pop("quote")
                
                if "insight" in excerpt:
                    # Move insight to insight_summary and remove insight
                    excerpt["insight_summary"] = excerpt.pop("insight")
                
                # Ensure categories is an array
                if "categories" not in excerpt:
                    excerpt["categories"] = ["Pain Point"]  # Default category
            
        # Ensure synthesis structure matches frontend expectations
        synthesis = analysis_result.get("synthesis", "")
        if isinstance(synthesis, str):
            # Keep the synthesis as a string instead of transforming it
            # The frontend can handle both string and structured object formats
            pass
            
        # Update metadata to match frontend expectations
        metadata = analysis_result.get("metadata", {})
        if "excerpts_total_count" in metadata and "excerpts_count" not in metadata:
            metadata["excerpts_count"] = metadata.pop("excerpts_total_count")
            
        return APIResponse.success(
            message="Interview analysis completed successfully",
            data=analysis_result
        )
            
    except APIError as e:
        logger.error(f"Error processing transcript: {e.message}")
        # Make sure we return a properly formatted response
        if hasattr(e, 'detail') and e.detail is not None:
            return e.detail
        else:
            return APIResponse.error(
                message=f"Error processing transcript: {e.message}",
                detail={"source": "api_error"}
            )
    except Exception as e:
        logger.error(f"Unexpected error processing transcript: {str(e)}", exc_info=True)
        # Create a properly formatted error response
        return APIResponse.error(
            message=f"Error processing transcript: {str(e)}",
            detail={"exception_type": type(e).__name__}
        ) 