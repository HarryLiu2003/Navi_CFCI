import os
from typing import Dict, Any
import openai
from ..config.api_config import APIConfig
import logging

logger = logging.getLogger(__name__)

class TranscriptSummarizer:
    def __init__(self):
        """Initialize the transcript summarizer with OpenAI client."""
        self.client = openai.OpenAI(
            api_key=APIConfig.OPENAI_API_KEY,
            base_url=APIConfig.OPENAI_API_URL
        )
        self.model = APIConfig.MODEL_CONFIGS["openai"]["model_name"]
        self.system_prompt = "You are an AI assistant that summarizes user interviews."
        logger.info(f"Initialized TranscriptSummarizer with model: {self.model}")

    async def generate_summary(self, text: str) -> Dict[str, Any]:
        """
        Generates a summary using OpenAI's API
        
        Args:
            text: The transcript text to summarize
            
        Returns:
            Dict containing the summary and model used
            
        Raises:
            ValueError: If the API call fails
        """
        try:
            logger.info(f"Generating summary for text of length: {len(text)}")
            
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": self.system_prompt},
                    {"role": "user", "content": f"Summarize the following interview transcript:\n\n{text}"}
                ]
            )
            
            summary = response.choices[0].message.content
            logger.info(f"Successfully generated summary of length: {len(summary)}")
            
            return {
                "summary": summary,
                "model_used": self.model
            }
            
        except Exception as e:
            logger.error(f"Error generating summary: {str(e)}")
            raise ValueError(f"OpenAI API request failed: {str(e)}") 