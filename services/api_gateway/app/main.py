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
from pydantic import BaseModel, Field, validator
from urllib.parse import urlencode, urlparse, urlunparse, parse_qs
import json

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
# Increase default timeout slightly for potentially longer service calls
http_client = httpx.AsyncClient(timeout=90.0)

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
    
    # Initialize headers, filtering out problematic ones
    forward_headers = { 
        k: v for k, v in (headers or {}).items() 
        if k.lower() not in ['content-length', 'transfer-encoding', 'host']
    }
    # Ensure content-type is set for JSON payloads if not already present
    if json_data is not None and 'content-type' not in (k.lower() for k in forward_headers):
        forward_headers['Content-Type'] = 'application/json'

    # --- Manually Append Params for PUT/PATCH/DELETE --- 
    request_url = service_url
    if params and method.upper() in ["PUT", "PATCH", "DELETE"]:
        parsed_url = urlparse(service_url)
        query_params = parse_qs(parsed_url.query)
        # Add new params, preserving existing ones if any
        for key, value in params.items():
            # Ensure values are strings or lists of strings for urlencode
            query_params[key] = str(value) if not isinstance(value, list) else [str(v) for v in value]
        
        # urlencode handles lists correctly (e.g., key=val1&key=val2)
        encoded_params = urlencode(query_params, doseq=True)
        
        # Reconstruct URL
        request_url = urlunparse((
            parsed_url.scheme,
            parsed_url.netloc,
            parsed_url.path,
            parsed_url.params, # Usually empty
            encoded_params,    # New query string
            parsed_url.fragment  # Usually empty
        ))
        logger.debug(f"Manually appended params for {method.upper()}. New URL: {request_url}")
        # Clear params dict so httpx doesn't also try to add them for these methods
        params_for_httpx = None 
    else:
        # For GET/POST, let httpx handle params
        params_for_httpx = params
        request_url = service_url
    # --- End Manual Append --- 

    if is_production:
        logger.info(f"Making authenticated call to {request_url} (production mode)")
        try:
            # Extract target audience (only the host part of the URL)
            url_parts = request_url.split("/")
            if len(url_parts) >= 3:
                target_audience = f"{url_parts[0]}//{url_parts[2]}"
                logger.debug(f"Target audience for authentication: {target_audience}")
            else:
                target_audience = request_url
                logger.warning(f"Unusual service URL format: {request_url}")
            
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

            # Make authenticated request with filtered headers
            timeout = 60.0 # Keep specific timeout for production
            async with httpx.AsyncClient(timeout=timeout) as client:
                logger.debug(f"Initiating {method.upper()} request to {request_url} with headers: {list(forward_headers.keys())}")
                start_request = time.time()
                if method.upper() == "GET":
                    response = await client.get(request_url, headers=forward_headers, params=params_for_httpx)
                elif method.upper() == "POST":
                    if files:
                        # httpx handles Content-Type for files, remove from headers if present
                        clean_file_headers = {k: v for k, v in forward_headers.items() if k.lower() != 'content-type'}
                        response = await client.post(request_url, headers=clean_file_headers, files=files, data=data, params=params_for_httpx)
                    else:
                        response = await client.post(request_url, headers=forward_headers, json=json_data, params=params_for_httpx)
                elif method.upper() == "PUT":
                    response = await client.put(request_url, headers=forward_headers, json=json_data, params=params_for_httpx)
                elif method.upper() == "DELETE":
                    response = await client.delete(request_url, headers=forward_headers, params=params_for_httpx)
                elif method.upper() == "PATCH":
                    response = await client.patch(request_url, headers=forward_headers, json=json_data, params=params_for_httpx)
                else:
                    raise ValueError(f"Unsupported HTTP method: {method}")
                request_duration = time.time() - start_request
                logger.info(f"Received response from {request_url} (Status: {response.status_code}) after {request_duration:.4f}s")
            
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
                logger.info(f"Successfully received JSON response from {request_url}")
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
            logger.error(f"Timeout error calling {request_url}: {str(timeout_error)}")
            return {
                "status": "error",
                "message": f"Request timed out: {str(timeout_error)}"
            }
        except httpx.TransportError as transport_error:
            logger.error(f"Transport error calling {request_url}: {str(transport_error)}")
            return {
                "status": "error",
                "message": f"Connection error: {str(transport_error)}"
            }
        except Exception as e:
            logger.error(f"Error making authenticated call to {request_url}: {str(e)}", exc_info=True)
            return {
                "status": "error",
                "message": f"Error calling service: {str(e)}"
            }
    else:
        logger.info(f"Making direct call to {request_url} (development mode)")
        # In development, make direct calls without authentication but still filter headers
        try:
            if method.upper() == "POST" and json_data:
                logger.debug(f"Development mode POST with JSON: {json_data}")
            
            timeout = 90.0 # Longer timeout for local debugging
            async with httpx.AsyncClient(timeout=timeout) as client:
                logger.debug(f"Initiating {method.upper()} request to {request_url} with headers: {list(forward_headers.keys())}")
                if method.upper() == "GET":
                    response = await client.get(request_url, headers=forward_headers, params=params_for_httpx)
                elif method.upper() == "POST":
                    if files:
                        # httpx handles Content-Type for files, remove from headers if present
                        clean_file_headers = {k: v for k, v in forward_headers.items() if k.lower() != 'content-type'}
                        logger.debug(f"Making POST request with files to {request_url}")
                        response = await client.post(request_url, headers=clean_file_headers, files=files, data=data, params=params_for_httpx)
                    else:
                        logger.debug(f"Making POST request with JSON to {request_url}")
                        response = await client.post(request_url, headers=forward_headers, json=json_data, params=params_for_httpx)
                elif method.upper() == "PUT":
                    response = await client.put(request_url, headers=forward_headers, json=json_data, params=params_for_httpx)
                elif method.upper() == "DELETE":
                    response = await client.delete(request_url, headers=forward_headers, params=params_for_httpx)
                elif method.upper() == "PATCH":
                    response = await client.patch(request_url, headers=forward_headers, json=json_data, params=params_for_httpx)
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
                logger.info(f"Successfully received JSON response from {request_url}")
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
            logger.error(f"Timeout error calling {request_url}: {str(timeout_error)}")
            return {
                "status": "error",
                "message": f"Request timed out: {str(timeout_error)}"
            }
        except httpx.TransportError as transport_error:
            logger.error(f"Transport error calling {request_url}: {str(transport_error)}")
            return {
                "status": "error",
                "message": f"Connection error: {str(transport_error)}"
            }
        except Exception as e:
            logger.error(f"Error making call to {request_url}: {str(e)}", exc_info=True)
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
        
        status_code = response.get("statusCode", 500)
        
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
    if not user_id:
        logger.error("update_interview_details: Could not extract user ID from token payload.")
        raise HTTPException(status_code=401, detail="Could not identify user from token.")

    logger.info(f"User {user_id} updating interview {interview_id}")
    
    # Prepare data for DB service 
    # Use exclude_none=True to include fields explicitly set to null (like project_id)
    db_payload = update_data.model_dump(exclude_none=True) 
    
    # REMOVED: Check for empty payload, as sending { "project_id": null } is valid
    # if not db_payload: 
    #      logger.warning(f"Update payload for interview {interview_id} became empty unexpectedly.")
    #      raise HTTPException(status_code=400, detail="No fields provided for update.")

    # DB service expects userId as query param for authorization check
    params = {"userId": user_id}

    # Prepare headers for downstream service
    forward_headers = {"X-Forwarded-User-ID": user_id}
    logger.debug(f"Forwarding headers to DB service: {list(forward_headers.keys())}")

    service_target_url = f"{DATABASE_SERVICE_URL}/interviews/{interview_id}"
    try:
        response = await call_authenticated_service(
            service_url=service_target_url,
            method="PUT",
            json_data=db_payload,
            params=params, # Pass params including userId
            headers=forward_headers
        )
        
        # Refined Error Handling (similar to delete_project)
        if response.get("status") == "error":
            error_message = response.get("message", "Unknown error from database service")
            original_status_code = 500 
            if isinstance(error_message, str) and error_message.startswith("Service returned "):
                try:
                    parts = error_message.split(':', 1)
                    code_part = parts[0].split()[-1]
                    original_status_code = int(code_part)
                except (ValueError, IndexError):
                    pass 
            
            logger.error(f"Error response relayed from database service updating interview (Original Status: {original_status_code}): {error_message}")
            effective_status_code = original_status_code if 400 <= original_status_code < 600 else 500
            
            # Extract detail
            exception_detail = error_message # Default to full message
            if isinstance(error_message, str) and error_message.startswith("Service returned "):
                 try:
                    detail_part = error_message.split(':', 1)[1].strip()
                    # Attempt to parse JSON detail if present
                    try: 
                       json_detail = json.loads(detail_part)
                       exception_detail = json_detail.get("message", json_detail.get("detail", detail_part)) # Use parsed message/detail
                    except json.JSONDecodeError:
                       exception_detail = detail_part # Use raw detail if not JSON
                 except IndexError:
                    pass # Keep full error_message as detail
            
            raise HTTPException(status_code=effective_status_code, detail=exception_detail)
        
        # Handle success
        elif response.get("status") == "success":
            logger.info(f"Successfully updated interview '{interview_id}' via DB service for user {user_id}")
            return response 
        else:
             # Fallback for unexpected successful response format from DB service
             logger.warning(f"Received unexpected successful response format from DB service updating interview: {response}")
             return response
            
    except httpx.RequestError as exc:
        logger.error(f"HTTP RequestError calling database service to update interview: {exc}")
        raise HTTPException(status_code=503, detail=f"Error communicating with database service: {exc}")
    except HTTPException as http_exc: # Explicitly re-raise HTTPExceptions
        raise http_exc
    except Exception as e:
        logger.error(f"Unexpected error updating interview {interview_id}: {e}", exc_info=DEBUG)
        raise HTTPException(status_code=500, detail="Internal server error updating interview")

# --- NEW DELETE Handler ---
@app.delete("/api/interviews/{interview_id}",
            summary="Delete an interview",
            description="Deletes a specific interview owned by the authenticated user.",
            status_code=200) # Can use 204 if no content is returned
async def delete_interview(
    interview_id: str,
    request: Request,
    user_payload: Dict[str, Any] = Depends(verify_token) # Ensure authentication
):
    """Handles deleting an interview by forwarding the request to the database service."""
    logger.info(f"DELETE request received for interview ID: {interview_id}")
    
    # Ensure DATABASE_SERVICE_URL is available
    if not DATABASE_SERVICE_URL:
        logger.error("Database service URL is not configured!")
        raise HTTPException(status_code=500, detail="Internal server configuration error")
        
    # Extract userId for authorization in the database service
    user_id = get_user_id_from_payload(user_payload)
    if not user_id:
        # This should ideally be caught by verify_token, but double-check
        logger.error("Could not extract user ID from token.")
        raise HTTPException(status_code=401, detail="Invalid authentication token")
        
    # Prepare parameters for the database service call
    # Pass userId as query param for ownership check in the DB service
    db_params = {"userId": user_id}
    
    # Construct the target URL for the database service
    db_service_url = f"{DATABASE_SERVICE_URL}/interviews/{interview_id}"
    logger.info(f"Forwarding DELETE request to database service: {db_service_url} with params: {db_params}")

    # Call the database service using the authenticated helper
    response_data = await call_authenticated_service(
        service_url=db_service_url,
        method="DELETE",
        params=db_params,
        headers=dict(request.headers) # Forward relevant headers
    )
    
    # Check for errors from the database service
    # Handle potential different success statuses (e.g., 200 OK or 204 No Content)
    if isinstance(response_data, dict) and response_data.get("status") == "error":
        error_message = response_data.get("message", "Database service error during delete")
        # Try to get specific status code, default to 500 or maybe 400/404 depending on expected errors
        status_code = response_data.get("statusCode", 500) 
        logger.error(f"Error from database service during delete: {error_message} (Status: {status_code})")
        raise HTTPException(status_code=status_code, detail=error_message)
    elif isinstance(response_data, dict) and response_data.get("status") == "success":
         # If DB service returns a success object (e.g., status 200)
        logger.info(f"Successfully deleted interview {interview_id} via database service.")
        return response_data # Forward the success response
    else:
        # Assume success if no error dict is returned (could be 204 No Content)
        # Or handle unexpected response structures
        logger.info(f"Interview {interview_id} deletion likely successful (non-error response from DB service).")
        # Return a standard success response or modify based on actual DB service behavior
        return {"status": "success", "message": "Interview deleted successfully"} 

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

# Place after the existing @app.post("/api/projects", ...) route

# NEW: GET Project by ID Route
@app.get("/api/projects/{project_id}",
        summary="Get project details by ID",
        description="Retrieves details for a specific project owned by the authenticated user.",
        response_model=Dict[str, Any],
       )
async def get_project_details(
    project_id: str,
    request: Request,
    user_payload: Dict[str, Any] = Depends(verify_token)
):
    """Proxy request to database service to get details for a specific project."""
    user_id = get_user_id_from_payload(user_payload)
    if not user_id:
        logger.error("get_project_details: Validated token payload is missing user ID!")
        raise HTTPException(status_code=500, detail="Internal authentication error")

    logger.info(f"User {user_id} requesting details for project {project_id}")

    # Prepare headers
    forward_headers = {"X-Forwarded-User-ID": user_id}

    # NOTE: Assuming database service has a route like /projects/{projectId}
    service_target_url = f"{DATABASE_SERVICE_URL}/projects/{project_id}"
    logger.debug(f"Calling DB Service: GET {service_target_url}")

    try:
        response = await call_authenticated_service(
            service_url=service_target_url,
            method="GET",
            headers=forward_headers,
            # DB Service might expect userId as a query param for auth check
            params={"userId": user_id} 
        )
        
        if isinstance(response, dict) and response.get("status") == "error":
            error_message = response.get("message", "Unknown error getting project details")
            status_code = response.get("statusCode", 500)
            logger.error(f"Error from database service getting project details ({status_code}): {error_message}")
            # Handle 404 specifically if project not found or user not authorized by DB service
            if status_code == 404:
                 raise HTTPException(status_code=404, detail=f"Project not found or not authorized.")
            effective_status_code = status_code if 400 <= status_code < 600 else 500
            raise HTTPException(status_code=effective_status_code, detail=f"Database service error: {error_message}")

        # Ensure the response structure includes a 'data' key if needed by frontend
        # The current ProjectDetailResponse expects { status: ..., data?: Project }
        # If DB service returns just the project object, wrap it:
        # if not isinstance(response, dict) or 'data' not in response:
        #     logger.warning(f"DB Service response for project details missing standard structure. Wrapping...")
        #     return {"status": "success", "data": response} 
            
        return response # Assuming DB service returns the correct structure

    except httpx.TimeoutException:
        logger.error(f"Timeout calling database service for project details")
        raise HTTPException(status_code=504, detail="Database service timeout")
    except httpx.ConnectError as e:
        logger.error(f"Connection error to database service for project details: {str(e)}")
        raise HTTPException(status_code=503, detail=f"Cannot connect to database service: {str(e)}")
    except HTTPException as e:
        raise e 
    except Exception as e:
        logger.error(f"Unexpected error getting project details: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Gateway error getting project details: {str(e)}")

# NEW: GET Problem Areas for Project
@app.get("/api/projects/{project_id}/problem-areas",
         summary="Get confirmed problem areas for a specific project",
         description="Retrieves confirmed problem areas associated with interviews in a specific project.",
         response_model=Dict[str, Any],
        )
async def get_project_problem_areas(
    project_id: str,
    request: Request,
    user_payload: Dict[str, Any] = Depends(verify_token)
):
    """Proxy request to database service to get confirmed problem areas for a project."""
    user_id = get_user_id_from_payload(user_payload)
    if not user_id:
        logger.error("get_project_problem_areas: Validated token payload is missing user ID!")
        raise HTTPException(status_code=500, detail="Internal authentication error")

    logger.info(f"User {user_id} requesting confirmed problem areas for project {project_id}")
    forward_headers = {"X-Forwarded-User-ID": user_id}
    service_target_url = f"{DATABASE_SERVICE_URL}/projects/{project_id}/problem-areas"
    logger.debug(f"Calling DB Service: GET {service_target_url}")

    try:
        response = await call_authenticated_service(
            service_url=service_target_url,
            method="GET",
            headers=forward_headers
            # Potentially pass query params from request if needed later:
            # params=dict(request.query_params)
        )
        # Handle potential errors from the downstream service
        if isinstance(response, dict) and response.get("status") == "error":
            error_message = response.get("message", "Unknown error getting problem areas")
            status_code = response.get("statusCode", 500) # Use statusCode if provided by db service
            logger.error(f"Error from database service getting problem areas ({status_code}): {error_message}")
            # Use the status code from the downstream service if it's a client/server error, else 500
            effective_status_code = status_code if 400 <= status_code < 600 else 500
            raise HTTPException(status_code=effective_status_code, detail=f"Database service error: {error_message}")
        return response
    except httpx.TimeoutException:
        logger.error(f"Timeout calling database service for project problem areas")
        raise HTTPException(status_code=504, detail="Database service timeout")
    except httpx.ConnectError as e:
        logger.error(f"Connection error to database service for project problem areas: {str(e)}")
        raise HTTPException(status_code=503, detail=f"Cannot connect to database service: {str(e)}")
    except HTTPException as e:
        # Re-raise exceptions specifically raised by call_authenticated_service or validation
        raise e
    except Exception as e:
        logger.error(f"Unexpected error getting project problem areas: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Gateway error getting project problem areas: {str(e)}")

# NEW: GET Interviews for Project
@app.get("/api/projects/{project_id}/interviews",
         summary="Get interviews for a specific project",
         description="Retrieves interviews associated with a specific project.",
         response_model=Dict[str, Any],
        )
async def get_project_interviews(
    project_id: str,
    request: Request,
    user_payload: Dict[str, Any] = Depends(verify_token)
):
    """Proxy request to database service to get interviews for a project."""
    user_id = get_user_id_from_payload(user_payload)
    if not user_id:
        logger.error("get_project_interviews: Validated token payload is missing user ID!")
        raise HTTPException(status_code=500, detail="Internal authentication error")

    logger.info(f"User {user_id} requesting interviews for project {project_id}")
    forward_headers = {"X-Forwarded-User-ID": user_id}
    service_target_url = f"{DATABASE_SERVICE_URL}/projects/{project_id}/interviews"
    logger.debug(f"Calling DB Service: GET {service_target_url}")

    try:
        response = await call_authenticated_service(
            service_url=service_target_url,
            method="GET",
            headers=forward_headers
            # Potentially pass query params:
            # params=dict(request.query_params)
        )
        if isinstance(response, dict) and response.get("status") == "error":
            error_message = response.get("message", "Unknown error getting interviews")
            status_code = response.get("statusCode", 500)
            logger.error(f"Error from database service getting interviews ({status_code}): {error_message}")
            effective_status_code = status_code if 400 <= status_code < 600 else 500
            raise HTTPException(status_code=effective_status_code, detail=f"Database service error: {error_message}")
        return response
    except httpx.TimeoutException:
        logger.error(f"Timeout calling database service for project interviews")
        raise HTTPException(status_code=504, detail="Database service timeout")
    except httpx.ConnectError as e:
        logger.error(f"Connection error to database service for project interviews: {str(e)}")
        raise HTTPException(status_code=503, detail=f"Cannot connect to database service: {str(e)}")
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Unexpected error getting project interviews: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Gateway error getting project interviews: {str(e)}")

# Make sure the next section starts after these handlers, e.g.:
# # -------------------------------\n# Problem Area Endpoint Models (NEW)\n# -------------------------------

# --- NEW Persona Suggestion Endpoint ---
# ... existing suggest_interview_personas ...

# --- Interview Endpoints ---
# ... existing GET /api/interviews ...
# ... existing GET /api/interviews/{interview_id} ...
# ... existing PUT /api/interviews/{interview_id} ...
# ... existing DELETE /api/interviews/{interview_id} ...

# --- Project Endpoints ---
# ... existing GET /api/projects ...
# ... existing POST /api/projects ...

# ... existing suggest_interview_personas ...

# ... existing GET /api/interviews ...

# ... existing GET /api/interviews/{interview_id} ...

# ... existing PUT /api/interviews/{interview_id} ...

# ... existing DELETE /api/interviews/{interview_id} ...

# ... existing GET /api/projects ...

# ... existing POST /api/projects ...

# ... existing suggest_interview_personas ...

# ... existing GET /api/interviews ...

# ... existing GET /api/interviews/{interview_id} ...

# ... existing PUT /api/interviews/{interview_id} ...

# -------------------------------
# Problem Area Endpoint Models (Make sure these are defined earlier or here)
# -------------------------------
class UpdateProblemAreaRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, description="The new title for the problem area.")
    description: Optional[str] = Field(None, min_length=1, description="The new description for the problem area.")

    @validator('title', 'description', pre=True, always=True)
    def check_not_empty(cls, v):
        if isinstance(v, str) and not v.strip():
            raise ValueError("Field cannot be empty or just whitespace")
        return v

class ConfirmProblemAreaRequest(BaseModel):
    isConfirmed: bool = Field(..., description="The confirmation status.")
    priority: Optional[str] = Field(None, description="Optional priority (L, M, S). Send null to clear.")

# -------------------------------
# Problem Area Endpoints
# -------------------------------

@app.put("/api/problem_areas/{problem_area_id}",
         summary="Update a problem area",
         description="Updates the title or description of a specific problem area owned by the authenticated user.")
async def update_problem_area(
    problem_area_id: str,
    request: Request,
    update_data: UpdateProblemAreaRequest = Body(...),
    user_payload: Dict[str, Any] = Depends(verify_token)
):
    user_id = get_user_id_from_payload(user_payload)
    if not user_id:
        logger.error("update_problem_area: Could not extract user ID from token payload.")
        raise HTTPException(status_code=401, detail="Could not identify user from token.")
        
    logger.info(f"User {user_id} updating problem area {problem_area_id}")
    
    db_payload = update_data.model_dump(exclude_unset=True)
    if not db_payload:
         raise HTTPException(status_code=400, detail="No valid fields provided for update (title, description).")

    params = {"userId": user_id}
    forward_headers = {"X-Forwarded-User-ID": user_id}
    service_target_url = f"{DATABASE_SERVICE_URL}/problem_areas/{problem_area_id}"
    
    try:
        response = await call_authenticated_service(
            service_url=service_target_url,
            method="PUT",
            json_data=db_payload,
            params=params,
            headers=forward_headers
        )
        status_code = response.get("statusCode", 500)
        if response.get("status") == "success":
            logger.info(f"Successfully updated problem area '{problem_area_id}' via DB service for user {user_id}")
            return response
        else:
            error_message = response.get("message", "Failed to update problem area via database service")
            logger.error(f"Error response from database service updating problem area ({status_code}): {error_message}")
            raise HTTPException(status_code=status_code, detail=error_message)
    except httpx.RequestError as exc:
        logger.error(f"HTTP RequestError calling database service to update problem area: {exc}")
        raise HTTPException(status_code=503, detail=f"Error communicating with database service: {exc}")
    except Exception as e:
        logger.error(f"Unexpected error updating problem area {problem_area_id}: {e}", exc_info=DEBUG)
        raise HTTPException(status_code=500, detail="Internal server error updating problem area")

# --- ADDED MISSING PATCH ROUTE --- 
@app.patch("/api/problem_areas/{problem_area_id}/confirm",
           summary="Confirm or unconfirm a problem area",
           description="Sets the confirmation status and optionally the priority of a specific problem area owned by the authenticated user.")
async def confirm_problem_area(
    problem_area_id: str,
    request: Request,
    confirm_data: ConfirmProblemAreaRequest = Body(...),
    user_payload: Dict[str, Any] = Depends(verify_token)
):
    user_id = get_user_id_from_payload(user_payload)
    if not user_id:
        logger.error("confirm_problem_area: Could not extract user ID from token payload.")
        raise HTTPException(status_code=401, detail="Could not identify user from token.")
        
    logger.info(f"User {user_id} setting confirmation for problem area {problem_area_id} to {confirm_data.isConfirmed} with priority {confirm_data.priority}")
    
    db_payload = confirm_data.model_dump() 
    logger.info(f"Payload being sent to DB service for confirm: {db_payload}")

    params = {"userId": user_id}
    forward_headers = {"X-Forwarded-User-ID": user_id}
    service_target_url = f"{DATABASE_SERVICE_URL}/problem_areas/{problem_area_id}/confirm"
    
    try:
        response = await call_authenticated_service(
            service_url=service_target_url,
            method="PATCH",
            json_data=db_payload,
            params=params,
            headers=forward_headers
        )
        status_code = response.get("statusCode", 500)
        if response.get("status") == "success":
            logger.info(f"Successfully set confirmation for problem area '{problem_area_id}' via DB service for user {user_id}")
            return response
        else:
            error_message = response.get("message", "Failed to confirm problem area via database service")
            logger.error(f"Error response from database service confirming problem area ({status_code}): {error_message}")
            raise HTTPException(status_code=status_code, detail=error_message)
    except httpx.RequestError as exc:
        logger.error(f"HTTP RequestError calling database service to confirm problem area: {exc}")
        raise HTTPException(status_code=503, detail=f"Error communicating with database service: {exc}")
    except Exception as e:
        logger.error(f"Unexpected error confirming problem area {problem_area_id}: {e}", exc_info=DEBUG)
        raise HTTPException(status_code=500, detail="Internal server error confirming problem area")

@app.delete("/api/problem_areas/{problem_area_id}",
            summary="Delete a problem area",
            description="Deletes a specific problem area owned by the authenticated user.",
            status_code=200)
async def delete_problem_area(
    problem_area_id: str,
    request: Request,
    user_payload: Dict[str, Any] = Depends(verify_token)
):
    user_id = get_user_id_from_payload(user_payload)
    if not user_id:
        logger.error("delete_problem_area: Could not extract user ID from token payload.")
        raise HTTPException(status_code=401, detail="Could not identify user from token.")
        
    logger.info(f"User {user_id} deleting problem area {problem_area_id}")
    
    params = {"userId": user_id}
    forward_headers = {"X-Forwarded-User-ID": user_id}
    service_target_url = f"{DATABASE_SERVICE_URL}/problem_areas/{problem_area_id}"
    
    try:
        response = await call_authenticated_service(
            service_url=service_target_url,
            method="DELETE",
            params=params,
            headers=forward_headers
        )
        status_code = response.get("statusCode", 500)
        if response.get("status") == "success":
            logger.info(f"Successfully deleted problem area '{problem_area_id}' via DB service for user {user_id}")
            return response
        else:
            error_message = response.get("message", "Failed to delete problem area via database service")
            logger.error(f"Error response from database service deleting problem area ({status_code}): {error_message}")
            raise HTTPException(status_code=status_code, detail=error_message)
    except httpx.RequestError as exc:
        logger.error(f"HTTP RequestError calling database service to delete problem area: {exc}")
        raise HTTPException(status_code=503, detail=f"Error communicating with database service: {exc}")
    except Exception as e:
        logger.error(f"Unexpected error deleting problem area {problem_area_id}: {e}", exc_info=DEBUG)
        raise HTTPException(status_code=500, detail="Internal server error deleting problem area")

# --- NEW: PUT /api/projects/{project_id} --- #

class UpdateProjectRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, description="The updated name of the project.")
    description: Optional[str] = Field(None, description="The updated optional one-line description for the project. Can be set to null or omitted.")

    # Validator to ensure at least one field is present
    @validator('description', always=True)
    def check_at_least_one_field(cls, v, values):
        if values.get('name') is None and v is None:
            raise ValueError('At least name or description must be provided')
        return v

@app.put("/api/projects/{project_id}",
        summary="Update a project",
        description="Updates the name and/or description of a specific project owned by the authenticated user.",
        response_model=Dict[str, Any], # Assuming success response like {status:'success', data: Project}
       )
async def update_project(
    project_id: str,
    request: Request,
    update_data: UpdateProjectRequest = Body(...),
    user_payload: Dict[str, Any] = Depends(verify_token)
):
    """Proxy project update request to database service with authentication."""
    user_id = get_user_id_from_payload(user_payload)
    if not user_id:
        logger.error("update_project: Validated token payload is missing user ID!")
        raise HTTPException(status_code=500, detail="Internal authentication error")

    logger.info(f"User {user_id} attempting to update project {project_id}")

    # Prepare payload for DB service - only include fields that are not None
    # Use exclude_unset=True to only send fields explicitly provided in the request
    db_payload = update_data.model_dump(exclude_unset=True)

    if not db_payload: # Should be caught by Pydantic model validator, but double-check
        logger.warning(f"Update request for project {project_id} has no fields to update.")
        raise HTTPException(status_code=400, detail="No fields provided for update.")

    # Prepare headers for downstream service
    forward_headers = {"X-Forwarded-User-ID": user_id}
    logger.debug(f"Forwarding headers to DB service: {list(forward_headers.keys())}")

    # DB service expects userId as a query parameter for PUT authorization
    params = {"userId": user_id}

    service_target_url = f"{DATABASE_SERVICE_URL}/projects/{project_id}"
    logger.debug(f"Calling DB Service: PUT {service_target_url}")

    try:
        response = await call_authenticated_service(
            service_url=service_target_url,
            method="PUT",
            json_data=db_payload,
            params=params, # Pass userId in params
            headers=forward_headers
        )

        # Try to get status code from DB response, default to 500 if missing
        status_code = response.get("statusCode", 500)

        if response.get("status") == "success":
            logger.info(f"Successfully updated project {project_id} via DB service for user {user_id}")
            return response # Forward the successful response
        else:
            error_message = response.get("message", "Failed to update project via database service")
            logger.error(f"Error response from database service updating project ({status_code}): {error_message}")
            # Handle specific errors like 404, 403, 409 from DB service
            effective_status_code = status_code if 400 <= status_code < 600 else 500
            raise HTTPException(status_code=effective_status_code, detail=f"Database service error: {error_message}")

    except httpx.RequestError as exc:
        logger.error(f"HTTP RequestError calling database service to update project: {exc}")
        raise HTTPException(status_code=503, detail=f"Error communicating with database service: {exc}")
    except Exception as e:
        logger.error(f"Unexpected error updating project {project_id}: {e}", exc_info=DEBUG)
        raise HTTPException(status_code=500, detail="Internal server error updating project")


# --- NEW: DELETE /api/projects/{project_id} --- #

@app.delete("/api/projects/{project_id}",
            summary="Delete a project",
            description="Deletes a specific project owned by the authenticated user. Use ?force=true to delete the project even if it contains interviews (this will delete associated interviews and problem areas).",
            status_code=200) # Or 204 if no content is returned
async def delete_project(
    project_id: str,
    request: Request,
    force: bool = False, # Add force query parameter
    user_payload: Dict[str, Any] = Depends(verify_token)
):
    """Proxy project deletion request to database service with authentication."""
    user_id = get_user_id_from_payload(user_payload)
    if not user_id:
        logger.error("delete_project: Validated token payload is missing user ID!")
        raise HTTPException(status_code=500, detail="Internal authentication error")

    logger.info(f"User {user_id} attempting to delete project {project_id}{' (FORCE)' if force else ''}")

    # Prepare headers for downstream service
    forward_headers = {"X-Forwarded-User-ID": user_id}
    logger.debug(f"Forwarding headers to DB service: {list(forward_headers.keys())}")

    # DB service expects userId and potentially force as query parameters
    params = {"userId": user_id}
    if force:
        params["force"] = "true"

    service_target_url = f"{DATABASE_SERVICE_URL}/projects/{project_id}"
    logger.debug(f"Calling DB Service: DELETE {service_target_url} with params: {params}")

    try:
        response = await call_authenticated_service(
            service_url=service_target_url,
            method="DELETE",
            params=params, # Pass userId and force params
            headers=forward_headers
        )

        # Check if the call itself failed or returned an error structure
        if response.get("status") == "error":
            # Extract details from the error response returned by call_authenticated_service
            error_message = response.get("message", "Unknown error from database service")
            # Attempt to parse the original status code from the error message if possible
            # Example: "Service returned 409: ..."
            original_status_code = 500 # Default
            if isinstance(error_message, str) and error_message.startswith("Service returned "):
                try:
                    parts = error_message.split(':', 1)
                    code_part = parts[0].split()[-1]
                    original_status_code = int(code_part)
                except (ValueError, IndexError):
                    pass # Keep default 500 if parsing fails
            
            logger.error(f"Error response relayed from database service deleting project (Original Status: {original_status_code}): {error_message}")
            
            # Determine effective status code to return to the client
            effective_status_code = original_status_code if 400 <= original_status_code < 600 else 500
            
            # Extract detail/message for HTTPException
            # Use the specific message if it's a 409 conflict, otherwise use the extracted message
            if effective_status_code == 409 and "interviews" in error_message:
                 # Try to get the more specific message part after the status code string
                 try:
                    detail = error_message.split(':', 1)[1].strip()
                    # Attempt to parse JSON detail if present (like the 409 response)
                    try: 
                       json_detail = json.loads(detail)
                       exception_detail = json_detail.get("message", detail) # Use parsed message if available
                    except json.JSONDecodeError:
                       exception_detail = detail # Use raw detail if not JSON
                 except IndexError:
                    exception_detail = error_message # Fallback to full message
            else:
                 exception_detail = f"Database service error: {error_message}"

            raise HTTPException(status_code=effective_status_code, detail=exception_detail)
        
        # If call_authenticated_service did not return an error status, assume success
        # (This path might be taken if DB service returns 2xx but not the exact "success" status field)
        elif response.get("status") == "success": # Handle explicit success from DB
             success_msg = response.get("message", f"Successfully deleted project {project_id}")
             logger.info(f"{success_msg} via DB service for user {user_id}")
             return response
        else:
             # Fallback for unexpected successful response format from DB service
             logger.warning(f"Received unexpected successful response format from DB service: {response}")
             return response # Forward it anyway

    except httpx.RequestError as exc:
        logger.error(f"HTTP RequestError calling database service to delete project: {exc}")
        raise HTTPException(status_code=503, detail=f"Error communicating with database service: {exc}")
    except HTTPException as http_exc:
        # Re-raise HTTPExceptions explicitly to prevent them being caught by the generic Exception handler
        raise http_exc
    except Exception as e:
        logger.error(f"Unexpected error deleting project {project_id}: {e}", exc_info=DEBUG)
        raise HTTPException(status_code=500, detail="Internal server error deleting project")

