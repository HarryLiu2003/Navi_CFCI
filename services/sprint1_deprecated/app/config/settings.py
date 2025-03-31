import os
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
    CORS_ORIGINS: list = ["http://localhost:3000"]
    
    # Preprocessing Configuration
    MAX_TOKENS: int = 512
    
    # Logging Configuration
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    
    class Config:
        env_file = ".env"

settings = Settings() 