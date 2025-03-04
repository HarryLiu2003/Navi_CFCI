from fastapi import HTTPException
from typing import Any, Dict, Optional

class APIResponse:
    @staticmethod
    def success(data: Any, message: str = "Success") -> Dict:
        return {
            "status": "success",
            "message": message,
            "data": data
        }

    @staticmethod
    def error(message: str, status_code: int = 500, details: Optional[Any] = None) -> HTTPException:
        error_response = {
            "status": "error",
            "message": message
        }
        if details:
            error_response["details"] = details
        return HTTPException(status_code=status_code, detail=error_response) 