from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router as api_router
from app.config.logging_config import setup_logging
from app.config.settings import settings
import logging

# Initialize logging
setup_logging()
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Sprint 1 Deprecated API",
    description="Legacy endpoints for preprocessing, summarization, and keyword extraction",
    version="1.0.0"
)

# Get CORS origins from settings
cors_origins = settings.CORS_ORIGINS
logger.info(f"Using CORS_ORIGINS: {cors_origins}")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include main router
app.include_router(api_router, prefix="/api/sprint1_deprecated")

@app.get("/",
        summary="Sprint 1 Deprecated Service Information",
        description="Returns information about the Sprint 1 Deprecated service and its endpoints.",
        responses={
            200: {
                "description": "Basic service information",
                "content": {
                    "application/json": {
                        "example": {
                            "status": "online",
                            "version": "1.0.0",
                            "service": "sprint1_deprecated",
                            "endpoints": {
                                "preprocessing": "/api/sprint1_deprecated/preprocess",
                                "summarization": "/api/sprint1_deprecated/summarize",
                                "keyword_extraction": "/api/sprint1_deprecated/keywords"
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
        "service": "sprint1_deprecated",
        "endpoints": {
            "preprocessing": "/api/sprint1_deprecated/preprocess",
            "summarization": "/api/sprint1_deprecated/summarize",
            "keyword_extraction": "/api/sprint1_deprecated/keywords"
        }
    }

@app.on_event("startup")
async def startup_event():
    logger.info("Sprint 1 Deprecated Service starting up")
    logger.info(f"Debug mode: {settings.DEBUG}")
    logger.info(f"CORS Origins: {cors_origins}")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Sprint 1 Deprecated Service shutting down")

# Run the application if executed directly
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8002, reload=True) 