"""
Data access layer for interview storage.
"""
import logging
import os
import httpx
from typing import Dict, Any, Optional, List
from ...utils.errors import StorageError, NotFoundError
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
        Now includes transforming problem areas/excerpts for relational storage.
        
        Args:
            analysis_result: The analysis result from the interview
            metadata: Additional metadata about the interview (optional)
            
        Returns:
            The stored interview data with ID (usually just the ID)
            
        Raises:
            StorageError: If there's an error storing the interview data
        """
        try:
            # Prepare BASE interview data (excluding problem areas for nested creation)
            base_interview_data = {
                "title": self._extract_title(analysis_result, metadata),
                "problem_count": len(analysis_result.get("problem_areas", [])),
                "transcript_length": analysis_result.get("metadata", {}).get("transcript_length", 0),
                "analysis_data": analysis_result, # Keep sending the blob for backup
            }
            
            # Add optional metadata if provided
            if metadata:
                if "project_id" in metadata and metadata["project_id"]:
                    base_interview_data["project_id"] = metadata["project_id"]
                # Removed interviewer and interview_date as they aren't on the base Interview model
                # if "interviewer" in metadata and metadata["interviewer"]:
                #     base_interview_data["interviewer"] = metadata["interviewer"]
                # if "interview_date" in metadata and metadata["interview_date"]:
                #     base_interview_data["interview_date"] = metadata["interview_date"]
                if "userId" in metadata and metadata["userId"]:
                    base_interview_data["userId"] = metadata["userId"]

            # Prepare NESTED problem area data (if any)
            problem_areas_payload: List[Dict[str, Any]] = []
            raw_problem_areas = analysis_result.get("problem_areas", [])
            if isinstance(raw_problem_areas, list):
                for pa in raw_problem_areas:
                    if isinstance(pa, dict) and pa.get("problem_id") and pa.get("title") and pa.get("description"):
                        excerpts_payload: List[Dict[str, Any]] = []
                        raw_excerpts = pa.get("excerpts", [])
                        if isinstance(raw_excerpts, list):
                            for ex in raw_excerpts:
                                # Basic validation of excerpt structure
                                if isinstance(ex, dict) and ex.get("quote") and ex.get("categories") and ex.get("insight") and ex.get("chunk_number") is not None:
                                    excerpts_payload.append({
                                        "quote": ex["quote"],
                                        "categories": ex["categories"],
                                        "insight": ex["insight"],
                                        "chunk_number": ex["chunk_number"],
                                    })
                                else:
                                    logger.warning(f"Skipping invalid excerpt structure: {ex}")
                        
                        problem_areas_payload.append({
                            "title": pa["title"],
                            "description": pa["description"],
                            "excerpts": excerpts_payload
                        })
                    else:
                         logger.warning(f"Skipping invalid problem area structure: {pa}")
            else:
                 logger.warning(f"Problem areas field is not a list: {raw_problem_areas}")

            # Combine base data and nested data for the final payload
            final_payload = base_interview_data.copy()
            if problem_areas_payload: # Only add if there are valid problem areas
                final_payload["problemAreasData"] = problem_areas_payload
            
            logger.info(f"Storing interview with title: {final_payload.get('title')}")
            logger.debug(f"Final payload keys: {list(final_payload.keys())}")
            
            # Use authenticated service call (works in both production and development)
            try:
                endpoint_url = f"{self.api_url}/interviews"
                logger.info(f"Calling database service POST {endpoint_url}")
                
                # Make the API call with the combined payload
                result = await call_authenticated_service(
                    service_url=endpoint_url, 
                    method="POST", 
                    json_data=final_payload
                )
                
                # Check if the result is an error response from call_authenticated_service
                if isinstance(result, dict) and result.get("status") == "error":
                    error_msg = result.get("message", "Unknown error from service call")
                    logger.error(f"Error from call_authenticated_service storing interview: {error_msg}")
                    raise StorageError(f"Service call error: {error_msg}")
                
                # Check if the result is a success response from the database service
                if isinstance(result, dict) and result.get("status") != "success":
                    error_msg = result.get("message", "Unknown error storing interview")
                    logger.error(f"Database service returned error on interview creation: {error_msg}")
                    raise StorageError(f"Failed to store interview: {error_msg}")
                
                # Get the stored interview data (likely just the ID now)
                stored_interview_info = result.get("data")
                
                if not stored_interview_info or not stored_interview_info.get('id'):
                    logger.error("No data or ID returned after interview insertion")
                    logger.error(f"Full response: {result}")
                    raise StorageError("No ID returned after interview insertion")
                    
                logger.info(f"Successfully initiated storage for interview ID: {stored_interview_info.get('id')}")
                # Return the essential info (like ID) received from the DB service
                return stored_interview_info
                    
            except StorageError:
                raise # Re-raise storage errors
            except Exception as e:
                logger.error(f"Error during authenticated call to store interview: {str(e)}", exc_info=True)
                raise StorageError(f"Failed to call database service: {str(e)}")
                
        except Exception as e:
            logger.error(f"Error preparing interview data for storage: {str(e)}", exc_info=True)
            raise StorageError(f"Failed to prepare interview data: {str(e)}")
    
    async def get_interview_by_id(self, interview_id: str) -> Dict[str, Any]:
        """
        Fetch a single interview by its ID from the database service.

        Args:
            interview_id: The ID of the interview to fetch.

        Returns:
            The interview data as a dictionary.

        Raises:
            NotFoundError: If the interview is not found.
            StorageError: If there's any other error during fetching.
        """
        endpoint_url = f"{self.api_url}/interviews/{interview_id}"
        logger.info(f"Fetching interview {interview_id} from: {endpoint_url}")
        
        try:
            result = await call_authenticated_service(
                service_url=endpoint_url, 
                method="GET"
            )

            if isinstance(result, dict) and result.get("status") == "error":
                error_msg = result.get("message", "Unknown error fetching interview")
                status_code = result.get("status_code", 500) 
                logger.error(f"Error from service call fetching interview {interview_id}: {error_msg} (Status: {status_code})")
                if status_code == 404:
                     raise NotFoundError(f"Interview with ID {interview_id} not found.")
                raise StorageError(f"Service call error: {error_msg}")

            if isinstance(result, dict) and result.get("status") == "success":
                interview_data = result.get("data")
                if not interview_data:
                     logger.error(f"No data returned for interview {interview_id}. Full response: {result}")
                     raise StorageError(f"No data returned for interview {interview_id}")
                logger.info(f"Successfully fetched interview {interview_id}")
                return interview_data
            
            # Handle unexpected response structure
            logger.error(f"Unexpected response structure when fetching interview {interview_id}: {result}")
            raise StorageError(f"Unexpected response structure from database service for interview {interview_id}.")

        except NotFoundError:
             raise # Re-raise NotFoundError explicitly
        except StorageError as e:
            raise StorageError(f"Storage layer error fetching interview {interview_id}: {str(e)}") # Re-raise other storage errors
        except Exception as e:
            logger.error(f"Unexpected error fetching interview {interview_id}: {str(e)}", exc_info=True)
            raise StorageError(f"Unexpected error fetching interview {interview_id}: {str(e)}")


    async def get_personas_for_user(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Fetch all personas associated with a specific user ID.

        Args:
            user_id: The ID of the user whose personas to fetch.

        Returns:
            A list of persona data dictionaries.

        Raises:
            StorageError: If there's an error during fetching.
        """
        # Assuming the endpoint structure based on common patterns
        endpoint_url = f"{self.api_url}/personas?userId={user_id}" 
        logger.info(f"Fetching personas for user {user_id} from: {endpoint_url}")
        
        try:
            result = await call_authenticated_service(
                service_url=endpoint_url, 
                method="GET"
            )

            if isinstance(result, dict) and result.get("status") == "error":
                error_msg = result.get("message", "Unknown error fetching personas")
                status_code = result.get("status_code", 500)
                logger.error(f"Error from service call fetching personas for user {user_id}: {error_msg} (Status: {status_code})")
                # Note: Depending on API design, an empty list might be returned instead of 404 for no personas.
                # We assume an error status code indicates a real problem.
                raise StorageError(f"Service call error fetching personas: {error_msg}")

            if isinstance(result, dict) and result.get("status") == "success":
                personas_data = result.get("data")
                if personas_data is None: # Allow empty list, but error if 'data' key is missing
                     logger.error(f"No 'data' field returned when fetching personas for user {user_id}. Full response: {result}")
                     raise StorageError(f"Invalid response structure fetching personas for user {user_id}")
                
                # Ensure data is a list
                if not isinstance(personas_data, list):
                    logger.error(f"Expected list but got {type(personas_data)} when fetching personas for user {user_id}. Data: {personas_data}")
                    raise StorageError(f"Unexpected data type for personas: {type(personas_data)}")

                logger.info(f"Successfully fetched {len(personas_data)} personas for user {user_id}")
                return personas_data
            
            # Handle unexpected response structure
            logger.error(f"Unexpected response structure when fetching personas for user {user_id}: {result}")
            raise StorageError(f"Unexpected response structure from database service for personas.")

        except StorageError as e:
             raise StorageError(f"Storage layer error fetching personas for user {user_id}: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error fetching personas for user {user_id}: {str(e)}", exc_info=True)
            raise StorageError(f"Unexpected error fetching personas for user {user_id}: {str(e)}")

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