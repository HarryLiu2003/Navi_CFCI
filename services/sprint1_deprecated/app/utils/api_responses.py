from fastapi import HTTPException
from typing import Any, Dict, Optional

class APIError(HTTPException):
    def __init__(self, message: str, status_code: int = 500, detail: Optional[Dict[str, Any]] = None):
        """
        Custom API exception class with standardized error format.
        
        Args:
            message: The error message to return to the client
            status_code: HTTP status code
            detail: Optional additional error details
        """
        super().__init__(status_code=status_code, detail=message)
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
    def error(message: str, status_code: int = 500, detail: Optional[Dict[str, Any]] = None) -> APIError:
        """
        Create a standardized error response.
        
        Args:
            message: Error message
            status_code: HTTP status code
            detail: Optional error details
            
        Returns:
            APIError exception with standard error format
        """
        return APIError(message=message, status_code=status_code, detail=detail) 