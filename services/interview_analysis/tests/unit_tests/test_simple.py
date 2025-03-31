"""
Simple test for verifying test setup.

This test ensures the pytest framework is properly configured and running.
"""
import pytest

@pytest.mark.unit
def test_simple():
    """
    Test basic pytest functionality.
    
    Test Steps:
        1. Execute simple assertion
        2. Verify test framework is working
    """
    assert True 