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
        metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Process an interview from file content to stored analysis.
        
        Args:
            file_content: Raw bytes of the transcript file
            metadata: Additional metadata about the interview
            
        Returns:
            Complete analysis result with storage information
        """
        logger.info("Starting interview analysis workflow")
        
        # Step 1: Analyze the transcript
        analysis_result = await self.analyzer.analyze_transcript(file_content)
        
        # Step 2: Store the results
        try:
            storage_metadata = {
                "project_id": metadata.get("project_id"),
                "interviewer": metadata.get("interviewer"),
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
                # Log the storage error but continue
                logger.error(f"Failed to store interview: {str(storage_error)}", exc_info=True)
                
                # Add error information to storage field
                analysis_result["storage"] = {
                    "error": f"Failed to store interview: {str(storage_error)}",
                    "status": "error"
                }
                
                # Add a note about the fallback behavior
                if "notes" not in analysis_result:
                    analysis_result["notes"] = []
                    
                analysis_result["notes"].append(
                    "Note: This analysis was completed successfully, but could not be stored in the database. " +
                    "You can still view the results, but they will not be saved for future reference."
                )
            
        except Exception as e:
            # Handle any other errors in the storage process
            logger.error(f"Unexpected error in storage process: {str(e)}", exc_info=True)
            analysis_result["storage"] = {
                "error": f"Unexpected error: {str(e)}",
                "status": "error"
            }
        
        return analysis_result 