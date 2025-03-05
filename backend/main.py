import uvicorn
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from Summarization.summarization import router as summarize_router
from Preprocessing.preprocessing import router as preprocess_router
from Keyword_Extraction.keyword_extraction import router as keyword_router
from Interview_Analysis import names_router, analysis_router
from Interview_Analysis.transcript_analysis import router as analysis_router

app = FastAPI(
    title="Interview Analysis API",
    description="API for processing and analyzing interview transcripts",
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

@app.get("/")
async def root():
    return {
        "status": "online",
        "version": "1.0.0",
        "endpoints": {
            "preprocessing": "/preprocess",
            "summarization": "/summarize",
            "keyword_extraction": "/keywords",
            "interview_analysis": "/interview"
        },
        "documentation": "/docs",
        "openapi": "/openapi.json"
    }

app.include_router(
    preprocess_router,
    prefix="/preprocess",
    tags=["preprocessing"]
)
app.include_router(
    summarize_router,
    prefix="/summarize",
    tags=["summarization"]
)
app.include_router(
    keyword_router,
    prefix="/keywords",
    tags=["keywords"]
)
app.include_router(
    names_router,
    prefix="/interview",
    tags=["participant_extraction"]
)
app.include_router(analysis_router)

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
    
