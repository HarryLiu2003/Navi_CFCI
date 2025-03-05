# Navi_CFCI
A product ops tool built for Navi with Duke CFCI

## Backend Setup
Create a new conda environment (Python 3.11):
```bash
conda create -n navi_env python=3.11
conda activate navi_env
```

Install pip requirements in your activated environment:
```bash
pip install -r requirements.txt
```

Run post-installation script to install spaCy models, NLTK data, etc.:
```bash
python post_install.py
```

Update your .env file in the backend folder with your API keys, for example:
```
OPENAI_API_KEY=your_openai_api_key
OPENAI_API_URL=your_openai_api_url
GEMINI_API_KEY=your_gemini_api_key
```

Finally, start the backend server:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

## Frontend Setup
Inside the frontend directory, do:
```bash
npm install
npm run dev
```

This will run the Next.js development server at http://localhost:3000.
