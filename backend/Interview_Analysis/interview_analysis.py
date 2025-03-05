from fastapi import APIRouter, UploadFile, File
from google import genai
import os
from dotenv import load_dotenv
from utils.api_responses import APIResponse
from Preprocessing.preprocessing import TranscriptPreprocessor
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, TypedDict
from langgraph.graph import StateGraph
from langgraph.store.memory import InMemoryStore
import fastapi
import logging
import json

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

router = APIRouter()
preprocessor = TranscriptPreprocessor()

# Define the output schema for participant analysis
class Participant(BaseModel):
    name: str = Field(description="Name of the participant")
    role: str = Field(description="Role (interviewer/interviewee)")
    title: str = Field(description="Job title or position if mentioned", default="")

class ParticipantAnalysis(BaseModel):
    interviewers: List[Participant] = Field(description="List of interviewers")
    interviewees: List[Participant] = Field(description="List of interviewees")

class GeminiInterviewAnalyzer:
    def __init__(self):
        logger.info("Initializing GeminiInterviewAnalyzer...")
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
        
        # Update content analysis prompt to use participant information
        self.content_prompt = ChatPromptTemplate.from_messages([
            ("system", """You are analyzing an interview transcript focusing specifically on the interviewee's needs and requirements.
            Use the provided participant information to give context to your analysis.
            
            Format your response in these sections:
            1. Requirements and Needs
               - Clearly stated requirements
               - Implied needs or pain points
               - Priority level (if indicated)
            
            2. Context and Justification
               - Specific scenarios or examples mentioned
               - Current challenges or limitations
               - Desired outcomes
            
            3. Additional Insights
               - Technical constraints mentioned
               - Timeline considerations
               - Budget or resource requirements
               
            Use bullet points and clear formatting."""),
            ("user", """Participant Information:
            {participants}
            
            Interview Transcript:
            {transcript}""")
        ])
        
        self.content_chain = self.content_prompt | self.llm
        
        # Initialize memory store
        self.memory_store = InMemoryStore()
        
        # Build and compile the graph
        self.graph = self.build_state_graph()
    
    def build_state_graph(self):
        # Create a state type with the required fields
        class State(TypedDict):
            transcript: str
            participants: Optional[ParticipantAnalysis]
            analysis: Optional[str]

        # Initialize the graph with state schema
        workflow = StateGraph(
            state_schema=State
        )
        
        # Define nodes
        workflow.add_node("analyze_participants", self._analyze_participants_node)
        workflow.add_node("analyze_content", self._analyze_content_node)
        
        # Define edges
        workflow.add_edge("analyze_participants", "analyze_content")
        workflow.set_entry_point("analyze_participants")
        
        return workflow.compile()
    
    def _analyze_participants_node(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Node function for participant analysis"""
        try:
            logger.debug("Starting participant analysis")
            transcript = state.get("transcript", "")
            logger.debug(f"Transcript length: {len(transcript)}")
            
            logger.debug("Invoking participant chain")
            result = self.participant_chain.invoke({"transcript": transcript})
            
            # Fix: Ensure titles are empty strings instead of None
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
            
            logger.debug(f"Participant analysis result: {json.dumps(result_dict, indent=2)}")
            return {"transcript": transcript, "participants": result_dict}
        except Exception as e:
            logger.error(f"Error in participant analysis node: {str(e)}", exc_info=True)
            raise ValueError(f"Participant analysis failed: {str(e)}")
    
    def _analyze_content_node(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Node function for content analysis"""
        try:
            logger.debug("Starting content analysis")
            transcript = state.get("transcript", "")
            participants = state.get("participants")
            
            # Fix: Handle both dict and Pydantic model cases
            if hasattr(participants, 'dict'):
                participants_dict = participants.dict()
            else:
                participants_dict = participants
            
            # Ensure titles are empty strings
            for participant_list in ['interviewers', 'interviewees']:
                if participant_list in participants_dict:
                    for participant in participants_dict[participant_list]:
                        if participant.get('title') is None:
                            participant['title'] = ""
            
            logger.debug(f"Participants data: {json.dumps(participants_dict, indent=2)}")
            
            # Create ParticipantAnalysis instance with validated data
            participant_analysis = ParticipantAnalysis(
                interviewers=[
                    Participant(**p) for p in participants_dict['interviewers']
                ],
                interviewees=[
                    Participant(**p) for p in participants_dict['interviewees']
                ]
            )
            
            participant_info = self._format_participant_info(participant_analysis)
            logger.debug(f"Formatted participant info: {participant_info}")
            
            result = self.content_chain.invoke({
                "participants": participant_info,
                "transcript": transcript
            })
            logger.debug("Content analysis completed successfully")
            
            return {
                "transcript": transcript, 
                "participants": participants_dict, 
                "analysis": result.content
            }
        except Exception as e:
            logger.error(f"Error in content analysis node: {str(e)}", exc_info=True)
            raise ValueError(f"Content analysis failed: {str(e)}")
    
    def _format_participant_info(self, participants: ParticipantAnalysis) -> str:
        """Helper function to format participant information"""
        try:
            return "Interviewers:\n" + "\n".join(
                [f"- {p.name} ({p.title})" for p in participants.interviewers]
            ) + "\n\nInterviewees:\n" + "\n".join(
                [f"- {p.name} ({p.title})" for p in participants.interviewees]
            )
        except Exception as e:
            logger.error(f"Error formatting participant info: {str(e)}", exc_info=True)
            raise
        
    async def analyze_participants(self, transcript_text: str) -> ParticipantAnalysis:
        """Analyze and extract participants from the transcript."""
        try:
            result = await self.participant_chain.ainvoke({"transcript": transcript_text})
            return result
        except Exception as e:
            raise APIResponse.error(f"Participant analysis failed: {str(e)}")
        
    async def analyze_content(self, transcript_text: str, participants: ParticipantAnalysis) -> str:
        """Generate a content analysis using Gemini, with participant context."""
        try:
            # Format participant info for the prompt
            participant_info = "Interviewers:\n" + "\n".join(
                [f"- {p.name} ({p.title})" for p in participants.interviewers]
            ) + "\n\nInterviewees:\n" + "\n".join(
                [f"- {p.name} ({p.title})" for p in participants.interviewees]
            )
            
            result = await self.content_chain.ainvoke({
                "participants": participant_info,
                "transcript": transcript_text
            })
            return result.content
        except Exception as e:
            raise APIResponse.error(f"Content analysis failed: {str(e)}")
    
    async def analyze_transcript_with_graph(self, transcript_text: str) -> Dict[str, Any]:
        """Use LangGraph to analyze the transcript with state management"""
        try:
            logger.info("Starting graph-based analysis")
            conversation_id = f"conversation_{str(hash(transcript_text))[:8]}"
            logger.debug(f"Generated conversation ID: {conversation_id}")
            
            logger.debug("Invoking graph with transcript")
            result = await self.graph.ainvoke(
                {"transcript": transcript_text},
                config={
                    "configurable": {
                        "thread_id": conversation_id,
                        "memory_store": self.memory_store
                    }
                },
            )
            logger.info("Graph analysis completed successfully")
            
            return {
                "participants": result["participants"],
                "analysis": result["analysis"]
            }
        except Exception as e:
            logger.error(f"Graph-based analysis failed: {str(e)}", exc_info=True)
            raise APIResponse.error(f"Graph-based analysis failed: {str(e)}")

analyzer = GeminiInterviewAnalyzer()

@router.post("/",
    summary="Analyze Interview Transcript",
    description="Generates a comprehensive analysis of an interview transcript using Gemini AI.",
    tags=["interview_analysis"],
    responses={
        200: {
            "description": "Successfully analyzed interview transcript",
            "content": {
                "application/json": {
                    "example": {
                        "status": "success",
                        "data": {
                            "participants": {
                                "interviewers": [{"name": "John Smith", "role": "interviewer", "title": "Product Manager"}],
                                "interviewees": [{"name": "Jane Doe", "role": "interviewee", "title": "Software Engineer"}]
                            },
                            "analysis": "Comprehensive analysis of the interview..."
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
                        "message": "Analysis failed: [error details]"
                    }
                }
            }
        }
    }
)
async def analyze_transcript(file: UploadFile = File(..., description="VTT file to analyze")):
    """
    Analyze a VTT format interview transcript.
    First identifies participants, then analyzes content with participant context.
    """
    try:
        logger.info(f"Received file: {file.filename}")
        logger.info("Starting transcript analysis")
        
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
        
        result = await analyzer.analyze_transcript_with_graph(raw_text)
        logger.info("Analysis completed successfully")
        return APIResponse.success(result)
        
    except Exception as e:
        logger.error(f"Error processing transcript: {str(e)}", exc_info=True)
        if isinstance(e, fastapi.HTTPException):
            raise e
        raise APIResponse.error(f"Interview analysis failed: {str(e)}") 