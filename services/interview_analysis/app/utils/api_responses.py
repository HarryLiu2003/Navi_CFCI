from fastapi import HTTPException
from typing import Dict, Any, Optional

class APIError(HTTPException):
    def __init__(self, message: str, status_code: int = 500, detail: Optional[Dict[str, Any]] = None):
        """
        Custom API exception class with standardized error format.
        
        Args:
            message: The error message to return to the client
            status_code: HTTP status code
            detail: Optional additional error details
        """
        # Create a standard error response format
        error_response = {
            "status": "error",
            "message": message
        }
        
        # Add any additional details if provided
        if detail:
            error_response["detail"] = detail
            
        super().__init__(status_code=status_code, detail=error_response)
        self.message = message
        self.detail = detail

class APIResponse:
    """
    Standard API response formatter.
    """
    
    @staticmethod
    def success(data: Any = None, message: str = "Success") -> Dict[str, Any]:
        """
        Create a standardized success response.
        
        Args:
            data: The response data
            message: Optional success message
            
        Returns:
            Dict with standard response format
        """
        return {
            "status": "success",
            "message": message,
            "data": data
        }
    
    @staticmethod
    def error(message: str, detail: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Create a standardized error response.
        
        Args:
            message: Error message
            detail: Optional error details
            
        Returns:
            Dict with standard error format
        """
        response = {
            "status": "error",
            "message": message
        }
        
        if detail:
            response["detail"] = detail
            
        return response 