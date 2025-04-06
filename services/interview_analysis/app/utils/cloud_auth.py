"""
Utility for Cloud Run service-to-service authentication.
"""
import os
import logging
import httpx
import google.auth
import google.auth.transport.requests
from google.oauth2 import id_token
from typing import Dict, Any, Optional

# Set up logging
logger = logging.getLogger(__name__)

async def call_authenticated_service(
    service_url: str, 
    method: str = "GET", 
    json_data: Optional[Dict[str, Any]] = None,
    files: Optional[Dict] = None,
    data: Optional[Dict] = None,
    params: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Call another Cloud Run service with Google Cloud IAM authentication.
    
    In production, uses Google's metadata server to get an OIDC token.
    In development, makes direct calls without authentication.
    
    Args:
        service_url: URL of the service to call
        method: HTTP method (GET, POST, etc.)
        json_data: JSON data to send (for POST/PUT requests)
        files: Files to upload (for POST requests)
        data: Form data to send (for POST requests with files)
        params: Query parameters
        
    Returns:
        The JSON response from the service
        
    Raises:
        Exception: If the service call fails
    """
    # Check if we're running in Cloud Run (production) or locally (development)
    # K_SERVICE environment variable is automatically set in Cloud Run
    is_production = os.environ.get("K_SERVICE") is not None
    
    if is_production:
        logger.info(f"Making authenticated call to {service_url} (production mode)")
        try:
            # Extract target audience (only the host part of the URL)
            url_parts = service_url.split("/")
            if len(url_parts) >= 3:
                target_audience = f"{url_parts[0]}//{url_parts[2]}"
                logger.debug(f"Target audience for authentication: {target_audience}")
            else:
                target_audience = service_url
                logger.warning(f"Unusual service URL format: {service_url}")
            
            # Use Google's auth library to fetch ID token
            auth_req = google.auth.transport.requests.Request()
            try:
                token = id_token.fetch_id_token(auth_req, target_audience)
                logger.info(f"Successfully obtained ID token for {target_audience}")
            except Exception as e:
                logger.error(f"Error fetching ID token: {str(e)}")
                # Fallback to unauthenticated call if token fetching fails in production
                logger.warning("Falling back to unauthenticated call in production due to token fetch error")
                token = None
            
            # Add token to headers if available
            headers = {}
            if token:
                headers["Authorization"] = f"Bearer {token}"
                logger.debug(f"Created authentication token for {target_audience}")
            
            # Make authenticated request
            timeout = 60.0  # Increase timeout for production environments
            async with httpx.AsyncClient(timeout=timeout) as client:
                if method.upper() == "GET":
                    logger.debug(f"Making GET request to {service_url}")
                    response = await client.get(service_url, headers=headers, params=params)
                elif method.upper() == "POST":
                    logger.debug(f"Making POST request to {service_url}")
                    if files:
                        response = await client.post(service_url, headers=headers, files=files, data=data, params=params)
                    else:
                        logger.debug(f"POST with JSON data: {json_data}")
                        response = await client.post(service_url, headers=headers, json=json_data, params=params)
                elif method.upper() == "PUT":
                    response = await client.put(service_url, headers=headers, json=json_data, params=params)
                elif method.upper() == "DELETE":
                    response = await client.delete(service_url, headers=headers, params=params)
                else:
                    raise ValueError(f"Unsupported HTTP method: {method}")
            
            # Check for successful response before handling JSON
            if response.status_code >= 400:
                error_text = response.text
                logger.error(f"Error response from service ({response.status_code}): {error_text}")
                # Return a properly formatted error response
                return {
                    "status": "error",
                    "message": f"Service returned {response.status_code}: {error_text}"
                }
            
            # Handle JSON response data
            try:
                response_data = response.json()
                logger.info(f"Successfully received JSON response from {service_url}")
                return response_data
            except Exception as json_error:
                logger.error(f"Error parsing JSON response: {str(json_error)}")
                # Return an error response when JSON parsing fails
                return {
                    "status": "error",
                    "message": f"Failed to parse JSON response: {str(json_error)}",
                    "raw_response": response.text
                }
                
        except httpx.TimeoutException as timeout_error:
            logger.error(f"Timeout error calling {service_url}: {str(timeout_error)}")
            return {
                "status": "error",
                "message": f"Request timed out: {str(timeout_error)}"
            }
        except httpx.TransportError as transport_error:
            logger.error(f"Transport error calling {service_url}: {str(transport_error)}")
            return {
                "status": "error",
                "message": f"Connection error: {str(transport_error)}"
            }
        except Exception as e:
            logger.error(f"Error making authenticated call to {service_url}: {str(e)}", exc_info=True)
            return {
                "status": "error",
                "message": f"Error calling service: {str(e)}"
            }
    else:
        logger.info(f"Making direct call to {service_url} (development mode)")
        # In development, make direct calls without authentication
        try:
            # Add debug logs for development mode
            if method.upper() == "POST" and json_data:
                logger.debug(f"Development mode POST with JSON: {json_data}")
            
            timeout = 30.0  # Default timeout for development
            async with httpx.AsyncClient(timeout=timeout) as client:
                if method.upper() == "GET":
                    logger.debug(f"Making GET request to {service_url}")
                    response = await client.get(service_url, params=params)
                elif method.upper() == "POST":
                    if files:
                        logger.debug(f"Making POST request with files to {service_url}")
                        response = await client.post(service_url, files=files, data=data, params=params)
                    else:
                        logger.debug(f"Making POST request with JSON to {service_url}")
                        response = await client.post(service_url, json=json_data, params=params)
                elif method.upper() == "PUT":
                    response = await client.put(service_url, json=json_data, params=params)
                elif method.upper() == "DELETE":
                    response = await client.delete(service_url, params=params)
                else:
                    raise ValueError(f"Unsupported HTTP method: {method}")
            
            # Check response
            if response.status_code >= 400:
                error_text = response.text
                logger.error(f"Error response from service ({response.status_code}): {error_text}")
                # Return a properly formatted error response
                return {
                    "status": "error",
                    "message": f"Service returned {response.status_code}: {error_text}"
                }
            
            try:
                response_data = response.json()
                logger.info(f"Successfully received JSON response from {service_url}")
                return response_data
            except Exception as json_error:
                logger.error(f"Error parsing JSON response: {str(json_error)}")
                # Return an error response when JSON parsing fails
                return {
                    "status": "error",
                    "message": f"Failed to parse JSON response: {str(json_error)}",
                    "raw_response": response.text
                }
                
        except httpx.TimeoutException as timeout_error:
            logger.error(f"Timeout error calling {service_url}: {str(timeout_error)}")
            return {
                "status": "error",
                "message": f"Request timed out: {str(timeout_error)}"
            }
        except httpx.TransportError as transport_error:
            logger.error(f"Transport error calling {service_url}: {str(transport_error)}")
            return {
                "status": "error",
                "message": f"Connection error: {str(transport_error)}"
            }
        except Exception as e:
            logger.error(f"Error making call to {service_url}: {str(e)}", exc_info=True)
            return {
                "status": "error",
                "message": f"Error calling service: {str(e)}"
            } 