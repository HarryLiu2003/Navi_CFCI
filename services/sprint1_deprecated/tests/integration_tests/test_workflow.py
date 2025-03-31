"""
Integration tests for the sprint1_deprecated service workflow.

These tests verify the complete process from file upload through preprocessing to analysis.
"""
import pytest
from fastapi import UploadFile
from app.services.preprocess import Preprocessor

@pytest.mark.integration
@pytest.mark.asyncio
async def test_preprocess_and_analyze(test_vtt_file, test_client):
    """
    Test complete workflow from preprocessing through analysis.
    
    Args:
        test_vtt_file: Fixture providing a test VTT file
        test_client: FastAPI test client
        
    Test Steps:
        1. Preprocess transcript file
        2. Verify preprocessing response
        3. Run summarization
        4. Verify summary response
        5. Run keyword extraction
        6. Verify keyword analysis response
    """
    # First preprocess the transcript
    response = test_client.post(
        "/api/sprint1_deprecated/preprocess",
        files={"file": ("test.vtt", test_vtt_file, "text/vtt")}
    )
    assert response.status_code == 200
    preprocess_data = response.json()
    assert "data" in preprocess_data
    assert "chunks" in preprocess_data["data"]
    
    # Reset file pointer for next request
    test_vtt_file.seek(0)
    
    # Run summarization
    response = test_client.post(
        "/api/sprint1_deprecated/summarize",
        files={"file": ("test.vtt", test_vtt_file, "text/vtt")}
    )
    assert response.status_code == 200
    summary_data = response.json()
    assert "data" in summary_data
    assert "summary" in summary_data["data"]
    
    # Reset file pointer again
    test_vtt_file.seek(0)
    
    # Run keyword extraction
    response = test_client.post(
        "/api/sprint1_deprecated/keywords",
        files={"file": ("test.vtt", test_vtt_file, "text/vtt")}
    )
    assert response.status_code == 200
    keywords_data = response.json()
    assert "data" in keywords_data
    assert "analysis" in keywords_data["data"]
    
    # Verify metadata consistency
    assert "metadata" in summary_data["data"]
    assert "metadata" in keywords_data["data"] 