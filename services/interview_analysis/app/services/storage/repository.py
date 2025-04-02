"""
Data access layer for interview storage.
"""
import logging
import os
import httpx
from typing import Dict, Any, Optional
from ...utils.errors import StorageError

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
            
            logger.info(f"Storing interview with title: {interview_data['title']}")
            
            # Send to database service
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(f"{self.api_url}/interviews", json=interview_data)
                response.raise_for_status()
                
                result = response.json()
                if result.get("status") != "success":
                    error_msg = result.get("message", "Unknown error")
                    logger.error(f"Database service returned error: {error_msg}")
                    raise StorageError(f"Failed to store interview: {error_msg}")
                
                stored_interview = result.get("data")
                
                if not stored_interview:
                    logger.error("No data returned after interview insertion")
                    raise StorageError("No data returned after interview insertion")
                    
                logger.info(f"Successfully stored interview with ID: {stored_interview.get('id')}")
                return stored_interview
                
        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error storing interview: {e.response.status_code} - {e.response.text}")
            raise StorageError(f"Failed to store interview: {e.response.status_code} HTTP error")
            
        except httpx.RequestError as e:
            logger.error(f"Request error storing interview: {str(e)}")
            raise StorageError(f"Failed to connect to database service: {str(e)}")
            
        except StorageError:
            # Re-raise storage errors
            raise
            
        except Exception as e:
            logger.error(f"Error storing interview: {str(e)}", exc_info=True)
            raise StorageError(f"Failed to store interview: {str(e)}")
    
    def _extract_title(self, analysis_result: Dict[str, Any], metadata: Optional[Dict[str, Any]]) -> str:
        """
        Extract a title for the interview, using metadata or generating one from analysis.
        
        Args:
            analysis_result: The analysis result
            metadata: Metadata that might contain a title
            
        Returns:
            A title for the interview
        """
        # If metadata contains a title, use it
        if metadata and "title" in metadata and metadata["title"]:
            return metadata["title"]
        
        # Otherwise, try to generate a title from the analysis
        try:
            # If we have problem areas, use the first one's title
            if analysis_result.get("problem_areas") and len(analysis_result["problem_areas"]) > 0:
                first_problem = analysis_result["problem_areas"][0]
                return f"Interview about {first_problem['title']}"
                
            # If we have synthesis, use a substring of it
            if analysis_result.get("synthesis") and isinstance(analysis_result["synthesis"], dict):
                if "background" in analysis_result["synthesis"] and analysis_result["synthesis"]["background"]:
                    background = analysis_result["synthesis"]["background"]
                    # Use the first 50 characters as a title
                    return background[:50] + ("..." if len(background) > 50 else "")
            
            # Fallback to generic title
            return "Interview Analysis"
            
        except Exception as e:
            logger.warning(f"Error generating title from analysis: {str(e)}")
            return "Interview Analysis" 