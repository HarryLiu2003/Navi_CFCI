from pydantic import BaseModel, Field
from typing import List, Optional

class Excerpt(BaseModel):
    quote: str = Field(..., description="Quote from transcript")
    categories: List[str] = Field(default_factory=list, description="Categories like Pain Point, Feature Request, etc.")
    insight: str = Field(..., description="Brief summary of the insight")
    chunk_number: int = Field(..., description="Reference to transcript chunk number")

class ProblemArea(BaseModel):
    problem_id: str = Field(..., description="Unique identifier for problem area")
    title: str = Field(..., description="Short title of the problem")
    description: str = Field(..., description="Detailed description of the problem area")
    excerpts: List[Excerpt] = Field(default_factory=list, description="Supporting excerpts from transcript")

class AnalysisSynthesis(BaseModel):
    synthesis: str = Field(..., description="Final synthesis of the analysis as plain text") 