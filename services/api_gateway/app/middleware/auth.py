"""
Authentication middleware for the API Gateway.

This module provides middleware functions for verifying JWT tokens
and extracting user information from authenticated requests.
"""

from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from typing import Optional, Dict, Any
import os
import logging

# Set up logging
logger = logging.getLogger(__name__)

# Get JWT secret from environment
# Fallback to NEXTAUTH_SECRET since it's used by the frontend
JWT_SECRET = os.getenv("JWT_SECRET", os.getenv("NEXTAUTH_SECRET"))
if not JWT_SECRET:
    logger.warning("JWT_SECRET not set. Authentication will not work properly!")

# Create security scheme
security = HTTPBearer(auto_error=False)

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    """
    Verify JWT token and return payload.
    
    This function can be used as a dependency for routes that require authentication.
    It will raise an HTTPException if the token is invalid or missing.
    
    Returns:
        Dict containing the JWT payload with user information
    
    Raises:
        HTTPException: If token is missing or invalid
    """
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Missing authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        
        # Ensure the payload has a user ID
        if "sub" not in payload:
            raise HTTPException(
                status_code=401,
                detail="Invalid token payload: missing user ID",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.PyJWTError as e:
        logger.warning(f"JWT verification error: {str(e)}")
        raise HTTPException(
            status_code=401,
            detail=f"Invalid authentication token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_optional_user(request: Request) -> Optional[Dict[str, Any]]:
    """
    Get user from token if available, otherwise return None.
    
    This function can be used as a dependency for routes where authentication is optional.
    Unlike verify_token, it will not raise an exception if no token is provided or the token is invalid.
    
    Returns:
        Dict containing the JWT payload if token is valid, None otherwise
    """
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    
    token = auth_header.replace("Bearer ", "")
    try:
        if not JWT_SECRET:
            logger.warning("JWT_SECRET not set. Cannot verify token.")
            return None
            
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.PyJWTError as e:
        logger.warning(f"Invalid token in optional auth: {str(e)}")
        return None

def get_user_id_from_payload(payload: Dict[str, Any]) -> Optional[str]:
    """
    Extract the user ID from a JWT payload.
    
    NextAuth.js typically stores the user ID in the 'sub' claim.
    
    Args:
        payload: JWT token payload
        
    Returns:
        User ID as string or None if not found
    """
    if not payload:
        return None
        
    # NextAuth.js uses 'sub' for the user ID
    return payload.get("sub") 