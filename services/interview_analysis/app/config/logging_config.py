import logging.config
import os
import sys
from .settings import settings

def setup_logging():
    """Configure logging for the application."""
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    
    # Ensure higher level of logging during startup for Cloud Run
    startup_level = logging.DEBUG if settings.DEBUG else logging.INFO
    
    logging_config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
                "datefmt": "%Y-%m-%d %H:%M:%S"
            },
            "json": {
                "()": "pythonjsonlogger.jsonlogger.JsonFormatter",
                "format": "%(asctime)s %(name)s %(levelname)s %(message)s"
            }
        },
        "handlers": {
            "console": {
                "class": "logging.StreamHandler",
                "formatter": "default",
                "level": startup_level,
                "stream": sys.stdout
            }
        },
        "loggers": {
            "": {  # Root logger
                "handlers": ["console"],
                "level": startup_level
            },
            "uvicorn": {
                "handlers": ["console"],
                "level": startup_level,
                "propagate": False
            },
            "uvicorn.error": {
                "handlers": ["console"],
                "level": startup_level,
                "propagate": False
            },
            "fastapi": {
                "handlers": ["console"],
                "level": startup_level,
                "propagate": False
            }
        }
    }
    
    # Apply configuration
    try:
        logging.config.dictConfig(logging_config)
        # Log that logging has been set up
        logging.info(f"Logging configured with level: {log_level}")
        logging.info(f"Running in {'production' if os.environ.get('K_SERVICE') else 'development'} mode")
    except Exception as e:
        # Fallback to basic configuration if dictConfig fails
        logging.basicConfig(
            level=startup_level,
            format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
            stream=sys.stdout
        )
        logging.error(f"Failed to configure logging with dictConfig: {str(e)}")
        logging.info("Using fallback basic logging configuration")