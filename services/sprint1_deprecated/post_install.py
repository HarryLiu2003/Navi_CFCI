#!/usr/bin/env python3
import subprocess
import sys
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("post_install")

def install_spacy_model():
    """Install the SpaCy English language model."""
    logger.info("Installing spaCy English language model...")
    try:
        subprocess.check_call([sys.executable, "-m", "spacy", "download", "en_core_web_sm"])
        logger.info("SpaCy model installed successfully.")
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to install SpaCy model: {e}")
        raise

def install_nltk_data():
    """Install required NLTK data."""
    logger.info("Installing NLTK data...")
    try:
        import nltk
        nltk.download('punkt')
        nltk.download('stopwords')
        logger.info("NLTK data installed successfully.")
    except Exception as e:
        logger.error(f"Failed to install NLTK data: {e}")
        raise

if __name__ == "__main__":
    logger.info("Starting post-installation setup for sprint1_deprecated service...")
    try:
        install_spacy_model()
        install_nltk_data()
        logger.info("Post-installation completed successfully.")
    except Exception as e:
        logger.error(f"Post-installation failed: {e}")
        sys.exit(1) 