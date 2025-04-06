from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from .api.routes import router as analysis_router
from .config.logging_config import setup_logging
from .config.settings import settings
import logging
import os
import sys
import time
import uuid
from typing import List, Dict, Any
import httpx

# Initialize logging
setup_logging()
logger = logging.getLogger(__name__)

# Simple circuit breaker implementation
class CircuitBreaker:
    def __init__(self, name: str, failure_threshold: int = 5, reset_timeout: int = 30):
        self.name = name
        self.failure_count = 0
        self.failure_threshold = failure_threshold
        self.reset_timeout = reset_timeout
        self.is_open = False
        self.last_failure_time = None
    
    def record_failure(self):
        self.failure_count += 1
        self.last_failure_time = time.time()
        if self.failure_count >= self.failure_threshold:
            self.is_open = True
            logger.warning(f"Circuit breaker '{self.name}' is now OPEN")
    
    def record_success(self):
        if self.is_open:
            self.reset()
    
    def reset(self):
        self.failure_count = 0
        self.is_open = False
        logger.info(f"Circuit breaker '{self.name}' has been RESET")
    
    def can_execute(self) -> bool:
        if not self.is_open:
            return True
        
        if self.last_failure_time and time.time() - self.last_failure_time > self.reset_timeout:
            logger.info(f"Circuit breaker '{self.name}' timeout period elapsed, allowing trial execution")
            return True
        
        return False

# Create circuit breakers for critical services
database_circuit = CircuitBreaker("database_api")
gemini_circuit = CircuitBreaker("gemini_api")

# Log startup information
logger.info("Starting up Interview Analysis service...")
port = os.environ.get("PORT", "8080")
logger.info(f"Environment variables: PORT={port}")

# Create the FastAPI app
app = FastAPI(
    title="Interview Analysis API",
    description="Core interview analysis service",
    version="1.0.0"
)
logger.info("FastAPI app created successfully")

# Configure CORS based on environment
is_production = os.getenv("NODE_ENV", "development") == "production"
is_development = not is_production
debug_mode = settings.DEBUG

# Parse CORS origins string into a list
cors_origins_str = settings.CORS_ORIGINS
cors_origins = [origin.strip() for origin in cors_origins_str.split(",")] if cors_origins_str else ["http://localhost:3000"]
logger.info(f"Using CORS_ORIGINS: {cors_origins}")

# Log CORS origins if in development or debug mode
if is_development or debug_mode:
    logger.info(f"[{is_production and 'PRODUCTION' or 'DEVELOPMENT'}] CORS allowed origins: {cors_origins}")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
logger.info("CORS middleware added successfully")

# Add request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    request_id = str(uuid.uuid4())
    start_time = time.time()
    
    # Add request ID to request state for logging
    request.state.request_id = request_id
    
    logger.info(f"[{request_id}] Request started: {request.method} {request.url.path}")
    
    try:
        response = await call_next(request)
        process_time = (time.time() - start_time) * 1000
        logger.info(f"[{request_id}] Request completed: {request.method} {request.url.path} - Status: {response.status_code} - Duration: {process_time:.2f}ms")
        return response
    except Exception as e:
        process_time = (time.time() - start_time) * 1000
        logger.error(f"[{request_id}] Request failed: {request.method} {request.url.path} - Duration: {process_time:.2f}ms - Error: {str(e)}")
        raise
        
# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    logger.error(f"[{request_id}] Unhandled exception: {str(exc)}", exc_info=True)
    
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "message": "An unexpected error occurred while processing your request",
            "request_id": request_id,
            "detail": str(exc) if settings.DEBUG else None
        }
    )

# Include routers
app.include_router(analysis_router, prefix="/api/interview_analysis")
logger.info("API router included successfully")

@app.get("/",
        summary="Interview Analysis Service Information",
        description="Returns information about the Interview Analysis service and its endpoints.",
        responses={
            200: {
                "description": "Basic service information",
                "content": {
                    "application/json": {
                        "example": {
                            "status": "online",
                            "version": "1.0.0",
                            "service": "interview_analysis",
                            "endpoints": {
                                "analyze": "/api/interview_analysis/analyze"
                            }
                        }
                    }
                }
            }
        })
async def root():
    logger.info("Root endpoint accessed")
    return {
        "status": "online",
        "version": "1.0.0",
        "service": "interview_analysis",
        "endpoints": {
            "analyze": "/api/interview_analysis/analyze"
        }
    }

@app.get("/health")
async def health_check():
    """Comprehensive health check that verifies all dependencies."""
    try:
        health_status = {
            "status": "healthy",
            "dependencies": {}
        }
        
        # Check database API connectivity
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{settings.DATABASE_API_URL}/health")
                if response.status_code == 200:
                    health_status["dependencies"]["database_api"] = "ok"
                else:
                    health_status["dependencies"]["database_api"] = f"error: status code {response.status_code}"
        except Exception as e:
            health_status["dependencies"]["database_api"] = f"error: {str(e)}"
        
        # Check Gemini API key is set
        if settings.GEMINI_API_KEY:
            health_status["dependencies"]["gemini_api_key"] = "set"
        else:
            health_status["dependencies"]["gemini_api_key"] = "missing"
            
        # Overall health status
        all_dependencies_ok = all(
            status == "ok" or status == "set" 
            for status in health_status["dependencies"].values()
        )
        
        if not all_dependencies_ok:
            health_status["status"] = "degraded"
            return JSONResponse(
                status_code=200,  # Still return 200 so Cloud Run doesn't kill the instance
                content=health_status
            )
            
        return health_status
        
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return JSONResponse(
            status_code=200,  # Still return 200 so Cloud Run doesn't kill the instance
            content={"status": "unhealthy", "error": str(e)}
        )

@app.on_event("startup")
async def startup_event():
    logger.info("Interview Analysis Service starting up")
    logger.info(f"Running with PORT: {os.environ.get('PORT', '8080')}")
    logger.info(f"Debug mode: {debug_mode}")
    logger.info(f"Environment: {os.getenv('NODE_ENV', 'development')}")
    logger.info(f"CORS Origins: {cors_origins}")
    logger.info(f"Database API URL: {settings.DATABASE_API_URL}")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Interview Analysis Service shutting down")

# Run the application if executed directly
if __name__ == "__main__":
    import uvicorn
    port_num = int(os.environ.get("PORT", 8080))
    logger.info(f"Starting server on port {port_num}")
    uvicorn.run("app.main:app", host="0.0.0.0", port=port_num, log_level="info") 