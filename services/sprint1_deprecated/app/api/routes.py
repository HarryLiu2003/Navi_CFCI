from fastapi import APIRouter, UploadFile, File
from ..services.keywords import KeywordExtractor
from ..services.preprocess import Preprocessor
from ..services.summarize import TranscriptSummarizer
from ..utils.api_responses import APIResponse, APIError
import logging
from fastapi import HTTPException

router = APIRouter()
logger = logging.getLogger(__name__)

# Initialize service instances
keyword_extractor = KeywordExtractor()
preprocessor = Preprocessor()
summarizer = TranscriptSummarizer()

@router.post("/preprocess",
    summary="Preprocess Transcript",
    description="Preprocess interview transcript and return structured chunks.",
    tags=["preprocessing"],
    responses={
        200: {
            "description": "Successfully preprocessed transcript",
            "content": {
                "application/json": {
                    "example": {
                        "status": "success",
                        "message": "Preprocessing completed successfully",
                        "data": {
                            "text": "Sample cleaned transcript text...",
                            "chunks": [
                                {
                                    "chunk_number": 1,
                                    "speaker": "Interviewer",
                                    "text": "Can you tell me about your experience with our product?"
                                },
                                {
                                    "chunk_number": 2,
                                    "speaker": "Participant",
                                    "text": "I've been using it for about six months now and overall it's been positive."
                                }
                            ],
                            "total_chunks": 50
                        }
                    }
                }
            }
        },
        400: {
            "description": "Bad Request",
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
                        "message": "Preprocessing failed: [error details]"
                    }
                }
            }
        }
    })
async def preprocess_transcript(file: UploadFile = File(..., description="VTT file to preprocess")):
    """
    Preprocess a VTT format interview transcript.
    Splits the transcript into chunks with speaker identification.
    """
    try:
        logger.info(f"Received file for preprocessing: {file.filename}")
        
        # Validate file format
        if not file.filename.endswith('.vtt'):
            logger.warning(f"Invalid file format: {file.filename}")
            message = "Invalid file format. Only .vtt files are accepted"
            raise APIError(
                message=message,
                status_code=400,
                detail=message
            )
        
        # Process the transcript
        transcript_data = await preprocessor.preprocess_vtt(file)
        logger.debug(f"Processed transcript data: {len(transcript_data['chunks'])} chunks")
        
        # Clean text for each chunk
        clean_text = preprocessor.clean_transcript(" ".join(chunk["text"] for chunk in transcript_data["chunks"]))
        
        # Create text chunks for analysis
        text_chunks = preprocessor.chunk_text(clean_text)
        
        return APIResponse.success({
            "text": clean_text,
            "chunks": text_chunks,
            "total_chunks": len(text_chunks)
        })
        
    except Exception as e:
        logger.error(f"Error preprocessing transcript: {str(e)}", exc_info=True)
        if isinstance(e, APIError):
            raise e
        raise APIError(
            message=f"Preprocessing failed: {str(e)}",
            detail=f"Preprocessing failed: {str(e)}"
        )

@router.post("/summarize",
    summary="Summarize Transcript",
    description="Generate a concise summary of the interview transcript.",
    tags=["summarization"],
    responses={
        200: {
            "description": "Successfully summarized transcript",
            "content": {
                "application/json": {
                    "example": {
                        "status": "success",
                        "message": "Summarization completed successfully",
                        "data": {
                            "summary": "The participant discussed challenges with the current mobile app, highlighting performance issues and user experience concerns. They suggested several improvements including streamlined navigation and faster load times.",
                            "metadata": {
                                "model_used": "gpt-3.5-turbo",
                                "transcript_length": 5000
                            }
                        }
                    }
                }
            }
        },
        400: {
            "description": "Bad Request",
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
                        "message": "Summarization failed: [error details]"
                    }
                }
            }
        }
    })
async def summarize_transcript(file: UploadFile = File(..., description="VTT file to summarize")):
    """
    Generate a summary of a VTT format interview transcript.
    Returns a concise summary highlighting key points.
    """
    try:
        logger.info(f"Received file for summarization: {file.filename}")
        
        # Validate file format
        if not file.filename.endswith('.vtt'):
            logger.warning(f"Invalid file format: {file.filename}")
            raise APIError(
                "Invalid file format. Only .vtt files are accepted",
                status_code=400
            )
        
        # Process the transcript to get chunks
        transcript_data = await preprocessor.preprocess_vtt(file)
        
        # Extract text for summarization
        transcript_text = " ".join(chunk["text"] for chunk in transcript_data["chunks"])
        
        if not transcript_text.strip():
            logger.warning("Empty transcript after processing")
            raise APIError(
                "No valid text content found in VTT file",
                status_code=400
            )
        
        # Generate summary
        try:
            summary_result = await summarizer.generate_summary(transcript_text)
            
            return APIResponse.success({
                "summary": summary_result["summary"],
                "metadata": {
                    "model_used": summary_result["model_used"],
                    "transcript_length": len(transcript_text)
                }
            })
        except ValueError as e:
            raise APIError(f"Summary generation failed: {str(e)}")
        
    except Exception as e:
        logger.error(f"Error summarizing transcript: {str(e)}", exc_info=True)
        if isinstance(e, APIError):
            raise e
        raise APIError(f"Summarization failed: {str(e)}")

@router.post("/keywords",
    summary="Extract Keywords",
    description="Extract key points, themes, and insights from the interview transcript.",
    tags=["keyword_extraction"],
    responses={
        200: {
            "description": "Successfully extracted keywords",
            "content": {
                "application/json": {
                    "example": {
                        "status": "success",
                        "message": "Keywords extracted successfully",
                        "data": {
                            "analysis": {
                                "pain_points": [
                                    "App crashes frequently during checkout",
                                    "Slow loading times on product pages",
                                    "Confusing navigation menu"
                                ],
                                "demands": [
                                    "Faster load times",
                                    "More intuitive interface",
                                    "Better error handling"
                                ],
                                "themes": [
                                    "Performance issues",
                                    "User experience",
                                    "Technical reliability"
                                ]
                            },
                            "metadata": {
                                "transcript_length": 5000,
                                "pain_points_count": 3,
                                "demands_count": 3,
                                "themes_count": 3
                            }
                        }
                    }
                }
            }
        },
        400: {
            "description": "Bad Request",
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
                        "message": "Keyword extraction failed: [error details]"
                    }
                }
            }
        }
    })
async def extract_keywords(file: UploadFile = File(..., description="VTT file to analyze")):
    """
    Extract keywords and insights from a VTT format interview transcript.
    Returns categorized keywords including pain points, demands, and themes.
    """
    try:
        logger.info(f"Received file for keyword extraction: {file.filename}")
        
        # Validate file format
        if not file.filename.endswith('.vtt'):
            logger.warning(f"Invalid file format: {file.filename}")
            raise APIError(
                "Invalid file format. Only .vtt files are accepted",
                status_code=400
            )
        
        # Process the transcript to get chunks
        transcript_data = await preprocessor.preprocess_vtt(file)
        
        # Extract text for analysis
        transcript_text = " ".join(chunk["text"] for chunk in transcript_data["chunks"])
        
        if not transcript_text.strip():
            logger.warning("Empty transcript after processing")
            raise APIError(
                "No valid text content found in VTT file",
                status_code=400
            )
        
        # Extract keywords
        try:
            analysis_result = await keyword_extractor.extract_keywords(transcript_text)
            
            logger.info("Successfully extracted keywords and insights")
            
            return APIResponse.success({
                "analysis": {
                    "pain_points": analysis_result["pain_points"],
                    "demands": analysis_result["demands"],
                    "themes": analysis_result["themes"]
                },
                "metadata": {
                    "transcript_length": len(transcript_text),
                    "pain_points_count": len(analysis_result["pain_points"]),
                    "demands_count": len(analysis_result["demands"]),
                    "themes_count": len(analysis_result["themes"])
                }
            })
        except ValueError as e:
            raise APIError(f"Keyword extraction failed: {str(e)}")
        
    except Exception as e:
        logger.error(f"Error extracting keywords: {str(e)}", exc_info=True)
        if isinstance(e, APIError):
            raise e
        raise APIError(f"Keyword extraction failed: {str(e)}") 