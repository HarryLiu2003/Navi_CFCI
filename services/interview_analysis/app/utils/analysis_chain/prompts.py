from langchain_core.prompts import ChatPromptTemplate

# Prompt for extracting problem areas
PROBLEM_PROMPT = ChatPromptTemplate.from_template("""
You are an expert at analyzing interview transcripts to identify key problem areas.

Analyze the following interview transcript and extract the main problem areas mentioned by the interviewee.
Focus on challenges, pain points, and issues they face in their current workflow or solutions.

For each identified problem area, provide:
1. A unique ID (e.g., "scaling-infrastructure")
2. A concise title that summarizes the problem (e.g., "Infrastructure Scaling Issues")
3. A detailed description explaining the problem

TRANSCRIPT:
{transcript}

Format your response as a JSON object with a "problem_areas" array containing each problem area:
```json
{{
  "problem_areas": [
    {{
      "problem_id": "example-id",
      "title": "Example Problem Title",
      "description": "Detailed description of the problem"
    }}
  ]
}}
```

Limit your response to the most significant 3-5 problem areas.
""")

# Prompt for extracting excerpts
EXCERPT_PROMPT = ChatPromptTemplate.from_template("""
You are an expert at finding supporting evidence in interview transcripts.

Below are transcript chunks from an interview and a list of identified problem areas.
For each problem area, extract 2-3 supportive excerpts from the transcript that demonstrate this problem.

For each excerpt, provide:
1. The exact quote from the transcript
2. Relevant categories (ONLY use these categories: "Pain Point", "Current Approach", "Ideal Solution", "Impact")
3. A brief insight that summarizes what this quote reveals
4. The chunk number reference (important for tracing back to the original transcript)

TRANSCRIPT CHUNKS:
{transcript}

PROBLEM AREAS:
{problem_areas}

Maximum Chunk Number: {max_chunk_number}

Format your response as a JSON object with a "problem_areas" array:
```json
{{
  "problem_areas": [
    {{
      "problem_id": "example-id",
      "excerpts": [
        {{
          "quote": "Exact quote from transcript",
          "categories": ["Pain Point"],
          "insight": "Brief insight about this quote",
          "chunk_number": 42
        }}
      ]
    }}
  ]
}}
```

IMPORTANT: Only use these four categories: "Pain Point", "Current Approach", "Ideal Solution", or "Impact".
Only include chunk numbers that exist in the transcript (between 1 and {max_chunk_number}).
""")

# Prompt for generating final synthesis
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