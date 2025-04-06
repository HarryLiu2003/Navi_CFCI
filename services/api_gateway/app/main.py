from fastapi import FastAPI, UploadFile, File, HTTPException, Request, Form, Depends
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

            # Add token to headers if available
            headers = {}
            if token:
                headers["Authorization"] = f"Bearer {token}"
                logger.debug(f"Using fetched authentication token for {target_audience}")
            else:
                logger.warning(f"Proceeding with call to {target_audience} WITHOUT authentication token.")

            # Make authenticated request
            timeout = 60.0
            async with httpx.AsyncClient(timeout=timeout) as client:
                logger.debug(f"Initiating {method.upper()} request to {service_url}...")
                start_request = time.time()
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
    file: UploadFile = File(...),
    project_id: Optional[str] = Form(None),
    interviewer: Optional[str] = Form(None),
    interview_date: Optional[str] = Form(None),
    user_payload: Dict[str, Any] = Depends(verify_token)
):
    """Forward analyze transcript request to interview analysis service."""
    try:
        # Read file content
        file_content = await file.read()
        
        # Prepare files and form data for httpx
        files = {"file": (file.filename, file_content, file.content_type)}
        
        # Prepare form data
        form_data = {}
        if project_id:
            form_data["project_id"] = project_id
        if interviewer:
            form_data["interviewer"] = interviewer
        if interview_date:
            form_data["interview_date"] = interview_date
        
        # Use userId from the validated token payload
        token_user_id = get_user_id_from_payload(user_payload)
        if not token_user_id:
             # This case should technically not happen if verify_token requires 'sub'
             logger.error("analyze_interview: Validated token payload is missing user ID!")
             raise HTTPException(status_code=500, detail="Internal authentication error")
        
        form_data["userId"] = token_user_id
        logger.info(f"Using authenticated user ID: {token_user_id}")
        
        # Forward to interview analysis service with authentication
        endpoint_url = f"{INTERVIEW_ANALYSIS_URL}/api/interview_analysis/analyze"
        logger.info(f"Calling Interview Analysis service at: {endpoint_url}")
        
        # Use the authenticated service call function
        response_data = await call_authenticated_service(
            service_url=endpoint_url,
            method="POST",
            files=files,
            data=form_data
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
    """
    Protected endpoint that requires authentication.
    Returns the authenticated user's information.
    """
    return {
        "userId": get_user_id_from_payload(payload),
        "isAuthenticated": True,
        "timestamp": time.time()
    }

# Database service endpoints through the API Gateway

@app.get("/api/interviews",
        summary="Get interviews with pagination",
        description="Retrieves a paginated list of interviews for the authenticated user.")
async def get_interviews(
    request: Request,
    limit: Optional[int] = 10,
    offset: Optional[int] = 0,
    user_payload: Optional[dict] = Depends(get_optional_user)
):
    """Proxy interviews list request to database service with authentication."""
    logger.info(f"get_interviews: Handler invoked. Limit={limit}, Offset={offset}")
    try:
        user_id = get_user_id_from_payload(user_payload) 
        logger.info(f"get_interviews: User ID extracted: {user_id}")
        
        # Enforce authentication: Raise 401 if no valid user_id was obtained
        if not user_id:
            logger.warning("get_interviews: No valid user ID found. Raising 401.")
            raise HTTPException(status_code=401, detail="Authentication required")
        
        logger.info(f"Fetching interviews for user: {user_id} with limit: {limit}, offset: {offset}")
        
        # Build the request URL with parameters
        params = {
            "limit": str(limit),
            "offset": str(offset),
            "userId": user_id
        }
        
        # Forward to database service with authentication
        endpoint_url = f"{DATABASE_SERVICE_URL}/interviews"
        logger.info(f"Calling database service at: {endpoint_url} with params: {params}")
        
        response_data = await call_authenticated_service(
            service_url=endpoint_url,
            method="GET",
            params=params
        )
        
        if response_data.get("status") == "error":
            error_message = response_data.get("message", "Unknown error")
            logger.error(f"Error from database service when getting interviews: {error_message}")
            raise HTTPException(status_code=500, detail=f"Database service error: {error_message}")
        
        logger.debug(f"Successfully received interviews data: {response_data}")
        return response_data
        
    except HTTPException as http_exc: # Re-raise specific HTTP exceptions
        raise http_exc 
    except Exception as e:
        logger.error(f"Error processing get_interviews request: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Gateway error: {str(e)}")

@app.get("/api/interviews/{interview_id}",
        summary="Get interview details",
        description="Retrieves details of a specific interview by ID for the authenticated user.")
async def get_interview_details(
    interview_id: str,
    request: Request,
    user_payload: Dict[str, Any] = Depends(verify_token)
):
    """Proxy interview details request to database service with authentication."""
    try:
        # Get user ID from the *validated* token payload
        user_id = get_user_id_from_payload(user_payload)
        
        logger.info(f"Attempting to fetch details for interview ID: {interview_id}, User ID: {user_id}")
        
        # Check if user_id was successfully extracted (should always be true if verify_token succeeded)
        if not user_id:
            logger.error("Validated token payload is missing user ID! This shouldn't happen.")
            raise HTTPException(status_code=500, detail="Internal authentication processing error")
            
        # Build the request parameters
        params = {"userId": user_id}
        
        # Forward to database service with authentication
        endpoint_url = f"{DATABASE_SERVICE_URL}/interviews/{interview_id}"
        logger.info(f"Calling database service at: {endpoint_url} with params: {params}")
        
        response_data = await call_authenticated_service(
            service_url=endpoint_url,
            method="GET",
            params=params
        )
        
        if response_data.get("status") == "error":
            error_message = response_data.get("message", "Unknown error")
            logger.error(f"Error from database service for interview {interview_id}: {error_message}")
            status_code = 500
            if "not found" in error_message.lower():
                status_code = 404
            elif "not authorized" in error_message.lower(): # Should userId check prevent this?
                status_code = 403
            raise HTTPException(status_code=status_code, detail=f"Database service error: {error_message}")
        
        logger.debug(f"Successfully received details for interview {interview_id}: {response_data}")
        return response_data
        
    except HTTPException as http_exc: # Re-raise specific HTTP exceptions
        raise http_exc
    except Exception as e:
        logger.error(f"Error processing get_interview_details request: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Gateway error: {str(e)}")

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