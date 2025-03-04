import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class APIConfig:
    # Centralize API configurations
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    OPENAI_API_URL = os.getenv("OPENAI_API_URL")
    
    MODEL_CONFIGS = {
        "openai": {
            "api_url": OPENAI_API_URL,
            "api_key": OPENAI_API_KEY,
            "model_name": "gpt-4-0125-preview"
        }
    }

    @classmethod
    def validate_api_keys(cls):
        missing_vars = [var for var in ["OPENAI_API_KEY", "OPENAI_API_URL"] 
                       if not getattr(cls, var)]
        if missing_vars:
            raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")

# Validate on import
APIConfig.validate_api_keys() 