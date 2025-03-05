from pydantic import BaseModel, Field
from typing import List, Optional

class Excerpt(BaseModel):
    quote: str
    categories: List[str]
    insight: str
    timestamp: str

class ProblemArea(BaseModel):
    problem_id: str
    title: str
    description: str
    excerpts: List[Excerpt]

class AnalysisSynthesis(BaseModel):
    problem_areas: List[ProblemArea]
    synthesis: str  # Changed to string for plain text synthesis
    metadata: dict 