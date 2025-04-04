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
import json
import base64

# Set up logging
logger = logging.getLogger(__name__)

# --- Environment Configuration ---
# JWT Secret (required for production JWT validation)
JWT_SECRET = os.getenv("JWT_SECRET", os.getenv("NEXTAUTH_SECRET"))
if not JWT_SECRET and os.getenv("NODE_ENV") == "production":
    logger.error("CRITICAL: JWT_SECRET is not set in production!")

# Development Mode Auth Helpers (Use with caution!)
NODE_ENV = os.getenv("NODE_ENV", "development")
IS_PRODUCTION = NODE_ENV == "production"
ENABLE_DEV_AUTH = os.getenv("ENABLE_DEV_AUTH", "False").lower() == "true" and not IS_PRODUCTION
DEVELOPMENT_USER_ID = os.getenv("DEVELOPMENT_USER_ID", "dev-user-fallback-123")
# Allow X-User-ID header in all environments if set, as it's used for internal proxy
ALLOW_X_USER_ID_HEADER = os.getenv("ALLOW_X_USER_ID_HEADER", "True").lower() == "true" 

logger.info(f"Auth Middleware Config: NODE_ENV={NODE_ENV}, IS_PRODUCTION={IS_PRODUCTION}, ENABLE_DEV_AUTH={ENABLE_DEV_AUTH}, ALLOW_X_USER_ID_HEADER={ALLOW_X_USER_ID_HEADER}")
if ENABLE_DEV_AUTH:
    logger.warning("Development authentication fallbacks are ENABLED.")
if ALLOW_X_USER_ID_HEADER:
    logger.warning("Allowing authentication via X-User-ID header is ENABLED.") # Updated log


# --- Authentication Dependencies ---

security = HTTPBearer(auto_error=False) # auto_error=False prevents FastAPI from raising 401 automatically

async def verify_token(request: Request, credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Dict[str, Any]:
    """
    Verify JWT token from Authorization header (Required Authentication).

    Used as a dependency for routes that strictly require a valid JWT.
    Raises HTTPException 401 if no valid token is found.
    Development fallbacks do NOT apply here.

    Args:
        request: FastAPI request object.
        credentials: Parsed Authorization header (Bearer scheme).

    Returns:
        Decoded JWT payload dictionary.

    Raises:
        HTTPException: 401 if token is missing, invalid, or expired.
    """
    logger.debug("verify_token: Attempting required authentication.")
    if not credentials:
        logger.warning("verify_token: No Authorization header found.")
        raise HTTPException(
            status_code=401,
            detail="Missing Bearer token",
            headers={"WWW-Authenticate": "Bearer"}
        )

    token = credentials.credentials
    logger.debug(f"verify_token: Received token: {token[:10]}...")

    if not JWT_SECRET:
         logger.error("verify_token: JWT_SECRET not set, cannot validate token.")
         raise HTTPException(status_code=500, detail="Authentication configuration error")

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=["HS256"],
            options={"require": ["exp", "sub"]} # Require expiration and subject
        )
        logger.info(f"verify_token: Successfully verified token for user {payload.get('sub')}")
        payload["auth_source"] = "jwt_bearer_required"
        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("verify_token: Token has expired.")
        raise HTTPException(
            status_code=401,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer error=\"invalid_token\""}
        )
    except jwt.MissingRequiredClaimError as e:
         logger.warning(f"verify_token: Token missing required claim: {e}")
         raise HTTPException(
             status_code=401,
             detail=f"Invalid token: Missing required claim ({e})",
             headers={"WWW-Authenticate": "Bearer error=\"invalid_token\""}
         )
    except jwt.PyJWTError as e:
        logger.warning(f"verify_token: Invalid token - {e}")
        raise HTTPException(
            status_code=401,
            detail=f"Invalid token: {e}",
            headers={"WWW-Authenticate": "Bearer error=\"invalid_token\""}
        )
    except Exception as e:
         logger.error(f"verify_token: Unexpected error during token verification: {e}", exc_info=True)
         raise HTTPException(status_code=500, detail="Internal server error during authentication")


async def get_optional_user(request: Request, credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Optional[Dict[str, Any]]:
    """
    Get user information from token if available (Optional Authentication).

    Used as a dependency for routes where authentication is optional or uses fallbacks.
    Prioritizes Bearer token, then X-User-ID (if allowed), then dev fallbacks.

    Args:
        request: FastAPI request object.
        credentials: Parsed Authorization header (Bearer scheme).

    Returns:
        Decoded JWT payload dictionary if successful, or a fallback dev payload, or None.
    """
    logger.debug("get_optional_user: Checking optional authentication.")

    # 1. Try Bearer Token
    if credentials:
        token = credentials.credentials
        logger.debug(f"get_optional_user: Found Bearer token: {token[:10]}...")
        if JWT_SECRET:
            try:
                payload = jwt.decode(
                    token,
                    JWT_SECRET,
                    algorithms=["HS256"],
                     # Don't strictly require exp/sub here, let get_user_id_from_payload handle it
                    options={"verify_signature": True, "verify_exp": True}
                )
                logger.info(f"get_optional_user: Successfully verified Bearer token for user {payload.get('sub')}")
                payload["auth_source"] = "jwt_bearer_optional"
                return payload
            except jwt.ExpiredSignatureError:
                logger.warning("get_optional_user: Bearer token has expired.")
                # Allow fallback below
            except jwt.PyJWTError as e:
                logger.warning(f"get_optional_user: Invalid Bearer token - {e}. Trying fallbacks.")
                # Allow fallback below
            except Exception as e:
                 logger.error(f"get_optional_user: Unexpected error verifying Bearer token: {e}", exc_info=True)
                 # Don't fallback on unexpected errors, but try X-User-ID etc.
        else:
             logger.warning("get_optional_user: JWT_SECRET not set, cannot validate Bearer token. Trying fallbacks.")

    # 2. Try X-User-ID Header (If allowed by config)
    if ALLOW_X_USER_ID_HEADER:
        user_id_header = request.headers.get("X-User-ID")
        if user_id_header:
            logger.info(f"get_optional_user: Using user ID from X-User-ID header: {user_id_header}")
            return {"sub": user_id_header, "name": "Header User", "auth_source": "x_user_id_header"}

    # 3. Try Development Header Override (Only in Dev)
    if ENABLE_DEV_AUTH:
        dev_auth_header = request.headers.get("X-Development-Auth")
        if dev_auth_header and dev_auth_header.lower() == "true":
            logger.warning("get_optional_user: Using development auth from X-Development-Auth header.")
            return {"sub": DEVELOPMENT_USER_ID, "name": "Development User", "is_dev_auth": True, "auth_source": "dev_header"}

    # 4. Development Fallback (Only in Dev, if previous steps failed)
    if ENABLE_DEV_AUTH:
        logger.warning("get_optional_user: No valid authentication found, using development fallback user.")
        return {"sub": DEVELOPMENT_USER_ID, "name": "Development User", "is_dev_auth": True, "auth_source": "dev_fallback"}

    # 5. No Authentication Found (Production or Dev Auth Disabled)
    logger.info("get_optional_user: No valid authentication method succeeded.")
    return None


def get_user_id_from_payload(payload: Optional[Dict[str, Any]]) -> Optional[str]:
    """
    Safely extract the user ID ('sub' claim preferred) from a decoded payload.

    Args:
        payload: The decoded JWT payload (or fallback dict).

    Returns:
        User ID string or None.
    """
    if not payload:
        logger.warning("get_user_id_from_payload: Received empty payload.")
        # Use dev fallback only if dev auth is enabled explicitly
        if ENABLE_DEV_AUTH:
             logger.warning("get_user_id_from_payload: Using dev fallback ID due to empty payload.")
             return DEVELOPMENT_USER_ID
        return None

    auth_source = payload.get("auth_source", "unknown")

    # Standard 'sub' claim
    if "sub" in payload and payload["sub"]:
        user_id = str(payload["sub"])
        logger.info(f"get_user_id_from_payload: Extracted user ID '{user_id}' from 'sub' claim (source: {auth_source}).")
        return user_id

    # Fallback claims (less standard but seen sometimes)
    for claim in ["id", "userId", "user_id", "jti"]:
        if claim in payload and payload[claim]:
             user_id = str(payload[claim])
             logger.warning(f"get_user_id_from_payload: Extracted user ID '{user_id}' from fallback claim '{claim}' (source: {auth_source}).")
             return user_id

    # If no standard ID found, use dev fallback if enabled
    if ENABLE_DEV_AUTH:
        logger.warning(f"get_user_id_from_payload: No standard ID claim found in payload (source: {auth_source}), using dev fallback ID.")
        return DEVELOPMENT_USER_ID

    logger.error(f"get_user_id_from_payload: Could not find user ID in payload (source: {auth_source}). Payload keys: {list(payload.keys())}")
    return None 