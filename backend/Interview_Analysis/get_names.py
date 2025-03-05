from fastapi import APIRouter, UploadFile, File
import google.generativeai as genai
import os
from dotenv import load_dotenv
from utils.api_responses import APIResponse
from Preprocessing.preprocessing import TranscriptPreprocessor
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.output_parsers import JsonOutputParser
import fastapi
import logging
import json
from pydantic import BaseModel, Field
from typing import List, Optional

# Load environment variables
load_dotenv()

# Define Pydantic models to replace the imported ones
class Participant(BaseModel):
    name: str
    role: str
    title: Optional[str] = ""

class ParticipantAnalysis(BaseModel):
    interviewers: List[Participant] = Field(default_factory=list)
    interviewees: List[Participant] = Field(default_factory=list)

# Configure logging
logger = logging.getLogger(__name__)

router = APIRouter()
preprocessor = TranscriptPreprocessor()

class SimpleParticipantExtractor:
    def __init__(self):
        logger.info("Initializing SimpleParticipantExtractor...")
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            logger.error("GEMINI_API_KEY not found in environment variables")
            raise ValueError("GEMINI_API_KEY not found in environment variables")
        
        # Initialize Langchain components
        try:
            self.llm = ChatGoogleGenerativeAI(
                model="gemini-2.0-flash",
                google_api_key=api_key
            )
            logger.info("LLM initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize LLM: {str(e)}")
            raise
        
        # Initialize participant analysis chain
        self.participant_parser = JsonOutputParser(pydantic_object=ParticipantAnalysis)
        
        self.participant_prompt = ChatPromptTemplate.from_messages([
            ("system", """You are an expert at analyzing interview transcripts.
            Identify all participants in the interview transcript and categorize them as either interviewers or interviewees.
            Extract their names and any mentioned titles or positions.
            
            Format your response as a JSON object with two arrays: 'interviewers' and 'interviewees'.
            Each participant should have: name, role, and title (if available).
            
            Example format:
            {{
                "interviewers": [
                    {{"name": "John Smith", "role": "interviewer", "title": "Product Manager"}}
                ],
                "interviewees": [
                    {{"name": "Jane Doe", "role": "interviewee", "title": "Software Engineer"}}
                ]
            }}"""),
            ("user", "{transcript}")
        ])
        
        self.participant_chain = self.participant_prompt | self.llm | self.participant_parser
    
    async def extract_participants(self, transcript_text: str) -> ParticipantAnalysis:
        """Extract participants from the transcript."""
        try:
            logger.debug("Starting participant extraction")
            result = await self.participant_chain.ainvoke({"transcript": transcript_text})
            
            # Ensure titles are empty strings instead of None
            if hasattr(result, 'dict'):
                result_dict = result.dict()
            else:
                result_dict = result
                
            # Ensure titles are empty strings
            for participant_list in ['interviewers', 'interviewees']:
                if participant_list in result_dict:
                    for participant in result_dict[participant_list]:
                        if participant.get('title') is None:
                            participant['title'] = ""
            
            logger.debug(f"Participant extraction result: {json.dumps(result_dict, indent=2)}")
            return result
            
        except Exception as e:
            logger.error(f"Error extracting participants: {str(e)}", exc_info=True)
            raise ValueError(f"Participant extraction failed: {str(e)}")

extractor = SimpleParticipantExtractor()

@router.post("/names",
    summary="Extract Participant Names from Interview Transcript",
    description="Identifies and categorizes participants in an interview transcript.",
    tags=["participant_extraction"],
    responses={
        200: {
            "description": "Successfully extracted participants",
            "content": {
                "application/json": {
                    "example": {
                        "status": "success",
                        "data": {
                            "interviewers": [{"name": "John Smith", "role": "interviewer", "title": "Product Manager"}],
                            "interviewees": [{"name": "Jane Doe", "role": "interviewee", "title": "Software Engineer"}]
                        }
                    }
                }
            }
        },
        400: {
            "description": "Invalid file format",
            "content": {
                "application/json": {
                    "example": {
                        "status": "error",
                        "message": "Invalid file format. Only .vtt files are accepted"
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
                        "message": "Extraction failed: [error details]"
                    }
                }
            }
        }
    }
)
async def get_names(file: UploadFile = File(..., description="VTT file to analyze")):
    """
    Extract participants from a VTT format interview transcript.
    Identifies and categorizes participants as interviewers or interviewees.
    """
    try:
        logger.info(f"Received file: {file.filename}")
        logger.info("Starting participant extraction")
        
        if not file.filename.endswith('.vtt'):
            logger.warning(f"Invalid file format: {file.filename}")
            raise APIResponse.error(
                "Invalid file format. Only .vtt files are accepted",
                status_code=400
            )
        
        raw_text = await preprocessor.read_vtt_file(file)
        logger.debug(f"Preprocessed text length: {len(raw_text)}")
        
        if not raw_text.strip():
            logger.warning("Empty transcript after preprocessing")
            raise APIResponse.error(
                "No valid text content found in VTT file",
                status_code=400
            )
        
        result = await extractor.extract_participants(raw_text)
        logger.info("Participant extraction completed successfully")
        return APIResponse.success(result)
        
    except Exception as e:
        logger.error(f"Error processing transcript: {str(e)}", exc_info=True)
        if isinstance(e, fastapi.HTTPException):
            raise e
        raise APIResponse.error(f"Participant extraction failed: {str(e)}") 