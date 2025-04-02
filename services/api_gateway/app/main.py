from fastapi import FastAPI, UploadFile, File, HTTPException, Request, Form
from fastapi.middleware.cors import CORSMiddleware
import httpx
import os
import logging
import traceback
import time
import uuid
from typing import Optional
from io import BytesIO

# Configure logging with level from environment variable
log_level_name = os.getenv("LOG_LEVEL", "INFO")
log_level = getattr(logging, log_level_name.upper(), logging.INFO)
logging.basicConfig(level=log_level, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)
logger.info(f"Logging configured with level: {log_level_name}")

# Get debug mode from environment
DEBUG = os.getenv("DEBUG", "False").lower() == "true"
logger.info(f"Debug mode: {DEBUG}")

# Get service URLs from environment
INTERVIEW_ANALYSIS_URL = os.getenv("SERVICE_INTERVIEW_ANALYSIS", "http://interview_analysis:8001")
SPRINT1_DEPRECATED_URL = os.getenv("SERVICE_SPRINT1_DEPRECATED", "http://sprint1_deprecated:8002")

# Get CORS configuration from environment
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
logger.info(f"Allowing CORS from origins: {CORS_ORIGINS}")

app = FastAPI(
    title="Transcript Analysis API Gateway",
    description="API Gateway for transcript analysis services",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,  # Now using environment variable
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create an HTTP client for forwarding requests
http_client = httpx.AsyncClient(timeout=60.0)

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
         description="Upload a VTT file to analyze an interview transcript and extract key insights.")
async def analyze_interview(
    file: UploadFile = File(...),
    project_id: Optional[str] = Form(None),
    interviewer: Optional[str] = Form(None),
    interview_date: Optional[str] = Form(None)
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
        
        # Forward to interview analysis service
        response = await http_client.post(
            f"{INTERVIEW_ANALYSIS_URL}/api/interview_analysis/analyze",
            files=files,
            data=form_data
        )
        
        # Check if response is successful
        if response.status_code < 200 or response.status_code >= 300:
            error_text = response.text
            logger.error(f"Error response from interview analysis service: {error_text}")
            raise HTTPException(status_code=response.status_code, detail=f"Interview analysis service error: {error_text}")
        
        # Return the JSON response
        return response.json()
    except httpx.TimeoutException:
        logger.error("Timeout while connecting to interview analysis service")
        raise HTTPException(status_code=504, detail="Interview analysis service timeout")
    except httpx.ConnectError as e:
        logger.error(f"Connection error to interview analysis service: {str(e)}")
        raise HTTPException(status_code=503, detail=f"Cannot connect to interview analysis service: {str(e)}")
    except Exception as e:
        logger.error(f"Error forwarding to interview analysis service: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Gateway error: {str(e)}")

@app.post("/api/sprint1_deprecated/keywords",
         summary="Extract keywords from a transcript",
         description="Upload a VTT file to extract key terms and phrases from an interview transcript.",
         responses={
             200: {
                 "description": "Successfully extracted keywords",
                 "content": {
                     "application/json": {
                         "example": {
                             "status": "success",
                             "message": "Keywords extracted successfully",
                             "data": {
                                 "keywords": [
                                     {"term": "user experience", "frequency": 12, "relevance": 0.85},
                                     {"term": "mobile app", "frequency": 8, "relevance": 0.75},
                                     {"term": "performance issues", "frequency": 6, "relevance": 0.9}
                                 ],
                                 "metadata": {
                                     "transcript_length": 1000,
                                     "processing_time": "2.5s"
                                 }
                             }
                         }
                     }
                 }
             },
             500: {
                 "description": "Internal Server Error",
                 "content": {
                     "application/json": {
                         "example": {
                             "status": "error",
                             "message": "Gateway error: [error details]"
                         }
                     }
                 }
             }
         })
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
         responses={
             200: {
                 "description": "Successfully summarized transcript",
                 "content": {
                     "application/json": {
                         "example": {
                             "status": "success",
                             "message": "Transcript summarized successfully",
                             "data": {
                                 "summary": "The participant discussed challenges with the current mobile app, highlighting performance issues and user experience concerns. They suggested several improvements including streamlined navigation and faster load times.",
                                 "metadata": {
                                     "transcript_length": 1000,
                                     "summary_length": 150,
                                     "processing_time": "3.2s"
                                 }
                             }
                         }
                     }
                 }
             },
             500: {
                 "description": "Internal Server Error",
                 "content": {
                     "application/json": {
                         "example": {
                             "status": "error",
                             "message": "Gateway error: [error details]"
                         }
                     }
                 }
             }
         })
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
         responses={
             200: {
                 "description": "Successfully preprocessed transcript",
                 "content": {
                     "application/json": {
                         "example": {
                             "status": "success",
                             "message": "Transcript preprocessed successfully",
                             "data": {
                                 "chunks": [
                                     {
                                         "chunk_number": 1,
                                         "speaker": "Interviewer",
                                         "text": "Can you tell me about your experience with our product?"
                                     },
                                     {
                                         "chunk_number": 2,
                                         "speaker": "Participant",
                                         "text": "I've been using it for about six months now and overall it's been positive."
                                     }
                                 ],
                                 "metadata": {
                                     "total_chunks": 50,
                                     "speakers": ["Interviewer", "Participant"],
                                     "processing_time": "1.5s"
                                 }
                             }
                         }
                     }
                 }
             },
             500: {
                 "description": "Internal Server Error",
                 "content": {
                     "application/json": {
                         "example": {
                             "status": "error",
                             "message": "Gateway error: [error details]"
                         }
                     }
                 }
             }
         })
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

@app.on_event("startup")
async def startup_event():
    logger.info("API Gateway starting up")

@app.on_event("shutdown")
async def shutdown_event():
    await http_client.aclose()
    logger.info("API Gateway shutting down") 