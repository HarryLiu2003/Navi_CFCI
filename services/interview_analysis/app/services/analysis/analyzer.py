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
            
            # --- REMOVED RULE-BASED EXTRACTION FROM RAW TEXT --- 

            # Step 2: Parse the transcript based on file extension into initial chunks
            raw_chunks: List[Dict[str, Any]] = []
            if filename.lower().endswith('.vtt'):
                raw_chunks = self._parse_vtt(text) # _parse_vtt now calls _post_process_chunks internally
            elif filename.lower().endswith('.txt'):
                raw_chunks = self._parse_txt(text) # _parse_txt now calls _post_process_chunks internally
            else:
                raise FileProcessingError(f"Unsupported file extension: {filename}")

            # The variable 'raw_chunks' now holds the result from _post_process_chunks
            processed_chunks = raw_chunks 

            if not processed_chunks:
                logger.error("No valid chunks found in transcript after post-processing")
                raise FileProcessingError("No valid content found in transcript file")
            
            logger.info(f"Successfully processed {len(processed_chunks)} chunks")

            # --- BEGIN PARTICIPANT EXTRACTION FROM PROCESSED CHUNKS --- 
            unique_speakers = set()
            for chunk in processed_chunks:
                speaker = chunk.get("speaker")
                if speaker and speaker != "Unknown":
                    unique_speakers.add(speaker)
            
            extracted_participants = sorted(list(unique_speakers))
            logger.info(f"Extracted unique participants from chunks: {extracted_participants}")
            # --- END PARTICIPANT EXTRACTION FROM PROCESSED CHUNKS --- 
            
            # Step 3: Format transcript for LLM analysis
            formatted_transcript = self._format_chunks_for_analysis(processed_chunks)
            
            # Step 4: Run the analysis pipeline (for synthesis, problems, etc.)
            logger.info("Starting analysis with Gemini pipeline")
            try:
                if not self.analysis_pipeline:
                    logger.error("Analysis pipeline was not initialized properly")
                    raise ConfigurationError("Analysis service configuration error: Gemini pipeline not initialized")
                
                result = await self.analysis_pipeline.run_analysis(formatted_transcript)
                logger.info("Analysis pipeline completed successfully")
                
            except Exception as e:
                logger.error(f"Error in analysis pipeline: {str(e)}")
                raise AnalysisError(f"Analysis failed: {str(e)}")
            
            # Step 5: Process results and OVERRIDE participants
            # Pass the chunk-derived participants to the processing function
            processed_result = self._process_synthesis_result(result, processed_chunks, extracted_participants)
            
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
        Parse standard VTT content, handling cue identifiers.
        Args: vtt_content: String content of VTT file
        Returns: List of dictionaries with speaker and text information
        """
        logger.info("Parsing using VTT logic")
        lines = vtt_content.strip().split("\n")
        chunks = []
        chunk_number = 0
        current_text = []
        in_cue_block = False 

        for line in lines:
            line = line.strip()

            if "WEBVTT" in line: continue # Ignore header

            if "-->" in line:
                if in_cue_block and current_text: # Finalize previous cue block
                    chunk_number += 1
                    chunks.append({"number": chunk_number, "text": " ".join(current_text).strip()})
                current_text = []
                in_cue_block = True 
                continue 

            if in_cue_block:
                if not line: # Empty line ends cue block
                    if current_text:
                        chunk_number += 1
                        chunks.append({"number": chunk_number, "text": " ".join(current_text).strip()})
                    current_text = []
                    in_cue_block = False
                    continue

                # Ignore cue identifier (digit only, first line in block)
                if line.isdigit() and not current_text:
                    continue 
                else:
                    current_text.append(line)

        if in_cue_block and current_text: # Capture last cue
            chunk_number += 1
            chunks.append({"number": chunk_number, "text": " ".join(current_text).strip()})

        return self._post_process_chunks(chunks)


    def _parse_txt(self, txt_content: str) -> List[Dict[str, Any]]:
        """
        Parse TXT content assuming VTT-like structure but potentially missing header/identifiers.
        Args: txt_content: String content of the TXT file
        Returns: List of dictionaries with speaker and text information
        """
        logger.info("Parsing using TXT logic")
        lines = txt_content.strip().split("\n")
        chunks = []
        chunk_number = 0
        current_text = []
        in_cue_block = False 

        for line in lines:
            line = line.strip()

            # Ignore WEBVTT if present, but don't require it
            if "WEBVTT" in line: continue 

            if "-->" in line:
                if in_cue_block and current_text: # Finalize previous cue block
                    chunk_number += 1
                    chunks.append({"number": chunk_number, "text": " ".join(current_text).strip()})
                current_text = []
                in_cue_block = True 
                continue 

            if in_cue_block:
                if not line: # Empty line can end cue block
                    if current_text:
                        chunk_number += 1
                        chunks.append({"number": chunk_number, "text": " ".join(current_text).strip()})
                    current_text = []
                    in_cue_block = False # Assume next non-empty line might be timestamp
                    continue
                
                # Unlike VTT, we don't explicitly ignore numeric lines here
                current_text.append(line)

        if in_cue_block and current_text: # Capture last cue
            chunk_number += 1
            chunks.append({"number": chunk_number, "text": " ".join(current_text).strip()})
        
        return self._post_process_chunks(chunks)

    def _post_process_chunks(self, chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Shared logic to extract speaker from parsed chunks."""
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
                    "speaker": "Unknown", # Assign Unknown if no ': ' separator
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
    
    def _process_synthesis_result(self, 
                                 result: Dict[str, Any], 
                                 chunks: List[Dict[str, Any]],
                                 extracted_participants: List[str]) -> Dict[str, Any]:
        """
        Process analysis result, enrich with transcript, OVERRIDE participants.
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
        
        # Ensure metadata fields exist (though Pydantic model should handle this)
        if "metadata" not in result:
            result["metadata"] = {}
            
        # Add basic metadata (potentially redundant if included in LLM response)
        result["metadata"]["transcript_length"] = len(chunks) 
        
        # Add counts if not already present in metadata from LLM
        if "problem_areas_count" not in result["metadata"]:
            result["metadata"]["problem_areas_count"] = len(result.get("problem_areas", []))
            
        if "excerpts_count" not in result["metadata"]:
            excerpts_count = 0
            for problem_area in result.get("problem_areas", []):
                excerpts_count += len(problem_area.get("excerpts", []))
            result["metadata"]["excerpts_count"] = excerpts_count
        
        # --- OVERRIDE PARTICIPANTS --- 
        # Use the list derived from processed chunks
        result["participants"] = extracted_participants
        logger.info(f"Final participants list set to: {extracted_participants}")

        # Remove interviewer/interviewee fields derived from LLM if they exist,
        # as they are now potentially inconsistent with the rule-based list.
        # Keep the main 'speakers' dict for backward compatibility if needed elsewhere, 
        # but mark it as potentially inaccurate.
        result.pop("interviewer", None)
        result.pop("interviewee", None)
        result["speakers"] = {
            "interviewer": None, 
            "interviewee": None, 
            "_source": "Participants extracted via rule-based logic, speaker roles not inferred."
        }
        
        return result 