"""
Basic unit tests for the interview analysis service.

These tests verify core regex patterns used throughout the service for parsing
VTT files, including timestamp and speaker identification patterns.
"""
import pytest
import re

@pytest.mark.unit
def test_timestamp_regex():
    """
    Test VTT timestamp pattern validation.
    
    Test Steps:
        1. Define timestamp regex pattern
        2. Test against valid timestamp formats
        3. Test against invalid timestamp formats
        4. Verify pattern matching behavior
    """
    # Common timestamp pattern used in VTT files
    timestamp_pattern = re.compile(r'(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s+-->\s+(\d{2}):(\d{2}):(\d{2})\.(\d{3})')
    
    # Valid timestamps
    valid_timestamps = [
        "00:00:00.000 --> 00:00:05.000",
        "01:23:45.678 --> 01:24:00.000"
    ]
    
    # Invalid timestamps
    invalid_timestamps = [
        "00:00:00,000 --> 00:00:05,000",  # Uses commas instead of periods
        "00:00 --> 00:05",  # Missing seconds/milliseconds
        "0:0:0.0 --> 0:0:5.0"  # Single digits without leading zeros
    ]
    
    # Test valid timestamps
    for timestamp in valid_timestamps:
        assert timestamp_pattern.match(timestamp) is not None
    
    # Test invalid timestamps
    for timestamp in invalid_timestamps:
        assert timestamp_pattern.match(timestamp) is None

@pytest.mark.unit
def test_speaker_regex():
    """
    Test speaker identification pattern validation.
    
    Test Steps:
        1. Define speaker regex pattern
        2. Test against valid speaker formats
        3. Test against invalid speaker formats
        4. Verify pattern capture groups
    """
    # Common pattern to extract speaker from transcript lines
    speaker_pattern = re.compile(r'^([^:]+):\s+(.+)$')
    
    # Valid speaker lines
    valid_lines = [
        "Interviewer: Tell me about your experience.",
        "Interviewee: I've been working in this field for 10 years.",
        "John Smith: Here's my perspective on the issue."
    ]
    
    # Invalid speaker lines
    invalid_lines = [
        "No speaker designation",
        "Missing colon after speaker",
        "- Bullet point instead of speaker"
    ]
    
    # Test valid lines
    for line in valid_lines:
        match = speaker_pattern.match(line)
        assert match is not None
        assert len(match.groups()) == 2
        assert match.group(1)  # Speaker should be captured
        assert match.group(2)  # Content should be captured
    
    # Test invalid lines
    for line in invalid_lines:
        match = speaker_pattern.match(line)
        assert match is None 