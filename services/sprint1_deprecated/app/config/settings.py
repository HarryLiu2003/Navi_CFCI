import os
from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # API Configuration
    API_VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    
    # OpenAI Configuration
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL: str = "gpt-4-turbo-preview"
    
    # CORS Configuration
    # Instead of directly defining as a list, we'll parse from environment variables
    CORS_ORIGINS_STR: str = os.getenv("CORS_ORIGINS", "http://localhost:3000")
    
    # Preprocessing Configuration
    MAX_TOKENS: int = 512
    
    # Logging Configuration
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    # Environment Setting (development, production, etc.)
    NODE_ENV: str = os.getenv("NODE_ENV", "development")
    
    class Config:
        env_file = ".env"
    
    @property
    def CORS_ORIGINS(self) -> List[str]:
        """Parse CORS_ORIGINS from environment variable string."""
        if self.CORS_ORIGINS_STR:
            return [origin.strip() for origin in self.CORS_ORIGINS_STR.split(",")]
        return ["http://localhost:3000"]  # Default fallback

settings = Settings() 