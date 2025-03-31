from ..config.api_config import APIConfig
from rake_nltk import Rake
from nltk.tokenize import sent_tokenize
from collections import Counter
import spacy
import time
import logging
import tiktoken
import openai
from typing import Dict, List, Any
import nltk

# Download required NLTK data
try:
    nltk.download('punkt', quiet=True)
    nltk.download('stopwords', quiet=True)
except Exception as e:
    logging.warning(f"Failed to download NLTK data: {str(e)}")

# Set up logging
logger = logging.getLogger(__name__)

class KeywordExtractor:
    def __init__(self):
        logger.info("Initializing KeywordExtractor...")
        start = time.time()
        
        # Initialize spaCy
        try:
            self.nlp = spacy.load("en_core_web_sm")
            self.spacy_available = True
        except Exception as e:
            logger.error(f"Error loading SpaCy model: {str(e)}")
            logger.warning("Will use fallback keyword extraction methods")
            self.spacy_available = False
            
        # Initialize RAKE with custom sentence tokenizer using standard punkt
        try:
            self.rake = Rake(sentence_tokenizer=sent_tokenize)
            self.rake_available = True
        except Exception as e:
            logger.warning(f"Failed to initialize RAKE: {str(e)}")
            self.rake_available = False
        
        # Initialize OpenAI client
        try:
            self.openai_client = openai.OpenAI(
                api_key=APIConfig.OPENAI_API_KEY,
                base_url=APIConfig.OPENAI_API_URL
            )
            self.model = APIConfig.MODEL_CONFIGS["openai"]["model_name"]
            self.openai_available = True
        except Exception as e:
            logger.error(f"Error initializing OpenAI client: {str(e)}")
            self.openai_available = False
        
        # Initialize tokenizer
        try:
            self.tokenizer = tiktoken.encoding_for_model(self.model)
            self.tokenizer_available = True
        except Exception as e:
            logger.warning(f"Could not load tokenizer for {self.model}: {str(e)}")
            self.tokenizer_available = False
            
        logger.info(f"Initialization completed in {time.time() - start:.2f}s")
        
    def _extract_raw_keywords(self, text: str) -> dict:
        """Extract keywords using available methods with fallbacks"""
        start = time.time()
        
        keywords = []
        
        # NER extraction if spaCy is available
        if self.spacy_available:
            ner_start = time.time()
            ner_issues = self._extract_ner(text)
            keywords.extend(ner_issues)
            logger.info(f"NER extraction completed in {time.time() - ner_start:.2f}s")
        
        # RAKE extraction if available
        if self.rake_available:
            rake_start = time.time()
            rake_keywords = self._extract_rake(text)
            keywords.extend(rake_keywords)
            logger.info(f"RAKE extraction completed in {time.time() - rake_start:.2f}s")
        
        # If neither method is available, use basic fallback extraction
        if not self.spacy_available and not self.rake_available:
            basic_start = time.time()
            basic_keywords = self._extract_basic_keywords(text)
            keywords.extend(basic_keywords)
            logger.info(f"Basic extraction completed in {time.time() - basic_start:.2f}s")
        
        result = Counter(keywords)
        logger.info(f"Total keyword extraction completed in {time.time() - start:.2f}s")
        logger.info(f"Found {len(result)} unique keywords")
        return result
    
    def _extract_ner(self, text: str) -> list:
        """Extract named entities using spaCy"""
        if not self.spacy_available:
            return []
            
        try:
            doc = self.nlp(text)
            return [ent.text for ent in doc.ents if ent.label_ in {"ORG", "PRODUCT", "EVENT"}]
        except Exception as e:
            logger.error(f"Error extracting entities: {str(e)}")
            return []
    
    def _extract_rake(self, text: str) -> list:
        """Extract keywords using RAKE algorithm"""
        if not self.rake_available:
            return []
            
        try:
            self.rake.extract_keywords_from_text(text)
            return self.rake.get_ranked_phrases()
        except LookupError as e:
            logger.warning(f"RAKE extraction failed due to NLTK resource issue: {str(e)}")
            logger.warning("Falling back to empty result for RAKE")
            return []
    
    def _extract_basic_keywords(self, text: str) -> list:
        """Extract keywords using simple word frequency and n-grams (fallback method)"""
        # Clean text
        text = text.lower()
        
        # Get words (simple tokenization that doesn't rely on NLTK)
        words = [w.strip() for w in text.split() if len(w.strip()) > 3]
        
        # Basic stopwords
        stopwords = {'the', 'a', 'an', 'and', 'or', 'but', 'if', 'because', 'as', 'what', 
                    'when', 'where', 'how', 'who', 'which', 'this', 'that', 'these', 'those', 
                    'then', 'just', 'so', 'than', 'such', 'both', 'through', 'about', 'for', 
                    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 
                    'having', 'do', 'does', 'did', 'doing', 'to', 'from', 'in', 'out', 'on', 
                    'off', 'over', 'under', 'again', 'further', 'here', 'there'}
        
        # Filter stopwords
        filtered_words = [w for w in words if w not in stopwords]
        
        # Get word frequencies
        word_freq = Counter(filtered_words)
        
        # Extract bigrams
        bigrams = []
        for i in range(len(filtered_words) - 1):
            if i < len(filtered_words) - 1:
                bigram = filtered_words[i] + " " + filtered_words[i+1]
                bigrams.append(bigram)
        
        # Get top keywords
        top_words = [word for word, count in word_freq.most_common(30)]
        top_bigrams = [bigram for bigram, _ in Counter(bigrams).most_common(20)]
        
        # Combine unigrams and bigrams
        return top_words + top_bigrams

    def get_context(self, text: str, phrase: str, window_size: int = 3) -> list:
        """Get context around found phrases"""
        lines = text.splitlines()
        contexts = []
        
        for i, line in enumerate(lines):
            if phrase in line.lower():  # Case-insensitive matching
                start = max(0, i - window_size)
                end = min(len(lines), i + window_size + 1)
                contexts.append("\n".join(lines[start:end]))
                
        return contexts

    def get_context_batch(self, text: str, phrases: list, window_size: int = 3) -> dict:
        """Get context for multiple phrases in a single text scan"""
        lines = text.splitlines()
        contexts = {phrase: [] for phrase in phrases}
        
        for i, line in enumerate(lines):
            line_lower = line.lower()  # Convert once for case-insensitive matching
            for phrase in phrases:
                if phrase.lower() in line_lower:
                    start_idx = max(0, i - window_size)
                    end_idx = min(len(lines), i + window_size + 1)
                    contexts[phrase].append("\n".join(lines[start_idx:end_idx]))
        
        return contexts

    def truncate_to_token_limit(self, text: str, max_tokens: int = 12000) -> str:
        """Truncate text to stay within token limit"""
        if not self.tokenizer_available:
            # Fallback to character-based truncation if tokenizer is unavailable
            if len(text) > max_tokens * 4:  # Rough approximation
                return text[:max_tokens * 4]
            return text
            
        tokens = self.tokenizer.encode(text)
        if len(tokens) > max_tokens:
            tokens = tokens[:max_tokens]
            text = self.tokenizer.decode(tokens)
        return text
        
    async def extract_keywords(self, transcript_text: str) -> Dict[str, Any]:
        """Extract keywords and insights using OpenAI."""
        total_start = time.time()
        try:
            if not self.openai_available:
                raise ValueError("OpenAI client not available")
                
            # Extract initial keywords
            key_points = self._extract_raw_keywords(transcript_text)
            
            # Filter relevant points
            relevant_points = [
                point for point, count in key_points.items() 
                if len(point.split()) > 1 and count > 2
            ]
            
            # Get context for keywords
            contexts = self.get_context_batch(transcript_text, relevant_points)
            
            # Build sections for GPT analysis
            sections = [
                f"{point} -> {key_points[point]} occurrence(s)\n" + "\n".join(contexts[point])
                for point in relevant_points
            ]
            
            # Create GPT prompt
            sections_text = '\n\n'.join(sections)
            
            # Truncate transcript to fit within limits
            truncated_transcript = self.truncate_to_token_limit(transcript_text)
            
            prompt = (
                "Please analyze this interview transcript and provide:\n"
                "1. Key pain points and challenges mentioned\n"
                "2. Main demands or needs expressed\n"
                "3. Important insights and themes\n\n"
                f"Here are the relevant sections with context:\n\n{sections_text}\n\n"
                f"Original transcript:\n{truncated_transcript}"
            )
            
            # Ensure final prompt is within limits
            prompt = self.truncate_to_token_limit(prompt)
            
            # Get GPT analysis
            response = self.openai_client.chat.completions.create(
                model=self.model,
                messages=[{
                    "role": "system",
                    "content": "You are an AI assistant that extracts key pain points and demands from interview transcripts. Provide a clear, structured analysis."
                }, {
                    "role": "user",
                    "content": prompt
                }]
            )
            
            analysis_text = response.choices[0].message.content
            logger.info(f"Generated analysis of length: {len(analysis_text)}")
            
            # Parse the analysis results to extract structured data
            pain_points = []
            demands = []
            themes = []
            
            current_section = None
            for line in analysis_text.split('\n'):
                line = line.strip()
                if not line:  # Skip empty lines
                    continue
                    
                lower_line = line.lower()
                if "pain point" in lower_line or "challenge" in lower_line:
                    current_section = "pain_points"
                elif "demand" in lower_line or "need" in lower_line:
                    current_section = "demands"
                elif "insight" in lower_line or "theme" in lower_line:
                    current_section = "themes"
                elif current_section and (
                    (len(line) > 0 and line[0] in ["•", "-", "*"]) or 
                    (len(line) > 0 and line[0].isdigit() and len(line) >= 3 and ". " in line[:5])
                ):
                    item = line.lstrip("•-*0123456789. ")
                    if current_section == "pain_points":
                        pain_points.append(item)
                    elif current_section == "demands":
                        demands.append(item)
                    elif current_section == "themes":
                        themes.append(item)
            
            # Ensure non-empty lists
            if not pain_points:
                pain_points = ["None identified"]
            if not demands:
                demands = ["None identified"]
            if not themes:
                themes = ["None identified"]
                
            logger.info(f"Extracted {len(pain_points)} pain points, {len(demands)} demands, and {len(themes)} themes")
            logger.info(f"Total analysis completed in {time.time() - total_start:.2f}s")
            
            return {
                "pain_points": pain_points,
                "demands": demands,
                "themes": themes,
                "analysis_text": analysis_text,
                "model_used": self.model
            }
            
        except Exception as e:
            logger.error(f"Error in keyword extraction: {str(e)}")
            raise ValueError(f"Keyword extraction failed: {str(e)}") 