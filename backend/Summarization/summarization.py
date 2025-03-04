import os
from typing import Dict, Any
import dotenv
import openai
from fastapi import APIRouter
from utils.api_responses import APIResponse

router = APIRouter()
dotenv.load_dotenv()

class OpenAIConfig:
    API_KEY: str = os.getenv("OPENAI_API_KEY")
    API_URL: str = os.getenv("OPENAI_API_URL")
    MODEL_NAME: str = "gpt-4-0125-preview"
    SYSTEM_PROMPT: str = "You are an AI assistant that summarizes user interviews."

class OpenAIService:
    def __init__(self) -> None:
        self.client = openai.OpenAI(
            api_key=OpenAIConfig.API_KEY,
            base_url=OpenAIConfig.API_URL
        )

    def generate_summary(self, text: str) -> Dict[str, Any]:
        """
        Generates a summary using OpenAI's API
        
        Raises:
            APIResponse.error: If the API call fails
        """
        try:
            response = self.client.chat.completions.create(
                model=OpenAIConfig.MODEL_NAME,
                messages=[
                    {"role": "system", "content": OpenAIConfig.SYSTEM_PROMPT},
                    {"role": "user", "content": f"Summarize the following interview transcript:\n\n{text}"}
                ]
            )
            
            return {
                "choices": [{
                    "message": {
                        "content": response.choices[0].message.content
                    }
                }]
            }
            
        except Exception as e:
            raise APIResponse.error(f"OpenAI API request failed: {str(e)}")

openai_service = OpenAIService()

@router.post("/",
    summary="Summarize Transcript",
    description="Generates a concise summary of interview transcripts using OpenAI's GPT-4 model.",
    tags=["summarization"],
    responses={
        200: {
            "description": "Successfully summarized transcript",
            "content": {
                "application/json": {
                    "example": {
                        "status": "success",
                        "data": {
                            "summary": "This is a summary of the transcript..."
                        }
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
                        "message": "Summarization failed: [error details]"
                    }
                }
            }
        }
    }
)
async def summarize_transcript(transcript_text: str):
    try:
        result = openai_service.generate_summary(transcript_text)
        return APIResponse.success({
            "summary": result["choices"][0]["message"]["content"]
        })
    except Exception as e:
        raise APIResponse.error(f"Summarization failed: {str(e)}")

