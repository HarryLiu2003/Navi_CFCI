from fastapi import APIRouter
from config.api_config import APIConfig
from utils.api_responses import APIResponse
import spacy
from rake_nltk import Rake
from collections import Counter
import openai
import time
import logging
import tiktoken

router = APIRouter()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class KeywordExtractor:
    def __init__(self):
        logger.info("Initializing KeywordExtractor...")
        start = time.time()
        self.nlp = spacy.load("en_core_web_sm")
        self.rake = Rake()
        self.openai_client = openai.OpenAI(
            api_key=APIConfig.OPENAI_API_KEY,
            base_url=APIConfig.OPENAI_API_URL
        )
        self.tokenizer = tiktoken.encoding_for_model("gpt-4-turbo-preview")
        logger.info(f"Initialization completed in {time.time() - start:.2f}s")
        
    def extract_keywords(self, text: str) -> dict:
        """Extract keywords using both NER and RAKE"""
        start = time.time()
        
        # NER extraction timing
        ner_start = time.time()
        ner_issues = self._extract_ner(text)
        logger.info(f"NER extraction completed in {time.time() - ner_start:.2f}s")
        
        # RAKE extraction timing
        rake_start = time.time()
        rake_keywords = self._extract_rake(text)
        logger.info(f"RAKE extraction completed in {time.time() - rake_start:.2f}s")
        
        result = Counter(ner_issues + rake_keywords)
        logger.info(f"Total keyword extraction completed in {time.time() - start:.2f}s")
        logger.info(f"Found {len(result)} unique keywords")
        return result
    
    def _extract_ner(self, text: str) -> list:
        doc = self.nlp(text)
        return [ent.text for ent in doc.ents if ent.label_ in {"ORG", "PRODUCT", "EVENT"}]
    
    def _extract_rake(self, text: str) -> list:
        self.rake.extract_keywords_from_text(text)
        return self.rake.get_ranked_phrases()

    def get_context(self, text: str, phrase: str, window_size: int = 3) -> list:
        """Get context around found phrases"""
        lines = text.splitlines()
        contexts = []
        
        for i, line in enumerate(lines):
            if phrase in line:
                start = max(0, i - window_size)
                end = min(len(lines), i + window_size + 1)
                contexts.append("\n".join(lines[start:end]))
                
        return contexts

    def get_context_batch(self, text: str, phrases: list, window_size: int = 3) -> dict:
        """Get context for multiple phrases in a single text scan"""
        lines = text.splitlines()
        contexts = {phrase: [] for phrase in phrases}
        
        for i, line in enumerate(lines):
            for phrase in phrases:
                if phrase in line:
                    start_idx = max(0, i - window_size)
                    end_idx = min(len(lines), i + window_size + 1)
                    contexts[phrase].append("\n".join(lines[start_idx:end_idx]))
        
        return contexts

    def truncate_to_token_limit(self, text: str, max_tokens: int = 120000) -> str:
        """Truncate text to stay within token limit"""
        tokens = self.tokenizer.encode(text)
        if len(tokens) > max_tokens:
            tokens = tokens[:max_tokens]
            text = self.tokenizer.decode(tokens)
        return text

extractor = KeywordExtractor()

@router.post("/",
    summary="Extract Keywords",
    description="Analyzes a transcript to extract key pain points and summaries.",
    tags=["keywords"],
    responses={
        200: {
            "description": "Successfully extracted keywords",
            "content": {
                "application/json": {
                    "example": {
                        "status": "success",
                        "data": {
                            "summary": "Extracted key points and demands...",
                            "keywords": {"keyword1": 3, "keyword2": 5}
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
                        "message": "Keyword extraction failed: [error details]"
                    }
                }
            }
        }
    }
)
async def analyze_transcript(transcript_text: str):
    """Analyzes a transcript to extract key pain points and summaries."""
    total_start = time.time()
    try:
        # Extract initial keywords
        key_points = extractor.extract_keywords(transcript_text)
        
        # Filter relevant points
        relevant_points = [
            point for point, count in key_points.items() 
            if len(point.split()) > 1 and count > 2
        ]
        
        # Get context for keywords
        contexts = extractor.get_context_batch(transcript_text, relevant_points)
        
        # Build sections for GPT analysis
        sections = [
            f"{point} -> {key_points[point]} occurrence(s)\n" + "\n".join(contexts[point])
            for point in relevant_points
        ]
        
        # Create GPT prompt
        sections_text = '\n\n'.join(sections)
        
        # Truncate transcript to fit within limits
        truncated_transcript = extractor.truncate_to_token_limit(transcript_text)
        
        prompt = (
            "Please analyze this interview transcript and provide:\n"
            "1. Key pain points and challenges mentioned\n"
            "2. Main demands or needs expressed\n"
            "3. Important insights and themes\n\n"
            f"Here are the relevant sections with context:\n\n{sections_text}\n\n"
            f"Original transcript:\n{truncated_transcript}"
        )
        
        # Ensure final prompt is within limits
        prompt = extractor.truncate_to_token_limit(prompt)
        
        # Get GPT analysis using GPT-4 Turbo
        response = extractor.openai_client.chat.completions.create(
            model="gpt-4-turbo-preview",
            messages=[{
                "role": "system",
                "content": "You are an AI assistant that extracts key pain points and demands from interview transcripts. Provide a clear, structured analysis."
            }, {
                "role": "user",
                "content": prompt
            }]
        )

        return APIResponse.success({
            "summary": response.choices[0].message.content,
            "keywords": dict(key_points)
        })
        
    except Exception as e:
        logger.error(f"Error in keyword extraction: {str(e)}")
        raise APIResponse.error(f"Keyword extraction failed: {str(e)}") 