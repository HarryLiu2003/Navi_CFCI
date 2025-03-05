from pydantic import BaseModel, Field
from typing import List, Optional
from pydantic import validator

class Excerpt(BaseModel):
    quote: str
    categories: List[str]
    insight: str
    chunk_number: int

    @validator('chunk_number')
    def validate_chunk_number(cls, v, values, **kwargs):
        if not (1 <= v <= values.get('max_chunk_number', float('inf'))):
            raise ValueError(f'Chunk number {v} is out of valid range')
        return v

class ProblemArea(BaseModel):
    problem_id: str
    title: str
    description: str
    excerpts: List[Excerpt]

class AnalysisSynthesis(BaseModel):
    problem_areas: List[ProblemArea]
    synthesis: str  # Changed to string for plain text synthesis
    metadata: dict 