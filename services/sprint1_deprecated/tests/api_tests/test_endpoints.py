"""
API endpoint tests for the sprint1_deprecated service.

These tests verify the functionality of legacy API endpoints including preprocessing,
summarization, and keyword extraction. Tests focus on request/response handling.
"""
import pytest
from fastapi import UploadFile

@pytest.mark.api
def test_preprocessing_endpoint(test_client, test_vtt_file):
    """
    Test VTT file preprocessing endpoint.
    
    Args:
        test_client: FastAPI test client fixture
        test_vtt_file: Fixture providing a test VTT file
    
    Test Steps:
        1. Submit VTT file to preprocessing endpoint
        2. Verify successful response
        3. Validate response structure
        4. Check preprocessed chunks
    """
    files = {
        "file": ("test.vtt", test_vtt_file, "text/vtt")
    }
    
    response = test_client.post("/api/sprint1_deprecated/preprocess", files=files)
    
    assert response.status_code == 200
    assert response.json()["status"] == "success"
    assert "chunks" in response.json()["data"]

@pytest.mark.api
def test_summarization_endpoint(test_client, test_vtt_file):
    """
    Test transcript summarization endpoint.
    
    Args:
        test_client: FastAPI test client fixture
        test_vtt_file: Fixture providing a test VTT file
    
    Test Steps:
        1. Submit VTT file for summarization
        2. Verify successful response
        3. Validate summary content
        4. Check metadata presence
    """
    files = {
        "file": ("test.vtt", test_vtt_file, "text/vtt")
    }
    
    response = test_client.post("/api/sprint1_deprecated/summarize", files=files)
    
    assert response.status_code == 200
    assert response.json()["status"] == "success"
    assert "summary" in response.json()["data"]
    assert "metadata" in response.json()["data"]

@pytest.mark.api
def test_keyword_extraction_endpoint(test_client, test_vtt_file):
    """
    Test keyword extraction endpoint.
    
    Args:
        test_client: FastAPI test client fixture
        test_vtt_file: Fixture providing a test VTT file
    
    Test Steps:
        1. Submit VTT file for keyword extraction
        2. Verify successful response
        3. Validate analysis results
        4. Check metadata presence
    """
    files = {
        "file": ("test.vtt", test_vtt_file, "text/vtt")
    }
    
    response = test_client.post("/api/sprint1_deprecated/keywords", files=files)
    
    assert response.status_code == 200
    assert response.json()["status"] == "success"
    assert "analysis" in response.json()["data"]
    assert "metadata" in response.json()["data"]

@pytest.mark.api
def test_invalid_file_format(test_client, test_invalid_file):
    """
    Test handling of invalid file formats.
    
    Args:
        test_client: FastAPI test client fixture
        test_invalid_file: Fixture providing an invalid file
    
    Test Steps:
        1. Submit invalid file format
        2. Verify error response
        3. Validate error message
        4. Check status code
    """
    files = {
        "file": ("test.txt", test_invalid_file, "text/plain")
    }
    
    response = test_client.post("/api/sprint1_deprecated/preprocess", files=files)
    
    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid file format. Only .vtt files are accepted" 