import pytest
from fastapi.testclient import TestClient
from app.main import app
import io

@pytest.fixture
def test_client():
    """Create a test client for the FastAPI application."""
    return TestClient(app)

@pytest.fixture
def test_vtt_content():
    """Return sample VTT content for testing."""
    return """WEBVTT

1
00:00:00.000 --> 00:00:05.000
Interviewer: Hello, welcome to the interview.

2
00:00:05.000 --> 00:00:10.000
Interviewee: Thank you for having me."""

@pytest.fixture
def test_vtt_file(test_vtt_content):
    """Create a test VTT file."""
    return io.BytesIO(test_vtt_content.encode())

@pytest.fixture
def test_invalid_file():
    """Create an invalid test file."""
    content = b"This is not a VTT file"
    return io.BytesIO(content) 