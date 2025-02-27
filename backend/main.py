import uvicorn
from fastapi import FastAPI, UploadFile, File, HTTPException

from Summarization.summarization import router as summarize_interview
from Preprocessing.Preprocessing_FastAPI import router as preprocess_vtt
from Keyword_Extraction.Keyword_FastAPI import router as analyze_transcript

app = FastAPI()

@app.get("/")
async def root():
    return {"message": "FastAPI is running!"}

app.include_router(analyze_transcript) 
app.include_router(summarize_interview) 
app.include_router(preprocess_vtt) 

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
    
