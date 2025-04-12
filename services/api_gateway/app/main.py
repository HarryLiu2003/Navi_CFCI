from fastapi import FastAPI, UploadFile, File, HTTPException, Request, Form, Depends, Body
from fastapi.middleware.cors import CORSMiddleware
import httpx
import os
import logging
import traceback
import time
import uuid
from typing import Optional, List, Dict, Any
from io import BytesIO
from dotenv import load_dotenv
from pydantic import BaseModel, Field

# Import auth middleware
from .middleware.auth import verify_token, get_optional_user, get_user_id_from_payload

# Add import for Google auth (needed for service-to-service auth)
import google.auth.transport.requests
from google.oauth2 import id_token
from google.auth import credentials
from google.auth.transport import requests as google_requests

# Configure logging with level from environment variable
log_level_name = os.getenv("LOG_LEVEL", "INFO")
log_level = getattr(logging, log_level_name.upper(), logging.INFO)
logging.basicConfig(level=log_level, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)
logger.info(f"Logging configured with level: {log_level_name}")

# Get debug mode from environment
DEBUG = os.getenv("DEBUG", "False").lower() == "true"
logger.info(f"Debug mode: {DEBUG}")

# Environment setup
load_dotenv()

DATABASE_SERVICE_URL = os.getenv("SERVICE_DATABASE")
INTERVIEW_ANALYSIS_URL = os.getenv("SERVICE_INTERVIEW_ANALYSIS", "http://interview_analysis:8001")
SPRINT1_DEPRECATED_URL = os.getenv("SERVICE_SPRINT1_DEPRECATED", "http://sprint1_deprecated:8002")

# Ensure required service URLs are set (except deprecated one)
if not DATABASE_SERVICE_URL:
    # Use default for local dev if env var is not set
    DATABASE_SERVICE_URL = "http://database-service:5001" # Default for local dev
    logger.warning(f"SERVICE_DATABASE environment variable not set, using default: {DATABASE_SERVICE_URL}")
if not INTERVIEW_ANALYSIS_URL:
    raise ValueError("SERVICE_INTERVIEW_ANALYSIS environment variable not set")

# Configure CORS based on environment
is_production = os.getenv("NODE_ENV", "development") == "production"
is_development = not is_production

# Define default origins by environment
default_origins = {
    "development": [
        "http://localhost:3000",         # Frontend (local)
        "http://localhost:8000",         # API Gateway (local)
        "http://frontend:3000",          # Frontend (Docker)
        "http://api_gateway:8000"        # API Gateway (Docker)
    ],
    "production": [
        "https://navi-cfci.vercel.app",  # Vercel frontend
        "https://api-gateway-navi-cfci-project-uc.a.run.app"  # Cloud Run API Gateway
    ]
}

# Use environment variable if available, otherwise use environment-specific defaults
cors_origins = os.getenv("CORS_ORIGINS", "").split(",") if os.getenv("CORS_ORIGINS") else default_origins[
    "production" if is_production else "development"
]

# Log origins in development
if DEBUG:
    logger.debug(f"CORS origins: {cors_origins}")

# Create FastAPI app
app = FastAPI(
    title="Navi CFCI API Gateway",
    description="Gateway for routing requests to internal services",
    version="1.0.0",
    docs_url="/docs" if is_development else None,  # Only expose Swagger in development
    redoc_url="/redoc" if is_development else None,  # Only expose ReDoc in development
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create an HTTP client for forwarding requests
http_client = httpx.AsyncClient(timeout=60.0)

# Function for authenticated service calls
async def call_authenticated_service(
    service_url: str, 
    method: str = "GET", 
    json_data: Optional[Dict[str, Any]] = None,
    files: Optional[Dict] = None,
    data: Optional[Dict] = None,
    params: Optional[Dict[str, Any]] = None,
    headers: Optional[Dict[str, str]] = None
) -> Dict[str, Any]:
    """
    Call another Cloud Run service with Google Cloud IAM authentication.
    
    In production, uses Google's metadata server to get an OIDC token.
    In development, makes direct calls without authentication.
    Allows forwarding custom headers.
    
    Args:
        service_url: URL of the service to call
        method: HTTP method (GET, POST, etc.)
        json_data: JSON data to send (for POST/PUT requests)
        files: Files to upload (for POST requests)
        data: Form data to send (for POST requests with files)
        params: Query parameters
        headers: Custom headers to forward to the downstream service
        
    Returns:
        The JSON response from the service
        
    Raises:
        Exception: If the service call fails
    """
    is_production = os.environ.get("K_SERVICE") is not None
    forward_headers = headers or {} # Initialize with provided headers
    
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
            auth_req = google_requests.Request()
            token = None # Initialize token as None
            try:
                logger.debug(f"Attempting to fetch ID token for audience: {target_audience}")
                start_token_fetch = time.time()
                token = id_token.fetch_id_token(auth_req, target_audience)
                fetch_duration = time.time() - start_token_fetch
                if token:
                    logger.info(f"Successfully obtained ID token for {target_audience} in {fetch_duration:.4f}s")
                else:
                    logger.warning(f"fetch_id_token returned None for {target_audience} after {fetch_duration:.4f}s")

            except Exception as e:
                fetch_duration = time.time() - start_token_fetch
                logger.error(f"Error fetching ID token for {target_audience} after {fetch_duration:.4f}s: {str(e)}")
                # Fallback logic can go here if needed, or just proceed without token

            # Add service auth token to headers if available
            if token:
                forward_headers["Authorization"] = f"Bearer {token}"
                logger.debug(f"Using fetched Google OIDC token for {target_audience}")
            else:
                logger.warning(f"Proceeding with call to {target_audience} WITHOUT Google OIDC token.")

            # Make authenticated request with merged headers
            timeout = 60.0
            async with httpx.AsyncClient(timeout=timeout) as client:
                logger.debug(f"Initiating {method.upper()} request to {service_url} with headers: {list(forward_headers.keys())}")
                start_request = time.time()
                if method.upper() == "GET":
                    response = await client.get(service_url, headers=forward_headers, params=params)
                elif method.upper() == "POST":
                    if files:
                        response = await client.post(service_url, headers=forward_headers, files=files, data=data, params=params)
                    else:
                        response = await client.post(service_url, headers=forward_headers, json=json_data, params=params)
                elif method.upper() == "PUT":
                    response = await client.put(service_url, headers=forward_headers, json=json_data, params=params)
                elif method.upper() == "DELETE":
                    response = await client.delete(service_url, headers=forward_headers, params=params)
                else:
                    raise ValueError(f"Unsupported HTTP method: {method}")
                request_duration = time.time() - start_request
                logger.info(f"Received response from {service_url} (Status: {response.status_code}) after {request_duration:.4f}s")
            
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
                logger.debug(f"Initiating {method.upper()} request to {service_url} with headers: {list(forward_headers.keys())}")
                if method.upper() == "GET":
                    response = await client.get(service_url, headers=forward_headers, params=params)
                elif method.upper() == "POST":
                    if files:
                        logger.debug(f"Making POST request with files to {service_url}")
                        response = await client.post(service_url, headers=forward_headers, files=files, data=data, params=params)
                    else:
                        logger.debug(f"Making POST request with JSON to {service_url}")
                        response = await client.post(service_url, headers=forward_headers, json=json_data, params=params)
                elif method.upper() == "PUT":
                    response = await client.put(service_url, headers=forward_headers, json=json_data, params=params)
                elif method.upper() == "DELETE":
                    response = await client.delete(service_url, headers=forward_headers, params=params)
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

# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    request_id = str(uuid.uuid4())
    start_time = time.time()
    
    # Log request details
    logger.info(f"[{request_id}] Request started: {request.method} {request.url.path}")
    
    try:
        # Process the request
        response = await call_next(request)
        
        # Log response details
        process_time = time.time() - start_time
        logger.info(f"[{request_id}] Request completed: {request.method} {request.url.path} - Status: {response.status_code} - Time: {process_time:.4f}s")
        
        return response
    except Exception as e:
        # Log exception details
        process_time = time.time() - start_time
        logger.error(f"[{request_id}] Request failed: {request.method} {request.url.path} - Error: {str(e)} - Time: {process_time:.4f}s")
        logger.error(f"[{request_id}] Traceback: {traceback.format_exc()}")
        raise

@app.get("/",
        summary="API Gateway information",
        description="Returns basic information about the API Gateway service.",
        responses={
            200: {
                "description": "Basic service information",
                "content": {
                    "application/json": {
                        "example": {
                            "name": "Navi CFCI API Gateway",
                            "version": "1.0.0",
                            "service": "api_gateway",
                            "endpoints": {
                                "interview_analysis": {
                                    "analyze": "/api/interview_analysis/analyze",
                                    "interviews": "/api/interview_analysis/interviews",
                                    "interview_detail": "/api/interview_analysis/interviews/{interview_id}"
                                },
                                "sprint1_deprecated": {
                                    "preprocess": "/api/sprint1_deprecated/preprocess",
                                    "summarize": "/api/sprint1_deprecated/summarize",
                                    "keywords": "/api/sprint1_deprecated/keywords"
                                }
                            }
                        }
                    }
                }
            }
        })
async def root():
    """Root endpoint that lists available endpoints."""
    return {
        "name": "Navi CFCI API Gateway",
        "version": "1.0.0",
        "service": "api_gateway",
        "endpoints": {
            "interview_analysis": {
                "analyze": "/api/interview_analysis/analyze",
                "interviews": "/api/interview_analysis/interviews",
                "interview_detail": "/api/interview_analysis/interviews/{interview_id}"
            },
            "sprint1_deprecated": {
                "preprocess": "/api/sprint1_deprecated/preprocess",
                "summarize": "/api/sprint1_deprecated/summarize",
                "keywords": "/api/sprint1_deprecated/keywords"
            }
        }
    }

@app.post("/api/interview_analysis/analyze",
         summary="Analyze an interview transcript",
         description="Upload a VTT file to analyze an interview transcript and extract key insights.",
         include_in_schema=False)
async def analyze_interview(
    request: Request,
    file: UploadFile = File(...),
    user_payload: Dict[str, Any] = Depends(verify_token)
):
    """Forward analyze transcript request to interview analysis service."""
    try:
        # Read file content
        file_content = await file.read()
        
        # Prepare files for httpx
        files = {"file": (file.filename, file_content, file.content_type)}
        
        # Manually parse other form data from the request
        form_values = await request.form()
        project_id = form_values.get("projectId")
        interviewer = form_values.get("interviewer")
        interview_date = form_values.get("interview_date")
        # Note: userId is also in form_values but we prioritize the validated token one

        # Prepare form data dictionary to forward
        form_data_to_forward = {}
        if project_id:
            form_data_to_forward["project_id"] = project_id
        if interviewer:
            form_data_to_forward["interviewer"] = interviewer
        if interview_date:
            form_data_to_forward["interview_date"] = interview_date
        
        # Use userId from the validated token payload (more secure)
        token_user_id = get_user_id_from_payload(user_payload)
        if not token_user_id:
             logger.error("analyze_interview: Validated token payload is missing user ID!")
             raise HTTPException(status_code=500, detail="Internal authentication error")
        
        form_data_to_forward["userId"] = token_user_id
        logger.info(f"Using authenticated user ID: {token_user_id}")
        
        # Log the data being forwarded
        logger.info(f"Forwarding form data to analysis service: {form_data_to_forward}")
        
        # Prepare headers for downstream service
        forward_headers = {"X-Forwarded-User-ID": token_user_id}
        logger.debug(f"Forwarding headers to Analysis service: {list(forward_headers.keys())}")

        # Forward to interview analysis service with authentication
        endpoint_url = f"{INTERVIEW_ANALYSIS_URL}/api/interview_analysis/analyze"
        logger.info(f"Calling Interview Analysis service at: {endpoint_url}")
        
        # Use the authenticated service call function
        response_data = await call_authenticated_service(
            service_url=endpoint_url,
            method="POST",
            files=files,
            data=form_data_to_forward,
            headers=forward_headers
        )
        
        # Check if response contains an error
        if response_data.get("status") == "error":
            error_message = response_data.get("message", "Unknown error")
            logger.error(f"Error from interview analysis service: {error_message}")
            raise HTTPException(status_code=500, detail=f"Interview analysis service error: {error_message}")
        
        # Return the response data
        return response_data
    except httpx.TimeoutException:
        logger.error("Timeout while connecting to interview analysis service")
        raise HTTPException(status_code=504, detail="Interview analysis service timeout")
    except httpx.ConnectError as e:
        logger.error(f"Connection error to interview analysis service: {str(e)}")
        raise HTTPException(status_code=503, detail=f"Cannot connect to interview analysis service: {str(e)}")
    except Exception as e:
        logger.error(f"Error forwarding to interview analysis service: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Gateway error: {str(e)}")

@app.on_event("startup")
async def startup_event():
    logger.info("API Gateway starting up")

@app.on_event("shutdown")
async def shutdown_event():
    await http_client.aclose()
    logger.info("API Gateway shutting down")

@app.get("/api/auth/me",
         summary="Get authenticated user information",
         description="Returns information about the authenticated user.")
async def get_authenticated_user(payload: dict = Depends(verify_token)):
    logger.info(f"Fetching user info for user ID: {payload.get('sub')}")
    # Potentially fetch more user details from database service in the future?
    # For now, just return the payload from the verified token.
    return {"status": "success", "data": payload}

# -------------------------------
# Personas Endpoint (NEW)
# -------------------------------

# --- ADD Pydantic Model Definition BEFORE Usage ---
class CreatePersonaRequest(BaseModel):
    name: str = Field(..., min_length=1, description="The name for the new persona.")
    color: str = Field(..., min_length=1, description="The color identifier (e.g., 'blue') for the persona.")

@app.get("/api/personas",
         summary="Get all unique persona tags for the user",
         description="Retrieves a list of all unique persona tags owned by the authenticated user.")
async def get_all_personas(
    request: Request,
    user_payload: Dict[str, Any] = Depends(verify_token) # Ensure user is authenticated
):
    user_id = get_user_id_from_payload(user_payload)
    if not user_id:
        logger.error("get_all_personas: Could not extract user ID from token payload.")
        raise HTTPException(status_code=401, detail="Could not identify user from token.")
        
    logger.info(f"User {user_id} requesting all unique personas")
    
    # Prepare headers for downstream service
    forward_headers = {"X-Forwarded-User-ID": user_id}
    logger.debug(f"Forwarding headers to DB service: {list(forward_headers.keys())}")

    service_target_url = f"{DATABASE_SERVICE_URL}/personas"
    params = {"userId": user_id} # DB service expects userId in params for this route
    
    try:
        response = await call_authenticated_service(
            service_url=service_target_url,
            method="GET",
            params=params,
            headers=forward_headers # Pass headers
        )
        
        if response.get("status") == "success":
            logger.info(f"Successfully retrieved {len(response.get('data', []))} personas from DB service for user {user_id}")
            return response # Forward the successful response from DB service
        else:
            logger.error(f"Error response from database service while fetching personas: {response}")
            raise HTTPException(
                status_code=response.get("statusCode", 500), # Use DB service status code if available
                detail=response.get("message", "Failed to retrieve personas from database service")
            )
            
    except httpx.RequestError as exc:
        logger.error(f"HTTP RequestError calling database service for personas: {exc}")
        raise HTTPException(status_code=503, detail=f"Error communicating with database service: {exc}")
    except Exception as e:
        logger.error(f"Unexpected error fetching personas: {e}", exc_info=DEBUG)
        raise HTTPException(status_code=500, detail="Internal server error fetching personas")

@app.post("/api/personas",
          summary="Create a new persona",
          description="Creates a new persona owned by the authenticated user.",
          status_code=201)
async def create_persona(
    request: Request,
    persona_data: CreatePersonaRequest = Body(...),
    user_payload: Dict[str, Any] = Depends(verify_token)
):
    user_id = get_user_id_from_payload(user_payload)
    if not user_id:
        logger.error("create_persona: Could not extract user ID from token payload.")
        raise HTTPException(status_code=401, detail="Could not identify user from token.")
        
    logger.info(f"User {user_id} creating persona: {persona_data.name}")
    
    # Prepare data for DB service (it expects userId in the body)
    db_payload = persona_data.model_dump()
    db_payload["userId"] = user_id 

    # Prepare headers for downstream service
    forward_headers = {"X-Forwarded-User-ID": user_id}
    logger.debug(f"Forwarding headers to DB service: {list(forward_headers.keys())}")

    service_target_url = f"{DATABASE_SERVICE_URL}/personas"
    try:
        response = await call_authenticated_service(
            service_url=service_target_url,
            method="POST",
            json_data=db_payload, # Pass payload including userId
            headers=forward_headers # Pass headers
        )
        
        if response.get("status") == "success":
            logger.info(f"Successfully created persona '{persona_data.name}' via DB service for user {user_id}")
            return response # Forward the successful response
        else:
            # Handle specific errors from DB service (like 409 conflict)
            error_message = response.get("message", "Failed to create persona via database service")
            status_code = response.get("statusCode", 500) 
            logger.error(f"Error response from database service creating persona ({status_code}): {error_message}")
            # Forward the status code and message from the DB service
            raise HTTPException(status_code=status_code, detail=error_message)
            
    except httpx.RequestError as exc:
        logger.error(f"HTTP RequestError calling database service to create persona: {exc}")
        raise HTTPException(status_code=503, detail=f"Error communicating with database service: {exc}")
    except Exception as e:
        logger.error(f"Unexpected error creating persona: {e}", exc_info=DEBUG)
        raise HTTPException(status_code=500, detail="Internal server error creating persona")

# Pydantic model for PUT request body
class UpdatePersonaRequest(BaseModel):
    name: str = Field(..., min_length=1, description="The new name for the persona.")
    color: str = Field(..., min_length=1, description="The new color identifier (e.g., 'blue') for the persona.")

@app.put("/api/personas/{persona_id}",
         summary="Update a persona",
         description="Updates the name of a specific persona owned by the authenticated user.")
async def update_persona(
    persona_id: str,
    request: Request,
    persona_data: UpdatePersonaRequest = Body(...),
    user_payload: Dict[str, Any] = Depends(verify_token)
):
    user_id = get_user_id_from_payload(user_payload)
    if not user_id:
        logger.error("update_persona: Could not extract user ID from token payload.")
        raise HTTPException(status_code=401, detail="Could not identify user from token.")
        
    logger.info(f"User {user_id} updating persona {persona_id}")
    
    # Prepare data for DB service (it expects userId in the body)
    db_payload = persona_data.model_dump()
    db_payload["userId"] = user_id

    # Prepare headers for downstream service
    forward_headers = {"X-Forwarded-User-ID": user_id}
    logger.debug(f"Forwarding headers to DB service: {list(forward_headers.keys())}")

    service_target_url = f"{DATABASE_SERVICE_URL}/personas/{persona_id}"
    try:
        response = await call_authenticated_service(
            service_url=service_target_url,
            method="PUT",
            json_data=db_payload,
            headers=forward_headers # Pass headers
        )
        
        status_code = response.get("statusCode", 500) # Default to 500 if statusCode missing
        
        if response.get("status") == "success":
            logger.info(f"Successfully updated persona '{persona_id}' via DB service for user {user_id}")
            return response # Forward the successful response
        else:
            error_message = response.get("message", "Failed to update persona via database service")
            logger.error(f"Error response from database service updating persona ({status_code}): {error_message}")
            # Forward the status code and message from the DB service
            raise HTTPException(status_code=status_code, detail=error_message)
            
    except httpx.RequestError as exc:
        logger.error(f"HTTP RequestError calling database service to update persona: {exc}")
        raise HTTPException(status_code=503, detail=f"Error communicating with database service: {exc}")
    except Exception as e:
        logger.error(f"Unexpected error updating persona {persona_id}: {e}", exc_info=DEBUG)
        raise HTTPException(status_code=500, detail="Internal server error updating persona")

@app.delete("/api/personas/{persona_id}",
            summary="Delete a persona",
            description="Deletes a specific persona owned by the authenticated user.",
            status_code=200) # Can also use 204 No Content
async def delete_persona(
    persona_id: str,
    request: Request,
    user_payload: Dict[str, Any] = Depends(verify_token)
):
    user_id = get_user_id_from_payload(user_payload)
    if not user_id:
        logger.error("delete_persona: Could not extract user ID from token payload.")
        raise HTTPException(status_code=401, detail="Could not identify user from token.")
        
    logger.info(f"User {user_id} deleting persona {persona_id}")
    
    # Prepare headers for downstream service
    forward_headers = {"X-Forwarded-User-ID": user_id}
    logger.debug(f"Forwarding headers to DB service: {list(forward_headers.keys())}")

    # DB service expects userId as a query param for DELETE authorization
    params = {"userId": user_id} 

    service_target_url = f"{DATABASE_SERVICE_URL}/personas/{persona_id}"
    try:
        response = await call_authenticated_service(
            service_url=service_target_url,
            method="DELETE",
            params=params,
            headers=forward_headers # Pass headers
        )
        
        status_code = response.get("statusCode", 500)
        
        if response.get("status") == "success":
            logger.info(f"Successfully deleted persona '{persona_id}' via DB service for user {user_id}")
            # Optionally return the deleted object from the DB service response, or just success
            return response # Forward success response (might include deleted object)
            # Alternatively, return status code 204: return Response(status_code=204)
        else:
            error_message = response.get("message", "Failed to delete persona via database service")
            logger.error(f"Error response from database service deleting persona ({status_code}): {error_message}")
            raise HTTPException(status_code=status_code, detail=error_message)
            
    except httpx.RequestError as exc:
        logger.error(f"HTTP RequestError calling database service to delete persona: {exc}")
        raise HTTPException(status_code=503, detail=f"Error communicating with database service: {exc}")
    except Exception as e:
        logger.error(f"Unexpected error deleting persona {persona_id}: {e}", exc_info=DEBUG)
        raise HTTPException(status_code=500, detail="Internal server error deleting persona")

# --- NEW Persona Suggestion Endpoint ---
@app.post("/api/personas/{interview_id}/suggest_personas",
          summary="Suggest personas for an interview",
          description="Triggers AI analysis of an interview to suggest relevant personas.")
async def suggest_interview_personas(
    interview_id: str,
    request: Request, # Needed to potentially get headers if auth changes
    user_payload: Dict[str, Any] = Depends(verify_token) # Requires authentication
):
    """Forwards request to the interview analysis service to get persona suggestions."""
    logger.info(f"Received request to suggest personas for interview {interview_id}")
    
    user_id = get_user_id_from_payload(user_payload)
    if not user_id:
        logger.error("suggest_interview_personas: Validated token payload is missing user ID!")
        raise HTTPException(status_code=500, detail="Internal authentication error")

    # Prepare headers to forward, including the validated user ID
    forward_headers = {
        "X-Forwarded-User-ID": user_id
        # Potentially forward other relevant headers from original request?
        # e.g., "X-Request-ID": request.headers.get("X-Request-ID", str(uuid.uuid4()))
    }
    logger.info(f"Forwarding suggestion request for user {user_id} with headers: {list(forward_headers.keys())}")

    # Construct target URL for the interview analysis service
    target_url = f"{INTERVIEW_ANALYSIS_URL}/api/personas/{interview_id}/suggest_personas"
    logger.info(f"Calling Interview Analysis service for suggestions at: {target_url}")

    try:
        response_data = await call_authenticated_service(
            service_url=target_url,
            method="POST",
            headers=forward_headers # Pass the required header
            # No body needed for this specific endpoint in the backend
        )
        
        # Check for errors returned by the service call utility or the downstream service
        if response_data.get("status") == "error":
            error_message = response_data.get("message", "Unknown error during persona suggestion")
            status_code = response_data.get("status_code", 500) # Get status code if provided
            logger.error(f"Error from persona suggestion service: {error_message} (Status: {status_code})")
            # Map backend status code if available, default to 500
            effective_status_code = status_code if 400 <= status_code < 600 else 500
            raise HTTPException(status_code=effective_status_code, detail=f"Persona suggestion service error: {error_message}")
        
        # Return successful data
        return response_data
    
    except httpx.TimeoutException:
        logger.error(f"Timeout calling persona suggestion service at {target_url}")
        raise HTTPException(status_code=504, detail="Persona suggestion service timeout")
    except httpx.ConnectError as e:
        logger.error(f"Connection error to persona suggestion service: {str(e)}")
        raise HTTPException(status_code=503, detail=f"Cannot connect to persona suggestion service: {str(e)}")
    except HTTPException as e:
        # Re-raise HTTPExceptions that might have been raised above
        raise e
    except Exception as e:
        logger.error(f"Unexpected error forwarding persona suggestion request: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Gateway error during suggestion: {str(e)}")

# -------------------------------
# Pydantic Models (NEW) - REMOVED CreatePersonaRequest from here
# -------------------------------

# Define a model for the update request body to allow specific fields
class UpdateInterviewRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, description="The new title for the interview.")
    project_id: Optional[str] = Field(None, description="The ID of the project to associate the interview with, or null to disassociate.")
    personaIds: Optional[List[str]] = Field(None, description="A list of persona IDs to associate with the interview.")

# -------------------------------
# Interview Endpoints
# -------------------------------

@app.get("/api/interviews",
        summary="Get interviews with pagination",
        description="Retrieves a paginated list of interviews for the authenticated user.")
async def get_interviews(
    request: Request,
    limit: Optional[int] = 10,
    offset: Optional[int] = 0,
    user_payload: Optional[dict] = Depends(get_optional_user)
):
    user_id = get_user_id_from_payload(user_payload) if user_payload else None
    logger.info(f"Requesting interviews (User: {user_id or 'Anonymous'}, Limit: {limit}, Offset: {offset})")

    # Prepare headers, include user ID if available
    forward_headers = {}
    if user_id:
        forward_headers["X-Forwarded-User-ID"] = user_id
        logger.debug(f"Forwarding headers to DB service: {list(forward_headers.keys())}")
    else:
        logger.debug("Forwarding request without user ID header (anonymous access).")

    service_target_url = f"{DATABASE_SERVICE_URL}/interviews"
    # Pass userId as query param as DB service expects it
    params = {"limit": limit, "offset": offset}
    if user_id:
        params["userId"] = user_id

    try:
        response = await call_authenticated_service(
            service_url=service_target_url,
            method="GET",
            params=params,
            headers=forward_headers
        )
        
        if response.get("status") == "success":
            logger.info(f"Successfully retrieved interviews from DB service for user {user_id or 'guest'}")
            return response # Forward the successful response from DB service
        else:
            logger.error(f"Error response from database service while fetching interviews: {response}")
            raise HTTPException(
                status_code=response.get("statusCode", 500), # Use DB service status code if available
                detail=response.get("message", "Failed to retrieve interviews from database service")
            )

    except httpx.RequestError as exc:
        logger.error(f"HTTP RequestError calling database service for interviews: {exc}")
        raise HTTPException(status_code=503, detail=f"Error communicating with database service: {exc}")
    except Exception as e:
        logger.error(f"Unexpected error fetching interviews: {e}", exc_info=DEBUG)
        raise HTTPException(status_code=500, detail="Internal server error fetching interviews")

@app.get("/api/interviews/{interview_id}",
        summary="Get interview details",
        description="Retrieves details of a specific interview by ID for the authenticated user.")
async def get_interview_details(
    interview_id: str,
    request: Request,
    user_payload: Dict[str, Any] = Depends(verify_token)
):
    user_id = get_user_id_from_payload(user_payload)
    logger.info(f"User {user_id} requesting details for interview {interview_id}")
    
    # Prepare headers
    forward_headers = {"X-Forwarded-User-ID": user_id}
    logger.debug(f"Forwarding headers to DB service: {list(forward_headers.keys())}")

    # DB service expects userId as query param for auth check
    params = {"userId": user_id}
    service_target_url = f"{DATABASE_SERVICE_URL}/interviews/{interview_id}"

    try:
        response = await call_authenticated_service(
            service_url=service_target_url,
            method="GET",
            params=params,
            headers=forward_headers
        )
        
        if response.get("status") == "success":
            logger.info(f"Successfully retrieved details for interview {interview_id} from DB service for user {user_id}")
            return response # Forward the successful response from DB service
        elif response.get("statusCode") == 404:
             logger.warning(f"Interview {interview_id} not found in DB service for user {user_id}")
             raise HTTPException(status_code=404, detail="Interview not found")
        elif response.get("statusCode") == 403:
            logger.warning(f"User {user_id} not authorized to view interview {interview_id}")
            raise HTTPException(status_code=403, detail="Not authorized to view this interview")
        else:
            logger.error(f"Error response from database service fetching details for interview {interview_id}: {response}")
            raise HTTPException(
                status_code=response.get("statusCode", 500),
                detail=response.get("message", "Failed to retrieve interview details from database service")
            )

    except httpx.RequestError as exc:
        logger.error(f"HTTP RequestError calling database service for interview details {interview_id}: {exc}")
        raise HTTPException(status_code=503, detail=f"Error communicating with database service: {exc}")
    except Exception as e:
        logger.error(f"Unexpected error fetching interview details {interview_id}: {e}", exc_info=DEBUG)
        raise HTTPException(status_code=500, detail="Internal server error fetching interview details")

@app.put("/api/interviews/{interview_id}",
        summary="Update interview details",
        description="Updates details (e.g., title, project_id, personas) of a specific interview by ID for the authenticated user.")
async def update_interview_details(
    interview_id: str,
    request: Request,
    update_data: UpdateInterviewRequest = Body(...), # Use the Pydantic model for validation
    user_payload: Dict[str, Any] = Depends(verify_token)
):
    user_id = get_user_id_from_payload(user_payload)
    logger.info(f"User {user_id} updating interview {interview_id}")
    
    # Prepare headers
    forward_headers = {"X-Forwarded-User-ID": user_id}
    logger.debug(f"Forwarding headers to DB service: {list(forward_headers.keys())}")

    # Prepare payload for DB service (it doesn't need userId in body here)
    db_payload = update_data.model_dump(exclude_unset=True) 

    # DB service expects userId as query param for auth check
    params = {"userId": user_id}
    service_target_url = f"{DATABASE_SERVICE_URL}/interviews/{interview_id}"
    
    try:
        response = await call_authenticated_service(
            service_url=service_target_url,
            method="PUT",
            json_data=db_payload,
            params=params, 
            headers=forward_headers
        )
        
        if response.get("status") == "success":
            logger.info(f"Successfully updated interview {interview_id} via DB service for user {user_id}")
            return response # Forward the successful response from DB service
        elif response.get("statusCode") == 404:
            logger.warning(f"Update failed: Interview {interview_id} not found in DB service (user {user_id})")
            raise HTTPException(status_code=404, detail="Interview not found")
        elif response.get("statusCode") == 400:
            logger.warning(f"Update failed (400) for interview {interview_id}: {response.get('message')}")
            raise HTTPException(status_code=400, detail=response.get('message', "Invalid update data"))
        elif response.get("statusCode") == 403:
            logger.warning(f"Update failed (403): User {user_id} not authorized to update interview {interview_id}")
            raise HTTPException(status_code=403, detail="Not authorized to update this interview")
        else:
            logger.error(f"Error response from database service updating interview {interview_id}: {response}")
            raise HTTPException(
                status_code=response.get("statusCode", 500),
                detail=response.get("message", "Failed to update interview via database service")
            )

    except httpx.RequestError as exc:
        logger.error(f"HTTP RequestError calling database service to update interview {interview_id}: {exc}")
        raise HTTPException(status_code=503, detail=f"Error communicating with database service: {exc}")
    except Exception as e:
        logger.error(f"Unexpected error updating interview {interview_id}: {e}", exc_info=DEBUG)
        raise HTTPException(status_code=500, detail="Internal server error updating interview")

# Additional database service endpoints can be added as needed
# POST, PUT, DELETE for interviews, etc. 

# ==============================================================================
# DATABASE SERVICE ENDPOINTS (FORWARDING)
# ==============================================================================

# Helper function for generic database forwarding

# REMOVED Sprint1 Deprecated from service discovery endpoints
@app.get("/api/services/discover", include_in_schema=False)
async def discover_services():
    """Internal endpoint for listing available backend services."""
    return {
        "interview_analysis": INTERVIEW_ANALYSIS_URL,
        "database": DATABASE_SERVICE_URL,
        "sprint1_deprecated": SPRINT1_DEPRECATED_URL
    }

@app.get("/api/services/openapi", include_in_schema=False)
async def get_services_openapi():
    """Fetches and combines OpenAPI schemas from backend services."""
    services = {
        "interview_analysis": INTERVIEW_ANALYSIS_URL,
        "database": DATABASE_SERVICE_URL,
        "sprint1_deprecated": SPRINT1_DEPRECATED_URL
    }
    combined_openapi = {
        "openapi": "3.0.0",
        "info": {
            "title": "Navi CFCI Combined Service API",
            "version": "1.0.0"
        },
        "paths": {},
        "components": {
            "schemas": {},
            "securitySchemes": app.openapi().get("components", {}).get("securitySchemes", {})
        },
        "security": app.openapi().get("security", [])
    }

    for service_name, base_url in services.items():
        if not base_url: continue
        try:
            openapi_url = f"{base_url}/openapi.json"
            response = await http_client.get(openapi_url)
            response.raise_for_status()
            service_openapi = response.json()

            # Merge paths, prefixing with service name
            for path, path_item in service_openapi.get("paths", {}).items():
                combined_openapi["paths"][f"/api/{service_name}{path}"] = path_item

            # Merge components schemas, prefixing with service name to avoid conflicts
            for schema_name, schema_def in service_openapi.get("components", {}).get("schemas", {}).items():
                combined_openapi["components"]["schemas"][f"{service_name.capitalize()}_{schema_name}"] = schema_def

        except httpx.RequestError as e:
            logger.error(f"Error fetching OpenAPI schema for {service_name}: {e}")
        except Exception as e:
            logger.error(f"Error processing OpenAPI schema for {service_name}: {e}")

    return combined_openapi

# ==============================================================================
# SPRINT1 DEPRECATED ENDPOINTS (FORWARDING) - Re-added for local dev
# ==============================================================================

@app.post("/api/sprint1_deprecated/keywords",
         summary="Extract keywords from a transcript",
         description="Upload a VTT file to extract key terms and phrases from an interview transcript.",
         include_in_schema=False) # Keep hidden from prod docs
async def extract_keywords(file: UploadFile = File(...)):
    """Forward keywords request to sprint1_deprecated service."""
    try:
        form = {"file": (file.filename, await file.read(), file.content_type)}
        response = await http_client.post(
            f"{SPRINT1_DEPRECATED_URL}/api/sprint1_deprecated/keywords",
            files=form
        )
        return response.json()
    except Exception as e:
        logger.error(f"Error forwarding to keywords service: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Gateway error: {str(e)}")

@app.post("/api/sprint1_deprecated/summarize",
         summary="Summarize an interview transcript",
         description="Upload a VTT file to generate a summary of an interview transcript.",
         include_in_schema=False) # Keep hidden from prod docs
async def summarize_transcript(file: UploadFile = File(...)):
    """Forward summarize request to sprint1_deprecated service."""
    try:
        form = {"file": (file.filename, await file.read(), file.content_type)}
        response = await http_client.post(
            f"{SPRINT1_DEPRECATED_URL}/api/sprint1_deprecated/summarize",
            files=form
        )
        return response.json()
    except Exception as e:
        logger.error(f"Error forwarding to summarize service: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Gateway error: {str(e)}")

@app.post("/api/sprint1_deprecated/preprocess",
         summary="Preprocess an interview transcript",
         description="Upload a VTT file to clean and format an interview transcript for analysis.",
         include_in_schema=False) # Keep hidden from prod docs
async def preprocess_transcript(file: UploadFile = File(...)):
    """Forward preprocess request to sprint1_deprecated service."""
    try:
        form = {"file": (file.filename, await file.read(), file.content_type)}
        response = await http_client.post(
            f"{SPRINT1_DEPRECATED_URL}/api/sprint1_deprecated/preprocess",
            files=form
        )
        return response.json()
    except Exception as e:
        logger.error(f"Error forwarding to preprocess service: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Gateway error: {str(e)}")

# ==============================================================================
# PROJECT ENDPOINTS (DATABASE SERVICE FORWARDING)
# ==============================================================================

@app.get("/api/projects",
        summary="Get projects for the authenticated user",
        description="Retrieves a paginated list of projects owned by the authenticated user.",
        response_model=Dict[str, Any], # Define expected response structure if known
        )
async def get_projects(
    request: Request,
    limit: Optional[int] = 50, # Default limit matches frontend call
    offset: Optional[int] = 0,
    user_payload: Dict[str, Any] = Depends(verify_token)
):
    """Proxy projects list request to database service with authentication."""
    logger.info(f"User {user_payload.get('sub')} requesting projects (Limit: {limit}, Offset: {offset})")
    try:
        user_id = get_user_id_from_payload(user_payload)
        logger.info(f"get_projects: User ID extracted: {user_id}")
        
        if not user_id:
            # This should technically not happen if verify_token works
            logger.error("get_projects: Validated token payload is missing user ID!")
            raise HTTPException(status_code=500, detail="Internal authentication processing error")
        
        logger.info(f"Fetching projects for user: {user_id} with limit: {limit}, offset: {offset}")
        
        # Prepare headers
        forward_headers = {"X-Forwarded-User-ID": user_id}
        logger.debug(f"Forwarding headers to DB service: {list(forward_headers.keys())}")

        # Build the request URL with parameters for the database service
        params = {
            "limit": str(limit),
            "offset": str(offset),
            "userId": user_id
        }
        
        # Forward to database service using the authenticated helper
        endpoint_url = f"{DATABASE_SERVICE_URL}/projects"
        logger.info(f"Calling database service (GET) at: {endpoint_url} with params: {params}")
        
        response_data = await call_authenticated_service(
            service_url=endpoint_url,
            method="GET",
            params=params,
            headers=forward_headers
        )
        
        # Check for errors returned by the helper or the database service
        if response_data.get("status") == "error":
            error_message = response_data.get("message", "Unknown error")
            logger.error(f"Error from database service when getting projects: {error_message}")
            # Determine status code based on error if possible, default 500
            status_code = 500 
            # Example: if "database connection failed" in error_message.lower(): status_code = 503
            raise HTTPException(status_code=status_code, detail=f"Database service error: {error_message}")
        
        logger.debug(f"Successfully received projects data: {response_data}")
        return response_data
        
    except HTTPException as http_exc: # Re-raise specific HTTP exceptions
        raise http_exc 
    except Exception as e:
        logger.error(f"Error processing get_projects request: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Gateway error: {str(e)}")

# Existing POST handler for creating projects
class CreateProjectRequest(BaseModel):
    name: str = Field(..., min_length=1, description="The name of the project.")
    description: Optional[str] = Field(None, description="An optional one-line description for the project.")

@app.post("/api/projects",
         summary="Create a new project",
         description="Creates a new project associated with the authenticated user.",
         response_model=Dict[str, Any], # Define expected response structure if known
         status_code=201 # Set default success status code
        )
async def create_project(
    request_body: CreateProjectRequest = Body(...),
    user_payload: Dict[str, Any] = Depends(verify_token)
):
    """Proxy project creation request to database service with authentication."""
    user_id = get_user_id_from_payload(user_payload)
    if not user_id:
        logger.error("create_project: Validated token payload is missing user ID!")
        raise HTTPException(status_code=500, detail="Internal authentication error")

    logger.info(f"User {user_id} creating project: {request_body.name}")

    # Prepare payload for DB service (expects ownerId in body)
    db_payload = request_body.model_dump()
    db_payload["ownerId"] = user_id

    # Prepare headers
    forward_headers = {"X-Forwarded-User-ID": user_id}
    logger.debug(f"Forwarding headers to DB service: {list(forward_headers.keys())}")

    service_target_url = f"{DATABASE_SERVICE_URL}/projects"
    
    try:
        response = await call_authenticated_service(
            service_url=service_target_url,
            method="POST",
            json_data=db_payload,
            headers=forward_headers # Ensure headers are passed
        )
        # Check for errors from the service call utility or the downstream service
        if isinstance(response, dict) and response.get("status") == "error":
            error_message = response.get("message", "Unknown error creating project")
            status_code = response.get("status_code", 500) # Get status code if provided
            logger.error(f"Error from database service creating project: {error_message} (Status: {status_code})")
            effective_status_code = status_code if 400 <= status_code < 600 else 500
            # Handle specific 409 Conflict for duplicate project names
            if "already exists" in error_message.lower(): 
                 effective_status_code = 409
            raise HTTPException(status_code=effective_status_code, detail=f"Database service error: {error_message}")
        
        # Return successful data
        return response

    except httpx.TimeoutException:
        logger.error(f"Timeout calling database service for project creation")
        raise HTTPException(status_code=504, detail="Database service timeout")
    except httpx.ConnectError as e:
        logger.error(f"Connection error to database service for project creation: {str(e)}")
        raise HTTPException(status_code=503, detail=f"Cannot connect to database service: {str(e)}")
    except HTTPException as e:
        # Re-raise explicitly raised HTTPExceptions
        raise e
    except Exception as e:
        logger.error(f"Unexpected error creating project: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Gateway error during project creation: {str(e)}")

# --- Add other project endpoints (GET, PUT, DELETE) later as needed --- 