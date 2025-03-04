import subprocess
import sys

def install_spacy_model():
    print("Installing spaCy English language model...")
    subprocess.check_call([sys.executable, "-m", "spacy", "download", "en_core_web_sm"])

def install_nltk_data():
    print("Installing NLTK data...")
    import nltk
    nltk.download('punkt')
    nltk.download('stopwords')
    nltk.download('punkt_tab')

if __name__ == "__main__":
    install_spacy_model()
    install_nltk_data() 