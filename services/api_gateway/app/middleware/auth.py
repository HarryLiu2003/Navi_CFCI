"""
Authentication middleware for the API Gateway.

Refactored (2025-04-04) to follow standard JWT validation practices.
- Validates `Authorization: Bearer <JWT>` strictly.
- Removes reliance on custom `X-User-ID` header.
- Provides clear, optional development-mode fallbacks.
"""

from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from typing import Optional, Dict, Any
import os
import logging

# Set up logging
logger = logging.getLogger(__name__)

# --- Environment Configuration ---
JWT_SECRET = os.getenv("JWT_SECRET", os.getenv("NEXTAUTH_SECRET"))
NODE_ENV = os.getenv("NODE_ENV", "development")
IS_PRODUCTION = NODE_ENV == "production"
ENABLE_DEV_AUTH = os.getenv("ENABLE_DEV_AUTH", "False").lower() == "true" and not IS_PRODUCTION
DEVELOPMENT_USER_ID = os.getenv("DEVELOPMENT_USER_ID", "dev-user-fallback-123")

if not JWT_SECRET and IS_PRODUCTION:
    logger.error("CRITICAL: JWT_SECRET is not set in production! Auth WILL fail.")

logger.info(f"Auth Middleware Config: PRODUCTION={IS_PRODUCTION}, DEV_AUTH_ENABLED={ENABLE_DEV_AUTH}")
if ENABLE_DEV_AUTH:
    logger.warning("Development authentication fallbacks are ENABLED.")

# --- Authentication Dependencies ---
security = HTTPBearer(auto_error=False)

async def verify_token(request: Request, credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Dict[str, Any]:
    """
    Strictly verifies JWT token from Authorization header.
    Raises HTTPException 401/500 if token is missing, invalid, expired, or improperly configured.
    NO development fallbacks apply here.
    """
    # logger.debug("verify_token: Attempting STRICT authentication.") # Reduce verbosity
    if not credentials:
        logger.warning("verify_token: No Authorization header found.")
        raise HTTPException(status_code=401, detail="Authorization header missing or invalid Bearer token", headers={"WWW-Authenticate": "Bearer"})

    token = credentials.credentials

    if not JWT_SECRET:
         logger.error("verify_token: JWT_SECRET not configured.")
         raise HTTPException(status_code=500, detail="Authentication configuration error on server")

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=["HS256"],
            options={"require": ["exp", "sub"], "verify_signature": True, "verify_exp": True}
        )
        if not payload.get("sub"): # Double check sub exists after decode
             logger.warning("verify_token: Token verified but 'sub' claim is missing or empty.")
             raise jwt.MissingRequiredClaimError('sub')
             
        logger.info(f"verify_token: Successfully verified token for user {payload.get('sub')}")
        payload["auth_source"] = "jwt_bearer_strict"
        return payload
        
    except jwt.ExpiredSignatureError:
        logger.warning("verify_token: Token has expired.")
        raise HTTPException(status_code=401, detail="Token has expired", headers={"WWW-Authenticate": "Bearer error=\"invalid_token\", error_description=\"Token has expired\""})
    except jwt.MissingRequiredClaimError as e:
         logger.warning(f"verify_token: Token missing required claim: {e}")
         raise HTTPException(status_code=401, detail=f"Invalid token: Missing required claim ('{e}')", headers={"WWW-Authenticate": "Bearer error=\"invalid_token\", error_description=\"Missing required claim\""})
    except jwt.InvalidSignatureError:
        logger.warning("verify_token: Invalid token signature.")
        raise HTTPException(status_code=401, detail="Invalid token signature", headers={"WWW-Authenticate": "Bearer error=\"invalid_token\", error_description=\"Invalid signature\""})
    except jwt.PyJWTError as e:
        logger.warning(f"verify_token: Invalid token - {e}")
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}", headers={"WWW-Authenticate": "Bearer error=\"invalid_token\""})
    except Exception as e:
         logger.error(f"verify_token: Unexpected error during token verification: {e}", exc_info=True)
         raise HTTPException(status_code=500, detail="Internal server error during authentication")


async def get_optional_user(request: Request, credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Optional[Dict[str, Any]]:
    """
    Gets user payload from Authorization Bearer token if valid and present.
    Applies development fallbacks ONLY if ENABLE_DEV_AUTH is true and no valid token is found.
    """
    # logger.debug("get_optional_user: Checking optional authentication.") # Reduce verbosity

    # 1. Try Bearer Token if provided
    if credentials:
        token = credentials.credentials
        # logger.debug(f"get_optional_user: Found Bearer token: {token[:10]}...") # Reduce verbosity
        if JWT_SECRET:
            try:
                payload = jwt.decode(
                    token,
                    JWT_SECRET,
                    algorithms=["HS256"],
                    options={"verify_signature": True, "verify_exp": True}
                )
                if "sub" not in payload: payload["sub"] = None # Ensure sub exists
                logger.info(f"get_optional_user: Successfully verified Bearer token for user {payload.get('sub')}")
                payload["auth_source"] = "jwt_bearer_optional"
                return payload
            except jwt.ExpiredSignatureError:
                logger.warning("get_optional_user: Bearer token has expired. Will use fallback if enabled.")
            except jwt.PyJWTError as e:
                logger.warning(f"get_optional_user: Invalid Bearer token - {e}. Will use fallback if enabled.")
            except Exception as e:
                 logger.error(f"get_optional_user: Unexpected error verifying Bearer token: {e}", exc_info=True)
        else: 
             logger.warning("get_optional_user: JWT_SECRET not set, cannot validate Bearer token. Will use fallback if enabled.")
    # else: # No credentials provided
    #    logger.debug("get_optional_user: No Authorization header provided.")

    # 2. Development Fallback (Only if ENABLE_DEV_AUTH is true and previous step failed)
    if ENABLE_DEV_AUTH:
        logger.warning("get_optional_user: No valid JWT found or JWT check failed, using development fallback user.")
        return {"sub": DEVELOPMENT_USER_ID, "name": "Development User", "is_dev_auth": True, "auth_source": "dev_fallback"}

    # 3. No Authentication Found (Production or Dev Auth Disabled)
    logger.info("get_optional_user: No valid authentication method succeeded and dev fallback disabled.")
    return None


def get_user_id_from_payload(payload: Optional[Dict[str, Any]]) -> Optional[str]:
    """
    Safely extract the user ID ('sub' claim preferred) from a decoded payload.
    """
    if not payload:
        logger.warning("get_user_id_from_payload: Received empty payload.")
        if ENABLE_DEV_AUTH:
             logger.warning("get_user_id_from_payload: Using dev fallback ID due to empty payload.")
             return DEVELOPMENT_USER_ID
        return None

    auth_source = payload.get("auth_source", "unknown")

    # Primary: Standard 'sub' claim
    user_id = payload.get("sub")
    if user_id:
        user_id_str = str(user_id)
        # logger.info(f"get_user_id_from_payload: Extracted user ID '{user_id_str}' from 'sub' claim (source: {auth_source}).") # Reduce verbosity
        return user_id_str

    # Fallback claims (less standard)
    for claim in ["id", "userId", "user_id", "jti"]:
        user_id = payload.get(claim)
        if user_id:
             user_id_str = str(user_id)
             logger.warning(f"get_user_id_from_payload: Extracted user ID '{user_id_str}' from fallback claim '{claim}' (source: {auth_source}).")
             return user_id_str

    # If no ID found, use dev fallback only if dev auth is enabled 
    if ENABLE_DEV_AUTH:
        logger.warning(f"get_user_id_from_payload: No standard ID claim found in payload (source: {auth_source}), using dev fallback ID.")
        return DEVELOPMENT_USER_ID

    # Production: No ID found, return None
    logger.error(f"get_user_id_from_payload: Could not find user ID in payload (source: {auth_source}). Payload keys: {list(payload.keys())}")
    return None 