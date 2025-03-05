from langchain.prompts import ChatPromptTemplate

PROBLEM_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are an expert at analyzing interview transcripts to identify key problem areas.
    Review the conversation and identify 3-6 broad, mutually exclusive problem areas that represent the key issues discussed.
    
    For each problem area, provide:
    1. A short title (maximum 5 words)
    2. A unique ID (short slug)
    3. A detailed description (2-4 sentences) explaining the context and significance
    
    Format your response as a JSON array of problem areas, each containing:
    - problem_id: string (slug format)
    - title: string (max 5 words)
    - description: string (2-4 sentences)
    
    Example:
    {{
        "problem_areas": [
            {{
                "problem_id": "display-flexibility",
                "title": "Inflexible Display Configuration",
                "description": "The current system lacks adaptive display layouts for different surgical phases. Users must manually reconfigure screens during critical moments, which is time-consuming and distracting."
            }}
        ]
    }}"""),
    ("user", "Analyze this interview transcript to identify the key problem areas:\n\n{transcript}")
])

EXCERPT_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are an expert at extracting and categorizing relevant excerpts from interviews.
    For each problem area provided, find 2-4 supporting excerpts from the transcript that best illustrate the issue.
    
    Categories to consider:
    - Current Approach: How users currently handle the problem
    - Pain Point: Specific challenges or frustrations
    - Ideal Solution: Desired improvements or solutions
    - Impact: Effects on workflow or outcomes
    - Vague Problem Definition: Unclear or confusing aspects
    
    For each excerpt, provide:
    1. The exact quote from the transcript
    2. Relevant categories (can be multiple)
    3. A brief insight that summarizes the key takeaway (1 sentence)
    4. The VTT chunk number (must be the exact integer that appears before the timestamp in the original transcript. 
       Do not calculate or estimate this number - only use numbers you can see in the transcript.
       The chunk number must be between 1 and {max_chunk_number}).
    
    Format as JSON with each problem area containing its excerpts:
    {{
        "problem_areas": [
            {{
                "problem_id": "example-id",
                "excerpts": [
                    {{
                        "quote": "Exact quote from transcript",
                        "categories": ["Pain Point", "Impact"],
                        "insight": "Brief insight summary",
                        "chunk_number": 30
                    }}
                ]
            }}
        ]
    }}"""),
    ("user", """Here are the problem areas identified: {problem_areas}
    
    Find relevant excerpts from this transcript: {transcript}""")
])

SYNTHESIS_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """You are an expert at synthesizing interview insights into a clear narrative.
    Create a comprehensive synthesis that includes:
    
    1. A summary of the key findings and patterns
    2. How the identified problems relate to each other
    3. The broader implications for the product/service
    
    Format your response as a JSON object with a single 'synthesis' field containing
    two paragraphs of plain text analysis. The first paragraph should summarize the key findings,
    and the second should focus on implications and connections between issues."""),
    ("user", """Based on these problem areas and excerpts, create a synthesis:
    {analyzed_content}""")
]) 