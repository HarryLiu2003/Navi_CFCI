from fastapi import UploadFile
import re
import tiktoken
from nltk.tokenize import sent_tokenize, word_tokenize
import nltk
from typing import Dict, List, Any
import logging

# Download NLTK data once at module level
try:
    nltk.download('punkt', quiet=True)
    nltk.download('stopwords', quiet=True)
except Exception as e:
    logging.warning(f"Failed to download NLTK data: {str(e)}")

logger = logging.getLogger(__name__)

class Preprocessor:
    def __init__(self, model_name="gpt-4", max_tokens=512):
        try:
            self.tokenizer = tiktoken.encoding_for_model(model_name)
        except Exception as e:
            logger.error(f"Failed to initialize tokenizer for model {model_name}: {str(e)}")
            self.tokenizer = None
        self.max_tokens = max_tokens

    async def preprocess_vtt(self, file: UploadFile) -> Dict[str, Any]:
        """Process VTT file into structured format."""
        try:
            content = await file.read()
            text = content.decode('utf-8')
            
            logger.info(f"Processing VTT content of length: {len(text)} bytes")
            
            # Convert VTT to structured format
            chunks = []
            lines = text.split("\n")
            
            i = 0
            while i < len(lines):
                line = lines[i].strip()
                
                # Skip empty lines and WEBVTT header
                if not line or line == "WEBVTT":
                    i += 1
                    continue
                
                # Look for timestamp lines
                if "-->" in line:
                    # This is a timestamp line, next line should contain text
                    if i + 1 < len(lines):
                        text_line = lines[i + 1].strip()
                        if text_line:  # Make sure there's actually text
                            chunk_num = len(chunks) + 1
                            chunks.append({
                                "number": chunk_num,
                                "text": text_line
                            })
                            logger.debug(f"Found chunk {chunk_num}: {text_line[:30]}...")
                    i += 2  # Skip to after the text line
                else:
                    i += 1  # Move to next line
            
            logger.info(f"Extracted {len(chunks)} chunks from VTT file")
            
            if not chunks:
                logger.warning("No chunks extracted from VTT file")
            
            return {
                "chunks": chunks,
                "max_chunk": len(chunks),
                "raw_text": text
            }
        except Exception as e:
            logger.error(f"Error preprocessing VTT: {str(e)}")
            raise ValueError(f"Failed to process VTT file: {str(e)}")

    def clean_transcript(self, text: str) -> str:
        """Clean and normalize transcript text."""
        text = re.sub(r'\b[A-Z][a-z]+\s[A-Z][a-z]+:\s', '', text)  # Remove speaker labels
        text = re.sub(r'\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}', '', text)  # Remove timestamps
        text = re.sub(r'\[.*?\]', '', text)  # Remove bracketed content
        text = re.sub(r'\s+', ' ', text).strip()  # Normalize whitespace
        return text.lower()

    def chunk_text(self, text: str) -> List[str]:
        """Split text into chunks based on token limit."""
        if not self.tokenizer:
            # Fallback to simple word count if tokenizer is not available
            words = text.split()
            chunks = []
            current_chunk = []
            current_length = 0
            
            for word in words:
                if current_length + 1 > self.max_tokens:
                    chunks.append(" ".join(current_chunk))
                    current_chunk = [word]
                    current_length = 1
                else:
                    current_chunk.append(word)
                    current_length += 1
            
            if current_chunk:
                chunks.append(" ".join(current_chunk))
            
            return chunks
        
        # Use NLTK sentence tokenization
        try:
            # Use standard sent_tokenize which uses punkt
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
        except LookupError as e:
            # Fallback if punkt isn't available
            logger.warning(f"NLTK tokenization failed: {str(e)}. Falling back to simple split.")
            # Simple fallback
            words = text.split()
            chunks = []
            current_chunk = []
            current_length = 0
            
            for word in words:
                if current_length + 1 > self.max_tokens:
                    chunks.append(" ".join(current_chunk))
                    current_chunk = [word]
                    current_length = 1
                else:
                    current_chunk.append(word)
                    current_length += 1
            
            if current_chunk:
                chunks.append(" ".join(current_chunk))
            
            return chunks 