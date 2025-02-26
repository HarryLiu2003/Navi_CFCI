from fastapi import FastAPI, File, UploadFile, HTTPException
import re
import json
import tiktoken
from nltk.tokenize import sent_tokenize
import nltk
import uvicorn

nltk.download('punkt')

app = FastAPI()

def read_vtt(file_content):
    lines = file_content.decode("utf-8").split("\n")
    text_lines = []
    for line in lines:
        if '-->' in line or line.strip().isdigit():
            continue
        line = line.strip()
        if line and not line.startswith('WEBVTT'):
            text_lines.append(line)
    return " ".join(text_lines)

def clean_transcript(text):
    text = re.sub(r'\b[A-Z][a-z]+\s[A-Z][a-z]+:\s', '', text)
    text = re.sub(r'\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}', '', text)
    text = re.sub(r'\[.*?\]', '', text)
    text = re.sub(r'\s+', ' ', text).strip()     
    return text.lower()

def chunk_text(text, max_tokens=512):
    enc = tiktoken.encoding_for_model("gpt-4")
    sentences = sent_tokenize(text)
    
    chunks = []
    current_chunk = []
    current_length = 0
    
    for sentence in sentences:
        token_length = len(enc.encode(sentence))
        if current_length + token_length > max_tokens:
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

@app.post("/preprocess/")
async def preprocess_vtt(file: UploadFile = File(...)):
    if not file.filename.endswith(".vtt"):
        raise HTTPException(status_code=400, detail="Only .vtt files are allowed")
    
    content = await file.read()
    raw_text = read_vtt(content)
    clean_text = clean_transcript(raw_text)
    chunks = chunk_text(clean_text)
    
    return {"chunks": chunks}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)

