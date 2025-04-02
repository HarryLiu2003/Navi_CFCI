from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from typing import Dict, Any, Optional
import logging

from ..domain.workflows import InterviewWorkflow
from ..utils.api_responses import APIResponse
from ..utils.errors import InterviewAnalysisError, FileProcessingError, AnalysisError, StorageError
from .dependencies import get_interview_workflow

# Set up logging
logger = logging.getLogger(__name__)

# Create router
router = APIRouter()


@router.post("/analyze",
            summary="Analyze an interview transcript",
            description="Upload a VTT file to analyze an interview transcript and extract key insights.",
            response_model_exclude_none=True,
            response_model=Dict[str, Any])
async def analyze_interview(
    file: UploadFile = File(..., description="VTT file containing the interview transcript"),
    project_id: Optional[str] = Form(None, description="Project ID to associate with the interview"),
    interviewer: Optional[str] = Form(None, description="Name of the interviewer"),
    interview_date: Optional[str] = Form(None, description="Date of the interview (ISO format)"),
    workflow: InterviewWorkflow = Depends(get_interview_workflow)
):
    """
    Process an interview transcript to extract key insights.
    
    - Analyzes the transcript to identify main problem areas
    - Extracts relevant excerpts supporting each problem area
    - Generates a comprehensive analysis of the findings
    - Stores the results in the database
    
    The VTT file should contain timestamped interview segments with speakers identified.
    
    Args:
        file: VTT file containing the interview transcript
        project_id: Optional project ID to associate with the interview
        interviewer: Optional name of the interviewer
        interview_date: Optional date of the interview
        workflow: Interview workflow service injected via dependency
    
    Returns:
        Dict: JSON response with the following structure:
            - status: "success" or "error"
            - message: Success/error message
            - data: When successful, contains the complete analysis result with:
                - problem_areas: List of identified problems
                - transcript: List of transcript chunks
                - synthesis: Summary of findings
                - metadata: Analysis metadata
                - storage: Storage information
    """
    try:
        # Check if the file is a VTT file
        if not file.filename.endswith('.vtt'):
            logger.warning(f"Invalid file format: {file.filename}")
            raise FileProcessingError("Invalid file format. Only .vtt files are accepted")
        
        # Read the file content
        content = await file.read()
        if not content:
            logger.warning("Empty file uploaded")
            raise FileProcessingError("Empty file provided")
        
        # Get file info for logging
        file_info = {
            "filename": file.filename,
            "content_type": file.content_type,
            "size": len(content)
        }
        logger.info(f"Processing file: {file_info}")
        
        # Create metadata for storage
        metadata = {
            "project_id": project_id,
            "interviewer": interviewer,
            "interview_date": interview_date,
            "title": f"Interview - {file.filename}"
        }
        
        # Process the interview through the workflow
        analysis_result = await workflow.process_interview(content, metadata)
        
        return APIResponse.success(
            message="Interview analysis completed successfully",
            data=analysis_result
        )
    
    except FileProcessingError as e:
        logger.warning(f"File processing error: {str(e)}")
        return APIResponse.error(
            message=str(e),
            status_code=400
        )
    
    except (AnalysisError, StorageError) as e:
        logger.error(f"Interview analysis error: {str(e)}")
        return APIResponse.error(
            message=str(e),
            status_code=e.status_code
        )
        
    except Exception as e:
        logger.error(f"Error processing interview: {str(e)}", exc_info=True)
        return APIResponse.error(
            message=f"Analysis failed: {str(e)}",
            detail={"exception_type": type(e).__name__}
        ) 