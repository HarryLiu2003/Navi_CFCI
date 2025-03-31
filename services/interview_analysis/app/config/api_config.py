import os
from dotenv import load_dotenv
import logging

# Configure logging
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

class APIConfig:
    """API configuration and credentials."""
    
    # Load API keys with error handling
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
    
    # Log API key status (not the actual key)
    if GEMINI_API_KEY:
        logger.info("GEMINI_API_KEY is set")
    else:
        logger.error("GEMINI_API_KEY is not set - service will not function correctly")
        logger.error("Please ensure you have a .env file with a valid GEMINI_API_KEY")

    # Model configuration
    GEMINI_MODEL = "gemini-2.0-flash"
    
    # Request configuration
    REQUEST_TIMEOUT = 30  # seconds
    MAX_RETRIES = 2
    
    @classmethod
    def validate_config(cls):
        """Validate that required configuration is present."""
        missing_vars = []
        
        if not cls.GEMINI_API_KEY:
            missing_vars.append("GEMINI_API_KEY")
            
        if missing_vars:
            error_msg = f"Missing required environment variables: {', '.join(missing_vars)}"
            logger.error(error_msg)
            logger.error("Please add these variables to your .env file or environment")
            raise ValueError(error_msg)
            
        # Basic validation of API key format (this doesn't check if it works)
        if cls.GEMINI_API_KEY and len(cls.GEMINI_API_KEY) < 20:
            logger.warning("GEMINI_API_KEY appears to be too short, it may be invalid")

# Validate on import
try:
    APIConfig.validate_config()
except ValueError as e:
    logger.error(f"API config validation failed: {str(e)}")
    logger.error("The service will likely fail to process requests due to missing configuration") 