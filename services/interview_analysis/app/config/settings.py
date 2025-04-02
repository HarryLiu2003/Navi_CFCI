import os
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
    CORS_ORIGINS: list = ["http://localhost:3000"]
    
    # Database Configuration
    DATABASE_API_URL: str = os.getenv("DATABASE_API_URL", "http://localhost:5001")
    
    # Logging Configuration
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    
    class Config:
        env_file = ".env"

settings = Settings() 