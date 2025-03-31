"""
Module for analyzing interview transcripts and extracting insights.
"""
import logging
import time
from typing import Dict, Any, List
from fastapi import UploadFile
import re
import json
from ..utils.api_responses import APIError
from ..utils.analysis_chain.chain import create_analysis_chain

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
        
    async def preprocess_vtt(self, file: UploadFile) -> Dict[str, Any]:
        """
        Preprocess a VTT file into a structured format.
        
        Args:
            file: VTT file to process
            
        Returns:
            Dict containing structured transcript data
        """
        try:
            content = await file.read()
            text = content.decode("utf-8")
            
            # Parse VTT content to extract speakers and text using the more reliable method
            chunks = self._parse_vtt_lines(text)
            
            logger.info(f"Preprocessed transcript with {len(chunks)} chunks")
            
            # If no chunks were found, this is a critical error worth logging
            if not chunks:
                logger.error(f"Failed to extract any chunks from file: {file.filename}")
            
            return {
                "chunks": chunks,
                "total_chunks": len(chunks)
            }
        except Exception as e:
            logger.error(f"Error preprocessing VTT: {str(e)}", exc_info=True)
            raise APIError(f"Failed to preprocess transcript: {str(e)}")
    
    def _parse_vtt_lines(self, vtt_content: str) -> List[Dict[str, Any]]:
        """
        Parse VTT content line by line to extract structured chunks with speaker identification.
        This is a more robust approach that works better with various VTT formats.
        
        Args:
            vtt_content: String content of VTT file
            
        Returns:
            List of dictionaries with speaker and text information
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
    
    async def analyze_transcript(self, file: UploadFile) -> Dict[str, Any]:
        """
        Analyze a transcript file to extract insights.
        
        Args:
            file: VTT file containing the interview transcript
            
        Returns:
            Dict containing structured analysis results including:
            - problem_areas: List of identified problem areas with supporting excerpts
            - synthesis: Overall analysis of the findings in text format
            - metadata: Statistics about the analysis
            - transcript: The processed transcript chunks
        """
        start_time = time.time()
        
        try:
            # Step 1: Preprocess the transcript
            logger.info("Starting transcript preprocessing")
            transcript_data = await self.preprocess_vtt(file)
            chunks = transcript_data["chunks"]
            
            if not chunks:
                logger.error("No valid chunks found in transcript")
                raise APIError("No valid content found in transcript file")
            
            logger.info(f"Extracted {len(chunks)} chunks from transcript")
            
            # Step 2: Format transcript for analysis
            formatted_transcript = self._format_chunks_for_analysis(chunks)
            
            # Step 3: Run the analysis chain
            logger.info("Starting analysis chain")
            try:
                # Verify analysis chain was created successfully
                if not self.analysis_chain:
                    logger.error("Analysis chain was not initialized properly")
                    raise APIError("Analysis service configuration error: LLM chain not initialized")
                
                synthesis_result = await self.analysis_chain.run_analysis(formatted_transcript)
                
                logger.info("Analysis chain completed successfully")
                
            except ValueError as e:
                logger.error(f"Error in analysis chain: {str(e)}")
                if "API key" in str(e).lower():
                    raise APIError("Analysis service configuration error: API key issue. Check system configuration.", status_code=503)
                raise APIError(f"Analysis failed: {str(e)}", status_code=500)
            
            # Step 4: Process and validate the synthesis results
            if not synthesis_result:
                logger.error("Analysis chain returned empty result")
                raise APIError("Failed to generate analysis: empty result")
                
            try:
                # Check if the result is a string to be parsed
                if isinstance(synthesis_result, str):
                    logger.info("Parsing JSON string result from analysis chain")
                    try:
                        # Log the first part of the result for debugging
                        synthesis_result = json.loads(synthesis_result)
                    except json.JSONDecodeError as e:
                        logger.error(f"Failed to parse synthesis result as JSON: {e}")
                        logger.error(f"Raw result: {synthesis_result[:500]}...")
                        raise APIError("Failed to parse analysis result: Invalid JSON response from LLM", status_code=422)
            except Exception as e:
                logger.error(f"Error processing synthesis result: {e}")
                raise APIError(f"Failed to process analysis result: {str(e)}", status_code=422)
            
            # Step 5: Extract problem areas and enrich with chunk details
            logger.info("Processing synthesis results")
            processed_result = self._process_synthesis_result(synthesis_result, chunks)
            
            # Log completion time
            duration = time.time() - start_time
            logger.info(f"Completed transcript analysis in {duration:.2f} seconds")
            
            return processed_result
            
        except APIError:
            # Re-raise API errors as they are already formatted
            raise
        except Exception as e:
            logger.error(f"Error in transcript analysis: {str(e)}", exc_info=True)
            raise APIError(f"Transcript analysis failed: {str(e)}", status_code=500)
    
    def _format_chunks_for_analysis(self, chunks: List[Dict[str, Any]]) -> str:
        """
        Format transcript chunks into a string for analysis.
        
        Args:
            chunks: List of transcript chunks
            
        Returns:
            Formatted string representation of the transcript
        """
        # Simpler approach that matches the reference code's handling
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
            result: Raw synthesis result
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
                        # Standardize field names
                        if "quote" in excerpt and "text" not in excerpt:
                            excerpt["text"] = excerpt.pop("quote")
                        elif "quote" in excerpt and "text" in excerpt:
                            # If both exist, keep text and remove quote
                            excerpt.pop("quote")
                            
                        if "insight" in excerpt and "insight_summary" not in excerpt:
                            excerpt["insight_summary"] = excerpt.pop("insight")
                        elif "insight" in excerpt and "insight_summary" in excerpt:
                            # If both exist, keep insight_summary and remove insight
                            excerpt.pop("insight")
                            
                        # Ensure categories is an array
                        if "categories" not in excerpt:
                            excerpt["categories"] = ["Pain Point"]  # Default category
                            
                        # Map chunk references to actual chunks
                        if "chunk_number" in excerpt and excerpt["chunk_number"] in chunk_map:
                            chunk = chunk_map[excerpt["chunk_number"]]
                            # Ensure text field exists
                            if "text" not in excerpt:
                                excerpt["text"] = chunk["text"]
        
        # Ensure metadata fields exist
        if "metadata" not in result:
            result["metadata"] = {}
            
        # Add basic metadata
        result["metadata"]["transcript_length"] = len(chunks)
        
        # Count problem areas
        problem_areas_count = len(result.get("problem_areas", []))
        result["metadata"]["problem_areas_count"] = problem_areas_count
        
        # Count total excerpts
        excerpts_total_count = 0
        for problem_area in result.get("problem_areas", []):
            excerpts_total_count += len(problem_area.get("excerpts", []))
            
        result["metadata"]["excerpts_total_count"] = excerpts_total_count
        
        return result 