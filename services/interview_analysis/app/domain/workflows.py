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
                "title": metadata.get("title", "Untitled Interview")
            }
            
            stored_data = await self.storage.store_interview(analysis_result, storage_metadata)
            
            # Add storage information to result
            analysis_result["storage"] = {
                "id": stored_data.get("id"),
                "created_at": stored_data.get("created_at")
            }
            
            logger.info(f"Interview stored with ID: {stored_data.get('id')}")
            
        except Exception as e:
            # Handle storage failure
            logger.error(f"Failed to store interview: {str(e)}", exc_info=True)
            analysis_result["storage"] = {
                "error": f"Failed to store interview: {str(e)}"
            }
        
        return analysis_result 