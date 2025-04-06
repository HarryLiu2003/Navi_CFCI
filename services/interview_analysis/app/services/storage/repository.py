"""
Data access layer for interview storage.
"""
import logging
import os
import httpx
from typing import Dict, Any, Optional
from ...utils.errors import StorageError
from ...utils.cloud_auth import call_authenticated_service

# Set up logging
logger = logging.getLogger(__name__)


class InterviewRepository:
    """
    Repository for storing interview analysis data via the database service.
    """
    
    def __init__(self):
        """Initialize the repository with database service URL."""
        self.api_url = os.environ.get("DATABASE_API_URL", "http://localhost:5001")
        logger.info(f"Initialized InterviewRepository with database API at: {self.api_url}")
    
    async def store_interview(
        self, 
        analysis_result: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Store interview analysis result via the database service.
        
        Args:
            analysis_result: The analysis result from the interview
            metadata: Additional metadata about the interview (optional)
            
        Returns:
            The stored interview data with ID
            
        Raises:
            StorageError: If there's an error storing the interview data
        """
        try:
            # Prepare data for storage
            interview_data = {
                "title": self._extract_title(analysis_result, metadata),
                "problem_count": len(analysis_result.get("problem_areas", [])),
                "transcript_length": analysis_result.get("metadata", {}).get("transcript_length", 0),
                "analysis_data": analysis_result,
            }
            
            # Add optional metadata if provided
            if metadata:
                if "project_id" in metadata and metadata["project_id"]:
                    interview_data["project_id"] = metadata["project_id"]
                if "interviewer" in metadata and metadata["interviewer"]:
                    interview_data["interviewer"] = metadata["interviewer"]
                if "interview_date" in metadata and metadata["interview_date"]:
                    interview_data["interview_date"] = metadata["interview_date"]
                if "userId" in metadata and metadata["userId"]:
                    interview_data["userId"] = metadata["userId"]
            
            logger.info(f"Storing interview with title: {interview_data['title']}")
            logger.debug(f"Interview data: {interview_data}")
            
            # Use authenticated service call (works in both production and development)
            try:
                # Log URL for debugging
                endpoint_url = f"{self.api_url}/interviews"
                logger.info(f"Calling database service at: {endpoint_url}")
                
                # Make the API call
                result = await call_authenticated_service(
                    service_url=endpoint_url, 
                    method="POST", 
                    json_data=interview_data
                )
                
                # Check if the result is an error response from call_authenticated_service
                if isinstance(result, dict) and result.get("status") == "error":
                    error_msg = result.get("message", "Unknown error from service call")
                    logger.error(f"Error from call_authenticated_service: {error_msg}")
                    raise StorageError(f"Service call error: {error_msg}")
                
                # Check if the result is a success response from the database service
                if isinstance(result, dict) and result.get("status") != "success":
                    error_msg = result.get("message", "Unknown error")
                    logger.error(f"Database service returned error: {error_msg}")
                    raise StorageError(f"Failed to store interview: {error_msg}")
                
                # Get the stored interview data
                stored_interview = result.get("data")
                
                if not stored_interview:
                    logger.error("No data returned after interview insertion")
                    logger.error(f"Full response: {result}")
                    raise StorageError("No data returned after interview insertion")
                    
                logger.info(f"Successfully stored interview with ID: {stored_interview.get('id')}")
                return stored_interview
                    
            except StorageError:
                # Re-raise storage errors
                raise
            except Exception as e:
                logger.error(f"Error storing interview: {str(e)}", exc_info=True)
                raise StorageError(f"Failed to store interview: {str(e)}")
                
        except StorageError:
            # Re-raise storage errors
            raise
            
        except Exception as e:
            logger.error(f"Error preparing interview data: {str(e)}", exc_info=True)
            raise StorageError(f"Failed to prepare interview data: {str(e)}")
    
    def _extract_title(self, analysis_result: Dict[str, Any], metadata: Optional[Dict[str, Any]]) -> str:
        """
        Extract a title for the interview from the analysis or metadata.
        
        Args:
            analysis_result: The analysis result
            metadata: Additional metadata
            
        Returns:
            A string title for the interview
        """
        # First try to use title from metadata
        if metadata and metadata.get("title"):
            return metadata["title"]
        
        # Next try to create a title from problem areas
        problem_areas = analysis_result.get("problem_areas", [])
        if problem_areas and len(problem_areas) > 0:
            first_problem_title = problem_areas[0].get("title", "")
            if first_problem_title:
                return f"Interview about {first_problem_title}"
        
        # Finally use a generic title
        return "Untitled Interview" 