"""
Unit tests for the transcript preprocessor component.

These tests verify the core functionality of the Preprocessor class,
focusing on VTT file parsing and chunk extraction.
"""
import pytest
from fastapi import UploadFile
from app.services.preprocess import Preprocessor

@pytest.mark.unit
@pytest.mark.asyncio
async def test_preprocess_vtt_file(test_vtt_file):
    """
    Test VTT file preprocessing functionality.
    
    Args:
        test_vtt_file: Fixture providing a test VTT file
    
    Test Steps:
        1. Initialize preprocessor
        2. Create UploadFile with test content
        3. Process VTT file
        4. Verify chunk extraction
        5. Validate chunk content
    """
    preprocessor = Preprocessor()
    
    file = UploadFile(
        filename="test.vtt",
        file=test_vtt_file
    )
    
    result = await preprocessor.preprocess_vtt(file)
    
    assert "chunks" in result
    assert len(result["chunks"]) == 2
    assert result["chunks"][0]["text"] == "Interviewer: Hello, welcome to the interview."
    assert result["chunks"][1]["text"] == "Interviewee: Thank you for having me."

@pytest.mark.unit
def test_timestamp_format():
    """
    Test VTT timestamp format validation.
    
    Test Steps:
        1. Define valid and invalid timestamps
        2. Verify timestamp pattern matching
        3. Validate timestamp parsing
    """
    preprocessor = Preprocessor()
    
    valid_timestamp = "00:00:00.000 --> 00:00:05.000"
    invalid_timestamp = "00:00 --> 00:05"
    
    assert preprocessor.clean_transcript(valid_timestamp) == ""
    assert preprocessor.clean_transcript(invalid_timestamp) == "00:00 --> 00:05" 