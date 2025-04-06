import os
from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # API Configuration
    API_VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    
    # Gemini Configuration
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = "gemini-2.0-flash"
    
    # CORS Configuration
    # Get CORS origins from environment variable
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "http://localhost:3000")
    
    # Database Configuration
    DATABASE_API_URL: str = os.getenv("DATABASE_API_URL", "http://localhost:5001")
    
    # Logging Configuration
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    # Environment Setting
    NODE_ENV: str = os.getenv("NODE_ENV", "development")
    
    class Config:
        env_file = ".env"

settings = Settings() 