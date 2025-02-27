from fastapi import FastAPI, UploadFile, File, HTTPException, APIRouter
import spacy
import nltk  # Even though not directly used, better to keep if potentially used by RAKE
from rake_nltk import Rake
from collections import Counter
import os
from dotenv import load_dotenv
from openai import OpenAI

router = APIRouter()

prompt = """Extract the key pain points and demands that the user is making in this user interview script. Be as specific if you can.
Sections of the script are given based on the locations of relevant phrases and keywords. 
If a key point or demand is not identified, then move on. Here are the following sections: 
"""

#Loading the OpenAI API KEY
load_dotenv()

# Load spaCy's pre-trained NER model
nlp = spacy.load("en_core_web_sm")

# Initialize RAKE (Rapid Automatic Keyword Extraction)
rake = Rake()

# Function to extract named entities related to issues
def extract_ner_issues(text):
    doc = nlp(text)
    issues = [ent.text for ent in doc.ents if ent.label_ in {"ORG", "PRODUCT", "EVENT"}]
    return issues

# Function to extract keywords using RAKE
def extract_rake_keywords(text):
    rake.extract_keywords_from_text(text)
    keywords = rake.get_ranked_phrases()  # Get the top-ranked phrases
    return keywords

# Process the interview transcript (now accepts content directly)
def process_interview(transcript_text: str):
    """Processes the transcript content to extract key pain points."""
    
    # Extract pain points using NER and RAKE
    ner_issues = extract_ner_issues(transcript_text)
    rake_keywords = extract_rake_keywords(transcript_text)

    # Combine extracted pain points
    all_pain_points = ner_issues + rake_keywords

    # Count frequency of extracted pain points
    pain_point_counts = Counter(all_pain_points)
    return pain_point_counts


def find_phrase_in_file(content: str, phrase: str):
    results = []
    lines = content.splitlines()
    for line_number, line in enumerate(lines, start=1):  # Read line by line
        if phrase in line:  # Fast substring search
            results.append((line_number, line.strip()))
    return results


def find_keyword_context(content: str, results, window_size):
    lines = content.splitlines()
    extracted_contexts = []

    for result in results:
        line_number = result[0]

        # Determine start and end line indices
        start_line = max(0, line_number - window_size - 1)
        end_line = min(len(lines), line_number + window_size)  # Ensure proper indexing

        # Extract the context block
        context_block = "\n".join(lines[start_line:end_line])
        extracted_contexts.append(context_block)

    return extracted_contexts


api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=api_key)

# Function to query OpenAI model GPT-4
def query_openai(prompt, sections):
    response = client.chat.completions.create(
        messages=[{
            "role": "user",
            "content": prompt + sections
        }],
        model="gpt-4o-mini", #This might be wrong, confirm in the actual documentation
    )
    return response.choices[0].message.content  # Return the content


@router.post("/process")
async def analyze_transcript(file: UploadFile = File(...)):
    """
    Analyzes a transcript file to extract key pain points and summaries using NER, RAKE, and OpenAI.
    """
    try:
        content = await file.read()
        transcript_text = content.decode("utf-8")
        
        sections = ""
        key_points = process_interview(transcript_text)
        
        for pain_point, count in key_points.items():
            if len(pain_point.split(" ")) > 1 and count > 2:
                results = find_phrase_in_file(transcript_text, pain_point) # use transcript_text

                context = find_keyword_context(transcript_text, results, 3) #use transcript_text
                sections += f"\n{pain_point} -> {count} occurrence(s)"
                sections += "\n".join(context)
        
        summary = query_openai(prompt, sections)
        return {"summary": summary}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

