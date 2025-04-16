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
        
        # Step 1: Analyze the transcript
        analysis_result = await self.analyzer.analyze_transcript(file_content, filename)
        
        # --- Add Logging --- 
        # Log the raw speaker identification (if still relevant for debugging)
        # raw_speakers = analysis_result.get("speakers", {})
        # logger.info(f"LLM identified speakers raw: Interviewer={raw_speakers.get('interviewer')}, Interviewee={raw_speakers.get('interviewee')}")
        # Log the final participants list (which came from rules)
        participants_list = analysis_result.get("participants", [])
        logger.info(f"Rule-based participants passed to storage: {participants_list}")
        # --- End Logging ---
        
        # Step 2: Store the results
        try:
            # Convert participants list to comma-separated string for storage
            participants_string = None
            if participants_list:
                participants_string = ", ".join(participants_list)
            
            # Determine the title: Use suggested_title if available, otherwise fallback
            suggested_title = analysis_result.get("suggested_title")
            final_title = suggested_title if suggested_title else metadata.get("title", f"Interview - {filename}")
            logger.info(f"Using title for storage: '{final_title}' (Suggested: '{suggested_title}')")

            # Prepare storage metadata using the final title and participants string
            storage_metadata = {
                "project_id": metadata.get("project_id"),
                "participants": participants_string, 
                "interview_date": metadata.get("interview_date"),
                "title": final_title, # Use the determined title
                "userId": metadata.get("userId")
            }
            
            logger.info(f"Attempting to store interview with metadata: {storage_metadata}")
            
            # Store the interview (passing the full analysis result which includes the suggested title)
            stored_data = await self.storage.store_interview(analysis_result, storage_metadata)
                
            # Add storage information to result
            analysis_result["storage"] = {
                "id": stored_data.get("id"),
                "created_at": stored_data.get("created_at")
            }
            
            logger.info(f"Interview stored with ID: {stored_data.get('id')}")

        except Exception as e:
            logger.error(f"Error during storage process: {str(e)}", exc_info=True)
            # Re-raise a StorageError instead of continuing
            from ..utils.errors import StorageError
            raise StorageError(f"Failed to store interview results: {str(e)}")

        # Remove the temporary suggested_title from the final returned result if desired
        # analysis_result.pop("suggested_title", None) 
        
        return analysis_result 