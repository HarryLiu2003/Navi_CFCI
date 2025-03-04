from fastapi import FastAPI, HTTPException, APIRouter, UploadFile, File
from utils.api_responses import APIResponse
from pydantic import BaseModel
from typing import List
import re
import tiktoken
from nltk.tokenize import sent_tokenize
import nltk
from typing import Union

# Download NLTK data once at module level
nltk.download('punkt', quiet=True)

router = APIRouter()

class TranscriptPreprocessor:
    def __init__(self, model_name="gpt-4", max_tokens=512):
        try:
            self.tokenizer = tiktoken.encoding_for_model(model_name)
        except Exception as e:
            raise ValueError(f"Failed to initialize tokenizer for model {model_name}: {str(e)}")
        if max_tokens <= 0:
            raise ValueError("max_tokens must be positive")
        self.max_tokens = max_tokens

    async def read_vtt_file(self, file: UploadFile) -> str:
        """Read and convert VTT file content to plain text."""
        content = await file.read()
        text = content.decode('utf-8')
        return self.read_vtt(text)

    def read_vtt(self, content: str) -> str:
        """Convert VTT content to plain text."""
        lines = content.split("\n")
        text_lines = [
            line.strip() for line in lines 
            if line.strip() and 
            not line.strip().isdigit() and 
            '-->' not in line and 
            not line.startswith('WEBVTT')
        ]
        return " ".join(text_lines)

    def clean_transcript(self, text: str) -> str:
        """Clean and normalize transcript text."""
        text = re.sub(r'\b[A-Z][a-z]+\s[A-Z][a-z]+:\s', '', text)  # Remove speaker labels
        text = re.sub(r'\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}', '', text)  # Remove timestamps
        text = re.sub(r'\[.*?\]', '', text)  # Remove bracketed content
        text = re.sub(r'\s+', ' ', text).strip()  # Normalize whitespace
        return text.lower()

    def chunk_text(self, text: str) -> list:
        """Split text into chunks based on token limit."""
        sentences = sent_tokenize(text)
        chunks = []
        current_chunk = []
        current_length = 0
        
        for sentence in sentences:
            token_length = len(self.tokenizer.encode(sentence))
            
            if current_length + token_length > self.max_tokens:
                if current_chunk:
                    chunks.append(" ".join(current_chunk))
                current_chunk = [sentence]
                current_length = token_length
            else:
                current_chunk.append(sentence)
                current_length += token_length
        
        if current_chunk:
            chunks.append(" ".join(current_chunk))
        
        return chunks

preprocessor = TranscriptPreprocessor()

@router.post("/", 
    summary="Preprocess VTT Transcript",
    description="Convert VTT transcript to cleaned text chunks for analysis",
    tags=["preprocessing"],
    responses={
        200: {
            "description": "Successfully preprocessed VTT transcript",
            "content": {
                "application/json": {
                    "example": {
                        "status": "success",
                        "data": {
                            "text": "example cleaned transcript text...",
                            "chunks": ["chunk 1...", "chunk 2..."],
                            "total_chunks": 2
                        }
                    }
                }
            }
        },
        400: {
            "description": "Bad Request",
            "content": {
                "application/json": {
                    "example": {
                        "status": "error",
                        "message": "Invalid file format. Only .vtt files are accepted"
                    }
                }
            }
        },
        422: {
            "description": "Validation Error",
            "content": {
                "application/json": {
                    "example": {
                        "detail": [{
                            "loc": ["body", "file"],
                            "msg": "field required",
                            "type": "value_error.missing"
                        }]
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
                        "message": "VTT preprocessing failed: [error details]"
                    }
                }
            }
        }
    }
)
async def preprocess_transcript(
    file: UploadFile = File(..., description="VTT file to process")
):
    """
    Preprocess VTT format transcript from uploaded file.
    
    Args:
        file (UploadFile): VTT file to process
        
    Returns:
        APIResponse: JSON response containing processed text, chunks and chunk count
        
    Raises:
        HTTPException: If file format is invalid or file is empty
        APIResponse.error: If processing fails
    """
    try:
        if not file.filename.endswith('.vtt'):
            raise HTTPException(
                status_code=400, 
                detail="Invalid file format. Only .vtt files are accepted"
            )
        
        content = await file.read()
        if not content:
            raise HTTPException(
                status_code=400,
                detail="Uploaded file is empty"
            )
            
        # Reset file pointer for subsequent read
        await file.seek(0)
            
        raw_text = await preprocessor.read_vtt_file(file)
        if not raw_text.strip():
            raise HTTPException(
                status_code=400,
                detail="No valid text content found in VTT file"
            )
            
        clean_text = preprocessor.clean_transcript(raw_text)
        chunks = preprocessor.chunk_text(clean_text)
        
        if not chunks:
            return APIResponse.success({
                "text": clean_text,
                "chunks": [],
                "total_chunks": 0,
                "warning": "No text chunks were generated"
            })
        
        return APIResponse.success({
            "text": clean_text,
            "chunks": chunks,
            "total_chunks": len(chunks)
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise APIResponse.error(f"VTT preprocessing failed: {str(e)}") 