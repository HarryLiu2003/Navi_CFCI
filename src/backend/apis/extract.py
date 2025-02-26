import spacy
import nltk
from rake_nltk import Rake
from nltk.tokenize import word_tokenize
from collections import Counter
import os
from dotenv import load_dotenv
import openai
from openai import OpenAI


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

# Read the interview transcript from a file
def read_transcript(file_path):
    with open(file_path, "r", encoding="utf-8") as file:
        return file.read()

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

# Process the interview transcript
def process_interview(file_path):
    transcript_text = read_transcript(file_path)
    
    # Extract pain points using NER and RAKE
    ner_issues = extract_ner_issues(transcript_text)
    rake_keywords = extract_rake_keywords(transcript_text)

    # Combine extracted pain points
    all_pain_points = ner_issues + rake_keywords

    # Count frequency of extracted pain points
    pain_point_counts = Counter(all_pain_points)
    return pain_point_counts

def find_phrase_in_file(filename, phrase):
    results = []
    with open(filename, 'r', encoding='utf-8') as file:
        for line_number, line in enumerate(file, start=1):  # Read line by line
            if phrase in line:  # Fast substring search
                results.append((line_number, line.strip()))
    return results

def find_keyword_context(filename, results, window_size):
    lines = read_transcript(filename).split("\n")  # Split script into lines
    extracted_contexts = []
    
    for result in results:
        line_number = result[0]
        
        # Determine start and end line indices
        start_line = max(0, line_number - window_size)
        end_line = min(len(lines), line_number + window_size + 1)
        
        # Extract the context block
        context_block = "\n".join(lines[start_line:end_line])
        extracted_contexts.append(context_block)
    
    return extracted_contexts

api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key = api_key)

# Function to query OpenAI model (GPT-3 or GPT-4)
def query_openai(prompt, sections, model="gpt-4", max_tokens=150):
    response = client.chat.completions.create(
        messages=[{
            "role": "user",
            "content": prompt + sections
        }],
        model="gpt-4o-mini",
    )
    print(response.choices[0].message.content)

def main(file_path):
    sections = ""
    key = process_interview(file_path)
    for pain_point, count in key.items():
        if(len(pain_point.split(" "))>1 and count>2):
            result = find_phrase_in_file(file_path,pain_point)
            #print(result)
            sections += f"'\n'+{pain_point} -> {count} occurrence(s)"
            sections + str(find_keyword_context(file_path,result,3))
            #print(find_keyword_context(file_path,result,2))
            #print(f"'\n'+{pain_point} -> {count} occurrence(s)")

    query_openai(prompt, sections)


# Specify the path to your .txt file
<<<<<<< HEAD:src/backend/Extract.py
file_path = "./src/backend/Interview.txt"  # Change this to the actual file path
=======
file_path = "../resources/user_interview.txt"  # Change this to the actual file path
>>>>>>> 3316e55a47f15db005a3552b0db4eea0fd410ee4:src/backend/apis/extract.py
main(file_path)
#print(find_phrase_in_file(file_path, "cardiac status"))

#result = find_phrase_in_file(file_path,"cardiac status")
#print(result)
#print(find_keyword_context(file_path,result,3))
#query_openai(prompt)

