"""
Service for analyzing interview transcripts and extracting insights.
"""
import logging
import time
import os
from typing import Dict, Any, List
import re
import json
from .gemini_pipeline import create_analysis_pipeline
from ...domain.models import InterviewAnalysis, TranscriptChunk
from ...utils.errors import AnalysisError, FileProcessingError, ConfigurationError

# Set up logging
logger = logging.getLogger(__name__)


class TranscriptAnalyzer:
    """
    Analyzes interview transcripts to extract key insights and synthesis.
    Uses Gemini-powered pipeline to process and analyze transcript content.
    """
    
    def __init__(self):
        """Initialize the transcript analyzer."""
        logger.info("Initializing TranscriptAnalyzer")
        self.analysis_pipeline = create_analysis_pipeline()
    
    async def analyze_transcript(self, file_content: bytes, filename: str) -> Dict[str, Any]:
        """
        Analyze a transcript file to extract insights.
        
        Args:
            file_content: Raw bytes of the transcript file
            filename: The original filename (e.g., 'interview.vtt' or 'transcript.txt')
            
        Returns:
            Dict containing structured analysis results
            
        Raises:
            FileProcessingError: If transcript file is invalid or empty
            AnalysisError: If analysis process fails
            ConfigurationError: If LLM service is not properly configured
        """
        try:
            start_time = time.time()
            
            # Step 1: Decode file content
            logger.info(f"Parsing transcript from bytes using filename: {filename}")
            text = file_content.decode("utf-8")
            
            # Step 2: Parse the transcript based on file extension
            # _parse_vtt and _parse_txt now return the post-processed chunks directly
            if filename.lower().endswith('.vtt'):
                processed_chunks = self._parse_vtt(text)
            elif filename.lower().endswith('.txt'):
                processed_chunks = self._parse_txt(text)
            else:
                raise FileProcessingError(f"Unsupported file extension: {filename}")

            if not processed_chunks:
                logger.error("No valid chunks found in transcript after post-processing")
                raise FileProcessingError("No valid content found in transcript file")
            
            logger.info(f"Successfully processed {len(processed_chunks)} chunks")

            # Step 2b: Extract participants from processed chunks
            unique_speakers = set()
            for chunk in processed_chunks:
                speaker = chunk.get("speaker")
                if speaker and speaker != "Unknown":
                    unique_speakers.add(speaker)
            extracted_participants = sorted(list(unique_speakers))
            logger.info(f"Extracted unique participants from chunks: {extracted_participants}")
            
            # Step 3: Format transcript for LLM analysis
            formatted_transcript = self._format_chunks_for_analysis(processed_chunks)
            
            # Step 4: Run the analysis pipeline (UPDATED CALL)
            logger.info("Starting analysis with Gemini pipeline")
            try:
                if not self.analysis_pipeline:
                    logger.error("Analysis pipeline was not initialized properly")
                    raise ConfigurationError("Analysis service configuration error: Gemini pipeline not initialized")
                
                # Calculate max_chunk_number (required by new pipeline)
                max_chunk_number = max(chunk.get('number', 0) for chunk in processed_chunks) if processed_chunks else 0

                # Call the pipeline with the required arguments
                result = await self.analysis_pipeline.run_analysis(
                    transcript_text=formatted_transcript, 
                    transcript_chunks=processed_chunks, # Pass the structured chunks
                    participants=extracted_participants # Pass the pre-parsed participants
                )
                logger.info("Analysis pipeline completed successfully")
                
            except Exception as e:
                logger.error(f"Error in analysis pipeline: {str(e)}")
                raise AnalysisError(f"Analysis failed: {str(e)}")
            
            # Step 5: Process results (no longer needs participant override)
            # The pipeline now returns the final structure including pre-parsed participants
            # We might still want to add the full transcript chunk data if not included by pipeline
            processed_result = self._add_full_transcript_to_result(result, processed_chunks)
            
            # Log completion time
            duration = time.time() - start_time
            logger.info(f"Completed transcript analysis in {duration:.2f} seconds")
            
            return processed_result
                        
        except (FileProcessingError, AnalysisError, ConfigurationError):
            # Re-raise known error types
            raise
        except Exception as e:
            logger.error(f"Error in transcript analysis: {str(e)}", exc_info=True)
            raise AnalysisError(f"Transcript analysis failed: {str(e)}")
    
    def _parse_vtt(self, vtt_content: str) -> List[Dict[str, Any]]:
        """
        Parse standard VTT content, capturing timestamps.
        Args: vtt_content: String content of VTT file
        Returns: List of dictionaries with number, timestamp, text
        """
        logger.info("Parsing using VTT logic")
        lines = vtt_content.strip().split("\n")
        chunks = []
        chunk_number = 0
        current_text = []
        current_timestamp = "" # Store the timestamp for the current cue
        in_cue_block = False 

        for line in lines:
            line = line.strip()

            if "WEBVTT" in line: continue

            if "-->" in line:
                if in_cue_block and current_text: # Finalize previous cue block
                    chunk_number += 1
                    # Include timestamp when adding chunk
                    chunks.append({"number": chunk_number, "timestamp": current_timestamp, "text": " ".join(current_text).strip()})
                current_text = []
                current_timestamp = line # Capture the timestamp line
                in_cue_block = True 
                continue 

            if in_cue_block:
                if not line: 
                    if current_text:
                        chunk_number += 1
                        chunks.append({"number": chunk_number, "timestamp": current_timestamp, "text": " ".join(current_text).strip()})
                    current_text = []
                    current_timestamp = ""
                    in_cue_block = False
                    continue

                if line.isdigit() and not current_text:
                    continue 
                else:
                    current_text.append(line)

        if in_cue_block and current_text: # Capture last cue
            chunk_number += 1
            chunks.append({"number": chunk_number, "timestamp": current_timestamp, "text": " ".join(current_text).strip()})

        return self._post_process_chunks(chunks)


    def _parse_txt(self, txt_content: str) -> List[Dict[str, Any]]:
        """
        Parse TXT content assuming VTT-like structure, capturing timestamps.
        Args: txt_content: String content of the TXT file
        Returns: List of dictionaries with number, timestamp, text
        """
        logger.info("Parsing using TXT logic")
        lines = txt_content.strip().split("\n")
        chunks = []
        chunk_number = 0
        current_text = []
        current_timestamp = "" # Store the timestamp
        in_cue_block = False 

        for line in lines:
            line = line.strip()

            if "WEBVTT" in line: continue 

            if "-->" in line:
                if in_cue_block and current_text:
                    chunk_number += 1
                    chunks.append({"number": chunk_number, "timestamp": current_timestamp, "text": " ".join(current_text).strip()})
                current_text = []
                current_timestamp = line # Capture timestamp
                in_cue_block = True 
                continue 

            if in_cue_block:
                if not line: 
                    if current_text:
                        chunk_number += 1
                        chunks.append({"number": chunk_number, "timestamp": current_timestamp, "text": " ".join(current_text).strip()})
                    current_text = []
                    current_timestamp = ""
                    in_cue_block = False
                    continue
                
                current_text.append(line)

        if in_cue_block and current_text: # Capture last cue
            chunk_number += 1
            chunks.append({"number": chunk_number, "timestamp": current_timestamp, "text": " ".join(current_text).strip()})
        
        return self._post_process_chunks(chunks)

    def _post_process_chunks(self, chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Shared logic to extract speaker from parsed chunks, preserving timestamp."""
        processed_chunks = []
        for chunk in chunks:
            text = chunk["text"]
            timestamp = chunk.get("timestamp", "") # Get timestamp
            number = chunk["number"]
            
            if ": " in text:
                speaker, actual_text = text.split(": ", 1)
                processed_chunks.append({
                    "number": number,
                    "timestamp": timestamp, # Keep timestamp
                    "speaker": speaker.strip(),
                    "text": actual_text.strip()
                })
            else:
                processed_chunks.append({
                    "number": number,
                    "timestamp": timestamp, # Keep timestamp
                    "speaker": "Unknown", 
                    "text": text
                })
        
        logger.info(f"Successfully post-processed {len(processed_chunks)} chunks")
        return processed_chunks
    
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
    
    def _add_full_transcript_to_result(self, 
                                       result: Dict[str, Any], 
                                       chunks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Ensures the full transcript data, including timestamps, is present.
        """
        if "transcript" not in result or not result["transcript"]:
             # Reconstruct from chunks, including timestamp
            transcript_data = [
                {
                    "chunk_number": chunk["number"],
                    "speaker": chunk["speaker"],
                    "text": chunk["text"],
                    "timestamp": chunk.get("timestamp", "") # Include timestamp
                } for chunk in chunks
            ]
            result["transcript"] = transcript_data
            logger.info("Added full transcript data (with timestamps) to the final result.")
        # Ensure timestamp exists even if transcript was already present
        elif result["transcript"] and chunks and len(result["transcript"]) == len(chunks):
            for i, res_chunk in enumerate(result["transcript"]):
                 if "timestamp" not in res_chunk:
                     res_chunk["timestamp"] = chunks[i].get("timestamp", "")

        return result 