"""
Service for analyzing interview transcripts and extracting insights.
"""
import logging
import time
import os
from typing import Dict, Any, List
import re
import json
from .llm_chains.chain import create_analysis_chain
from ...domain.models import InterviewAnalysis, TranscriptChunk
from ...utils.errors import AnalysisError, FileProcessingError, ConfigurationError

# Set up logging
logger = logging.getLogger(__name__)


class TranscriptAnalyzer:
    """
    Analyzes interview transcripts to extract key insights and synthesis.
    Uses LLM-powered chains to process and analyze transcript content.
    """
    
    def __init__(self):
        """Initialize the transcript analyzer."""
        logger.info("Initializing TranscriptAnalyzer")
        self.analysis_chain = create_analysis_chain()
    
    async def analyze_transcript(self, file_content: bytes) -> Dict[str, Any]:
        """
        Analyze a transcript file to extract insights.
        
        Args:
            file_content: Raw bytes of the transcript file
            
        Returns:
            Dict containing structured analysis results
            
        Raises:
            FileProcessingError: If transcript file is invalid or empty
            AnalysisError: If analysis process fails
            ConfigurationError: If LLM service is not properly configured
        """
        try:
            start_time = time.time()
            
            # Step 1: Parse the transcript
            logger.info("Parsing transcript from bytes")
            text = file_content.decode("utf-8")
            chunks = self._parse_vtt_lines(text)
            
            if not chunks:
                logger.error("No valid chunks found in transcript")
                raise FileProcessingError("No valid content found in transcript file")
            
            logger.info(f"Extracted {len(chunks)} chunks from transcript")
            
            # Step 2: Format transcript for analysis
            formatted_transcript = self._format_chunks_for_analysis(chunks)
            
            # Step 3: Run the analysis chain
            logger.info("Starting analysis with LLM chain")
            try:
                if not self.analysis_chain:
                    logger.error("Analysis chain was not initialized properly")
                    raise ConfigurationError("Analysis service configuration error: LLM chain not initialized")
                
                result = await self.analysis_chain.run_analysis(formatted_transcript)
                logger.info("Analysis chain completed successfully")
                
            except Exception as e:
                logger.error(f"Error in analysis chain: {str(e)}")
                raise AnalysisError(f"Analysis failed: {str(e)}")
            
            # Step 4: Prepare the complete result
            result = self._process_synthesis_result(result, chunks)
            
            # Log completion time
            duration = time.time() - start_time
            logger.info(f"Completed transcript analysis in {duration:.2f} seconds")
            
            return result
                        
        except (FileProcessingError, AnalysisError, ConfigurationError):
            # Re-raise known error types
            raise
        except Exception as e:
            logger.error(f"Error in transcript analysis: {str(e)}", exc_info=True)
            raise AnalysisError(f"Transcript analysis failed: {str(e)}")
    
    def _process_transcript(self, file_path: str) -> str:
        """
        Process a transcript file and prepare it for analysis.
        
        Args:
            file_path: Path to the transcript file
            
        Returns:
            Formatted transcript text ready for analysis
            
        Raises:
            FileProcessingError: If file cannot be read or processed
        """
        try:
            # Read the file contents
            with open(file_path, 'r', encoding='utf-8') as file:
                text = file.read()
            
            # Parse into chunks
            chunks = self._parse_vtt_lines(text)
            
            if not chunks:
                raise FileProcessingError("No valid content found in transcript file")
            
            # Format for analysis
            return self._format_chunks_for_analysis(chunks)
            
        except Exception as e:
            logger.error(f"Failed to process transcript file: {str(e)}")
            raise FileProcessingError(f"Could not process transcript file: {str(e)}")
    
    def _add_metadata(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """
        Add metadata to the analysis result.
        
        Args:
            result: The raw analysis result
            
        Returns:
            Result with added metadata
        """
        if "metadata" not in result:
            result["metadata"] = {}
            
        # Add problem areas count
        problem_areas_count = len(result.get("problem_areas", []))
        result["metadata"]["problem_areas_count"] = problem_areas_count
        
        # Count total excerpts
        excerpts_count = 0
        for problem_area in result.get("problem_areas", []):
            excerpts_count += len(problem_area.get("excerpts", []))
            
        result["metadata"]["excerpts_count"] = excerpts_count
        
        # Add timestamp
        result["metadata"]["timestamp"] = time.time()
        
        return result
    
    def _parse_vtt_lines(self, vtt_content: str) -> List[Dict[str, Any]]:
        """
        Parse VTT content line by line to extract structured chunks with speaker identification.
        
        Args:
            vtt_content: String content of VTT file
            
        Returns:
            List of dictionaries with speaker and text information
            
        Raises:
            FileProcessingError: If parsing fails or content is invalid
        """
        # Split content into lines
        lines = vtt_content.strip().split("\n")
        
        chunks = []
        chunk_number = 0
        current_text = []
        processing_text = False
        
        for line in lines:
            line = line.strip()
            
            # Skip empty lines and header
            if not line or "WEBVTT" in line:
                continue
                
            # Timestamp line marks the start of a text segment
            if "-->" in line:
                # If we were processing text, save it as a chunk before starting a new one
                if processing_text and current_text:
                    chunk_number += 1
                    joined_text = " ".join(current_text).strip()
                    
                    chunks.append({
                        "number": chunk_number,
                        "text": joined_text
                    })
                    current_text = []
                
                processing_text = True
                continue
            
            # If we're processing text and line is not a number (could be cue identifier)
            if processing_text and not line.isdigit():
                current_text.append(line)
        
        # Don't forget the last chunk
        if processing_text and current_text:
            chunk_number += 1
            joined_text = " ".join(current_text).strip()
            
            chunks.append({
                "number": chunk_number,
                "text": joined_text
            })
        
        # Post-process chunks to extract speaker information
        processed_chunks = []
        for chunk in chunks:
            text = chunk["text"]
            if ": " in text:
                speaker, actual_text = text.split(": ", 1)
                processed_chunks.append({
                    "number": chunk["number"],
                    "speaker": speaker.strip(),
                    "text": actual_text.strip()
                })
            else:
                processed_chunks.append({
                    "number": chunk["number"],
                    "speaker": "Unknown",
                    "text": text
                })
        
        logger.info(f"Successfully extracted {len(processed_chunks)} chunks from VTT file")
        return processed_chunks
    
    def _format_chunks_for_analysis(self, chunks: List[Dict[str, Any]]) -> str:
        """
        Format transcript chunks into a string for analysis.
        
        Args:
            chunks: List of transcript chunks
            
        Returns:
            Formatted string representation of the transcript
        """
        formatted_lines = []
        
        for chunk in chunks:
            # Include speaker information in brackets plus the text
            formatted_lines.append(f"[{chunk['speaker']}] (Chunk {chunk['number']}): {chunk['text']}")
            
        return "\n".join(formatted_lines)
    
    def _process_synthesis_result(self, 
                                 result: Dict[str, Any], 
                                 chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Process and enrich the synthesis result with transcript details.
        
        Args:
            result: Raw synthesis result from the LLM
            chunks: Transcript chunks for reference
            
        Returns:
            Processed and enriched analysis result
        """
        # Create a mapping of chunk numbers to chunks for easy lookup
        chunk_map = {chunk["number"]: chunk for chunk in chunks}
        
        # Convert chunks to a format expected by the frontend
        transcript = []
        for chunk in chunks:
            transcript.append({
                "chunk_number": chunk["number"],
                "speaker": chunk["speaker"],
                "text": chunk["text"]
            })
        
        # Add the transcript to the result
        result["transcript"] = transcript
        
        # Process problem areas if present
        if "problem_areas" in result:
            for problem_area in result["problem_areas"]:
                # Process excerpts to add chunk information
                if "excerpts" in problem_area:
                    for excerpt in problem_area["excerpts"]:
                        # Ensure categories is an array
                        if "categories" not in excerpt:
                            excerpt["categories"] = ["Pain Point"]  # Default category
                            
                        # Map chunk references to actual chunks
                        if "chunk_number" in excerpt and excerpt["chunk_number"] in chunk_map:
                            chunk = chunk_map[excerpt["chunk_number"]]
                            if "quote" not in excerpt:
                                excerpt["quote"] = chunk["text"]
        
        # Ensure metadata fields exist
        if "metadata" not in result:
            result["metadata"] = {}
            
        # Add basic metadata
        result["metadata"]["transcript_length"] = len(chunks)
        
        # Count problem areas
        problem_areas_count = len(result.get("problem_areas", []))
        result["metadata"]["problem_areas_count"] = problem_areas_count
        
        # Count total excerpts
        excerpts_count = 0
        for problem_area in result.get("problem_areas", []):
            excerpts_count += len(problem_area.get("excerpts", []))
            
        result["metadata"]["excerpts_count"] = excerpts_count
        
        return result 