"""
Utilities for handling transcript data.
"""
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

def format_chunks_for_analysis(chunks: List[Dict[str, Any]]) -> str:
    """
    Format transcript chunks into a single string suitable for LLM analysis.
    Ensures consistent formatting across different parts of the application.

    Args:
        chunks: A list of transcript chunk dictionaries, expected to have
                'speaker', 'number', and 'text' keys.

    Returns:
        A single string representation of the transcript.
    """
    if not chunks:
        logger.warning("format_chunks_for_analysis received empty or null chunks list.")
        return "" # Return empty string for empty input
        
    formatted_lines = []
    for chunk in chunks:
        # Safely get values, providing defaults
        speaker = chunk.get('speaker', 'Unknown')
        number = chunk.get('number', 'N/A')
        text = chunk.get('text', '').strip()
        
        # Format line
        formatted_lines.append(f"[{speaker}] (Chunk {number}): {text}")
        
    formatted_transcript = "\n".join(formatted_lines)
    logger.debug(f"Formatted {len(chunks)} chunks into transcript string (length: {len(formatted_transcript)})")
    return formatted_transcript 