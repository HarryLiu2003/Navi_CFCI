import pytest
from fastapi.testclient import TestClient
import sys
import os
import io
from unittest.mock import AsyncMock, MagicMock

# Add the app directory to the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.main import app

#
# Common Fixtures
#

@pytest.fixture
def test_client():
    """Create a test client for the FastAPI application."""
    return TestClient(app)

@pytest.fixture
def test_vtt_content():
    """Return sample VTT content for testing.
    
    This is a simple transcript with clear speaker identifiers and timestamps.
    """
    return """WEBVTT

1
00:00:00.000 --> 00:00:05.000
Interviewer: Tell me about your biggest challenge.

2
00:00:05.000 --> 00:00:15.000
Interviewee: Our main issue is scaling our infrastructure. We've been growing rapidly, 
and our current systems can't keep up with the demand.

3
00:00:15.000 --> 00:00:25.000
Interviewee: We need a more robust solution that can handle increased load 
and maintain performance during peak times."""

@pytest.fixture
def test_vtt_file(test_vtt_content):
    """Create a test VTT file in-memory."""
    return io.BytesIO(test_vtt_content.encode())

@pytest.fixture
def test_invalid_file():
    """Create an invalid test file for error testing."""
    content = b"This is not a VTT file"
    return io.BytesIO(content)

@pytest.fixture
def test_empty_file():
    """Create an empty file for error testing."""
    return io.BytesIO(b"")

#
# Real Transcript Test Fixtures
#

@pytest.fixture
def real_transcript_file():
    """Load the real transcript file for integration testing.
    
    This fixture uses the actual interview transcript for realistic testing.
    It's particularly useful for integration tests.
    """
    # Look in the transcripts directory (preferred location)
    transcripts_path = os.path.join(os.path.dirname(__file__), "transcripts", "test_transcript_20250218.vtt")
    
    if os.path.exists(transcripts_path):
        with open(transcripts_path, "rb") as f:
            content = f.read()
        return io.BytesIO(content)
    
    # Fallback to project root (for local development)
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../.."))
    transcript_path = os.path.join(project_root, "test_transcript_20250218.vtt")
    
    try:
        with open(transcript_path, "rb") as f:
            content = f.read()
        return io.BytesIO(content)
    except FileNotFoundError:
        pytest.skip("Real transcript file not found")
        return None

#
# LLM Mocks
#

@pytest.fixture
def mock_problem_chain():
    """Create a mock for the problem extraction chain."""
    mock = AsyncMock()
    mock.ainvoke.return_value = {
        "problem_areas": [
            {
                "problem_id": "test-1",
                "title": "Test Problem",
                "description": "This is a test problem description",
                "relevance": "High"
            }
        ]
    }
    return mock

@pytest.fixture
def mock_excerpt_chain():
    """Create a mock for the excerpt extraction chain."""
    mock = AsyncMock()
    mock.ainvoke.return_value = {
        "excerpts": [
            {
                "excerpt_id": "exc-1",
                "problem_id": "test-1",
                "chunk_indices": [1, 2, 3],
                "transcript_text": "Sample text from transcript",
                "relevance": "High"
            }
        ]
    }
    return mock

@pytest.fixture
def mock_synthesis_chain():
    """Create a mock for the synthesis chain."""
    mock = AsyncMock()
    mock.ainvoke.return_value = {
        "synthesis": "This is a synthesized analysis."
    }
    return mock

#
# Setup and Teardown
#

@pytest.fixture(scope="session", autouse=True)
def setup_test_data():
    """Ensure test data is available for the test suite."""
    # Ensure the transcripts directory exists
    transcripts_dir = os.path.join(os.path.dirname(__file__), "transcripts")
    if not os.path.exists(transcripts_dir):
        os.makedirs(transcripts_dir)
    
    # Check if the test transcript file is already in place
    test_transcript_path = os.path.join(transcripts_dir, "test_transcript_20250218.vtt")
    
    # Just print a warning if it's not available
    if not os.path.exists(test_transcript_path):
        print("Warning: Test transcript file not found in the transcripts directory")
    
    yield 