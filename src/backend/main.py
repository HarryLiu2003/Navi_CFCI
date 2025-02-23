import uvicorn
from fastapi import FastAPI, UploadFile, File, HTTPException
from apis.summarization import summarize_interview

app = FastAPI()

async def read_file(file: UploadFile) -> str:
    """
    Reads and decodes an uploaded file.
    """
    try:
        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Uploaded file is empty")
        return contents.decode("utf-8")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")

@app.get("/")
async def root():
    return {"message": "FastAPI is running!"}

@app.post("/upload/")
async def upload_file(file: UploadFile = File(...)):
    """
    Upload a file and return its contents.
    """
    return await read_file(file)

@app.post("/summarize/")
async def summarize_transcript(file: UploadFile = File(...)):
    """
    Summarizes the uploaded transcript file.
    """
    try:
        model_configuration = "./config/model_configs.json"
        transcript_text = await read_file(file)
        model = "mistral"
        
        result = summarize_interview(model, transcript_text, model_configuration)
        text = result["choices"][0]["message"]["content"]

        return text
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Summarization failed: {str(e)}")

@app.post("/extract_pain_points/")
async def extract_pain_points(file: UploadFile = File(...)):
    """
    Extracts pain points and user demands from the uploaded transcript file.
    """
    try:
        transcript_text = await read_file(file)
        # pain point extraction logic here
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pain points extraction failed: {str(e)}")

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
    
