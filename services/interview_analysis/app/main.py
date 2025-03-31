from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.routes import router as analysis_router
from .config.logging_config import setup_logging
import logging

# Initialize logging
setup_logging()
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Interview Analysis API",
    description="Core interview analysis service",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Your Next.js frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(analysis_router, prefix="/api/interview_analysis")

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

@app.on_event("startup")
async def startup_event():
    logger.info("Interview Analysis Service starting up")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Interview Analysis Service shutting down")

# Run the application if executed directly
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True) 