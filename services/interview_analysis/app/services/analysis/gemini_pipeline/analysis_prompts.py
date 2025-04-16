"""
Prompts for the multi-step Gemini API analysis pipeline using LangChain.
"""

from langchain.prompts import ChatPromptTemplate

# 1. Prompt to Identify Problem Areas
PROBLEM_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are an expert at analyzing interview transcripts to identify key problem areas.
    Review the conversation and identify 3-6 broad, mutually exclusive problem areas that represent the key issues discussed.
    
    For each problem area, provide:
    1. A unique ID (use a simple numeric string like "1", "2", "3", etc.)
    2. A short title (maximum 5 words)
    3. A detailed description (2-4 sentences) explaining the context and significance
    
    Format your response strictly as a JSON object containing a single key "problem_areas" which is an array of problem area objects.
    Each problem area object must contain:
    - problem_id: string (e.g., "1")
    - title: string (max 5 words)
    - description: string (2-4 sentences)
    
    Example:
    ```json
    {{
        "problem_areas": [
            {{
                "problem_id": "1",
                "title": "Inflexible Display Configuration",
                "description": "The current system lacks adaptive display layouts for different surgical phases. Users must manually reconfigure screens during critical moments, which is time-consuming and distracting."
            }},
            {{
                "problem_id": "2",
                "title": "Difficult Alarm Management",
                "description": "Users struggle to differentiate between critical and non-critical alarms. Alarm fatigue leads to missed important notifications."
            }}
        ]
    }}
    ```"""),
    ("user", "Analyze this interview transcript to identify the key problem areas:\n\nTranscript Start:\n{transcript}\nTranscript End")
])

# 2. Prompt to Extract Supporting Excerpts
EXCERPT_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are an expert at extracting and categorizing relevant excerpts from interviews based on pre-defined problem areas.
    For each problem area provided, find 2-4 supporting excerpts from the transcript that best illustrate the issue.
    
    Categories MUST be chosen ONLY from this list: 
    - "Pain Point": Specific challenges or frustrations
    - "Current Approach": How users currently handle the problem
    - "Ideal Solution": Desired improvements or solutions mentioned
    - "Impact": Effects on workflow, outcomes, or user experience
    
    **IMPORTANT: Do NOT invent new categories. Use ONLY the categories provided in the list above.**
    
    For each excerpt, provide:
    1. The exact quote from the transcript
    2. Relevant categories (can be multiple, must be from the list above)
    3. A brief insight that summarizes the key takeaway (1 sentence)
    4. The chunk number (must be the exact integer found *before* the timestamp in the original transcript. Chunk number must be between 1 and {max_chunk_number}).
    
    Format your response strictly as a JSON object containing a single key "problem_areas".
    This key should contain an array matching the input problem areas, but with an added "excerpts" array field within each.
    Each excerpt object must contain:
    - quote: string (Exact quote)
    - categories: array of strings (Only from the allowed list)
    - insight: string (1 sentence summary)
    - chunk_number: integer (Exact number from transcript)
    
    Example:
    ```json
    {{
        "problem_areas": [
            {{
                "problem_id": "1", 
                "excerpts": [
                    {{
                        "quote": "I constantly have to readjust the screen settings manually when we switch phases.",
                        "categories": ["Pain Point", "Current Approach"],
                        "insight": "Manual screen adjustment during phase changes is a recurring frustration.",
                        "chunk_number": 30
                    }}
                ]
            }}
        ]
    }}
    ```"""),
    ("user", """Problem Areas Provided:
    ```json
    {problem_areas}
    ```
    
    Find relevant excerpts from this transcript (max chunk number is {max_chunk_number}):
    
    Transcript Start:
    {transcript}
    Transcript End""")
])

# 3. Prompt to Synthesize Findings
SYNTHESIS_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are an expert at synthesizing interview insights and identifying key participants.
    Based on the provided problem areas and supporting excerpts:
    1. Identify the primary interviewee (the person being asked questions, not the interviewer conducting the interview).
    2. Generate a concise suggested title for the interview. Use the format 'Interview with [Interviewee Name]' or 'Catch up with [Interviewee Name]'. If the interviewee's role or company is clearly mentioned in the transcript context related to them, use 'Interview with [Interviewee Name] ([Role] at [Company])'. If the interviewee cannot be clearly identified, use 'Interview - [All Participant Name]'.
    3. Create a concise synthesis (approximately 100 words) summarizing key findings, relating problems, and discussing implications based *only* on the provided analysis content.
    
    Format your response strictly as a JSON object with two keys: "suggested_title" and "synthesis".
    
    Example:
    ```json
    {{
        "suggested_title": "Interview with Lisa Chen (PM at InnoTech)",
        "synthesis": "The interview highlights significant user frustration with the current system's inflexible display configuration, especially during critical phase transitions that demand focus. This inflexibility, coupled with difficulties in managing the high volume and poor differentiation of alarms, leads to increased cognitive load and potential workflow disruptions. Users clearly desire more automated screen adjustments tailored to procedural steps and much clearer, prioritized alarm notifications. Addressing these core usability issues around display adaptability and alarm fatigue appears crucial for improving user experience, reducing errors, and enhancing overall procedural efficiency and safety."
    }}
    ```"""),
    ("user", """Based on this analysis, identify the interviewee, generate a title, and create a concise synthesis:
    ```json
    {analyzed_content}
    ```
    Transcript Context (for interviewee identification):
    {transcript}
    """)
])

# Original single prompt (kept for reference, can be removed later)
# SYSTEM_PROMPT = ... (old prompt content) ... 