"""
Unit tests for the transcript parsing component.

These tests verify the core transcript parsing functionality including VTT format parsing,
pattern matching, and chunk structure validation. Tests are isolated from external dependencies.
"""
import pytest
import io
import re
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi import UploadFile
from app.services.analyze import TranscriptAnalyzer

@pytest.mark.unit
def test_vtt_content_parsing():
    """
    Test basic VTT content parsing functionality.
    
    Test Steps:
        1. Parse sample VTT content with multiple speakers
        2. Extract and validate timestamp patterns
        3. Verify speaker identification and content extraction
        4. Validate chunk structure and content
    """
    # Basic VTT format parsing
    vtt_content = """WEBVTT

1
00:00:00.000 --> 00:00:05.000
Speaker A: This is a test.

2
00:00:05.000 --> 00:00:10.000
Speaker B: This is a response."""

    lines = vtt_content.strip().split('\n')
    
    # Skip the WEBVTT header
    content_start = 0
    for i, line in enumerate(lines):
        if line == "WEBVTT":
            content_start = i + 1
            break
    
    # Parse chunks manually
    chunks = []
    current_chunk = None
    timestamp_pattern = re.compile(r'(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s+-->\s+(\d{2}):(\d{2}):(\d{2})\.(\d{3})')
    
    for i in range(content_start, len(lines)):
        line = lines[i].strip()
        if not line:  # Skip empty lines
            continue
            
        # Check if this is a timestamp line
        if timestamp_pattern.match(line):
            # Start a new chunk
            current_chunk = {
                "timestamp": line,
                "content": ""
            }
            chunks.append(current_chunk)
        elif current_chunk is not None:
            # Add content to the current chunk
            if current_chunk["content"]:
                current_chunk["content"] += " " + line
            else:
                current_chunk["content"] = line
    
    # Verify the results
    assert len(chunks) == 2
    assert "Speaker A: This is a test." in chunks[0]["content"]
    assert "Speaker B: This is a response." in chunks[1]["content"]

@pytest.mark.unit
def test_real_transcript_parser_patterns(real_transcript_file):
    """
    Test regex pattern matching with real transcript data.
    
    Args:
        real_transcript_file: Fixture providing a real transcript file
    
    Test Steps:
        1. Read and validate VTT file structure
        2. Apply regex patterns for cue numbers and timestamps
        3. Count and verify pattern matches
        4. Validate consistency between cues and timestamps
    """
    real_transcript_file.seek(0)
    content = real_transcript_file.read().decode('utf-8')
    
    # Check basic VTT structure
    assert content.startswith('WEBVTT')
    
    # Test regular expressions for parsing
    # Pattern for cue number
    cue_number_pattern = r'^\d+$'
    # Pattern for timestamps
    timestamp_pattern = r'\d{2}:\d{2}:\d{2}\.\d{3}\s-->\s\d{2}:\d{2}:\d{2}\.\d{3}'
    
    lines = content.strip().split('\n')
    
    # Count occurrences
    cue_numbers = 0
    timestamps = 0
    
    for line in lines:
        line = line.strip()
        if re.match(cue_number_pattern, line):
            cue_numbers += 1
        if re.match(timestamp_pattern, line):
            timestamps += 1
    
    # Verify counts
    assert cue_numbers > 0
    assert timestamps > 0
    assert cue_numbers == timestamps, "Number of cue numbers should match number of timestamps"

@pytest.mark.asyncio
@pytest.mark.unit
async def test_transcript_chunk_structure(real_transcript_file):
    """
    Test transcript chunk structure processing.
    
    Args:
        real_transcript_file: Fixture providing a real transcript file
    
    Test Steps:
        1. Initialize TranscriptAnalyzer
        2. Process VTT file through analyzer
        3. Validate chunk structure and required fields
        4. Verify chunk count consistency
    """
    # Import needed functions/classes
    from app.services.analyze import TranscriptAnalyzer
    
    # Create analyzer
    analyzer = TranscriptAnalyzer()
    
    # Mock upload file
    upload_file = MagicMock(spec=UploadFile)
    upload_file.filename = "test_transcript.vtt"
    
    # Reset file position
    real_transcript_file.seek(0)
    upload_file.read = AsyncMock(return_value=real_transcript_file.read())
    
    # Process the file
    result = await analyzer.preprocess_vtt(upload_file)
    
    # Verify basic structure of chunks
    assert "chunks" in result
    assert len(result["chunks"]) > 0
    
    # Verify the structure of each chunk
    for chunk in result["chunks"]:
        # Each chunk should have at minimum these fields
        assert "number" in chunk
        assert "text" in chunk
        
        # Verify number is an integer
        assert isinstance(chunk["number"], int)
        
        # Verify text is non-empty
        assert chunk["text"], f"Empty text in chunk: {chunk}"
        
    # Verify the total_chunks field is present
    assert "total_chunks" in result
    assert result["total_chunks"] == len(result["chunks"]) 