"""
Core domain workflows for the interview analysis service.
These workflows orchestrate the business processes independent of implementation details.
"""
import logging
from typing import Dict, Any, Optional, List
from .models import InterviewAnalysis, StorageInfo

logger = logging.getLogger(__name__)


class InterviewWorkflow:
    """
    Orchestrates the interview analysis process from transcript to storage.
    This is a high-level domain workflow that coordinates the business process.
    """
    
    def __init__(self, analyzer_service, storage_service):
        """
        Initialize the workflow with required services.
        
        Args:
            analyzer_service: Service for analyzing transcripts
            storage_service: Service for storing interview data
        """
        self.analyzer = analyzer_service
        self.storage = storage_service
    
    async def process_interview(
        self, 
        file_content: bytes,
        metadata: Dict[str, Any],
        filename: str
    ) -> Dict[str, Any]:
        """
        Process an interview from file content to stored analysis.
        
        Args:
            file_content: Raw bytes of the transcript file
            metadata: Additional metadata about the interview
            filename: Original name of the uploaded file
            
        Returns:
            Complete analysis result with storage information
        """
        logger.info(f"Starting interview analysis workflow for file: {filename}")
        
        # Step 1: Analyze the transcript, passing the filename
        analysis_result = await self.analyzer.analyze_transcript(file_content, filename)
        
        # --- Add Logging --- 
        # Log the raw speaker identification from the LLM result
        raw_speakers = analysis_result.get("speakers", {})
        logger.info(f"LLM identified speakers raw: Interviewer={raw_speakers.get('interviewer')}, Interviewee={raw_speakers.get('interviewee')}")
        # --- End Logging ---
        
        # Step 2: Store the results
        try:
            # Extract participants list from analysis
            # This is now Optional[List[str]]
            participants_list = None
            if "participants" in analysis_result: # Check for the new field
                participants_list = analysis_result.get("participants")
                logger.info(f"LLM identified participants: {participants_list}") # Log the unified list
            else: # Log if the old field is still present (debugging)
                logger.warning("'participants' field missing in LLM result, checking old fields...")
                raw_speakers = analysis_result.get("speakers", {})
                logger.info(f"Old speaker fields: Interviewer={raw_speakers.get('interviewer')}, Interviewee={raw_speakers.get('interviewee')}")
                
            # Convert list to comma-separated string if not None/empty
            participants_string = None
            if participants_list:
                participants_string = ", ".join(participants_list)
            
            # Prepare storage metadata using the new participants string
            storage_metadata = {
                "project_id": metadata.get("project_id"),
                "participants": participants_string, # Use the new combined string (can be None)
                "interview_date": metadata.get("interview_date"),
                "title": metadata.get("title", "Untitled Interview"),
                "userId": metadata.get("userId")
            }
            
            logger.info(f"Attempting to store interview with metadata: {storage_metadata}")
            
            try:
                stored_data = await self.storage.store_interview(analysis_result, storage_metadata)
                
                # Add storage information to result
                analysis_result["storage"] = {
                    "id": stored_data.get("id"),
                    "created_at": stored_data.get("created_at")
                }
                
                logger.info(f"Interview stored with ID: {stored_data.get('id')}")
            except Exception as storage_error:
                # Log the storage error
                logger.error(f"Failed to store interview: {str(storage_error)}", exc_info=True)
                
                # Re-raise a StorageError instead of continuing
                from ..utils.errors import StorageError
                raise StorageError(f"Failed to store interview results: {str(storage_error)}")
            
        except Exception as e:
            # Handle any other errors in the storage process
            logger.error(f"Unexpected error during storage integration: {str(e)}", exc_info=True)
            # Re-raise or handle as appropriate, perhaps wrap in a domain-specific error
            from ..utils.errors import InterviewAnalysisError
            raise InterviewAnalysisError(f"Unexpected error during storage: {str(e)}")
        
        return analysis_result 