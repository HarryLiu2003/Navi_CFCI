"""
Model definitions for LLM chain inputs and outputs.
"""
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional


class Excerpt(BaseModel):
    """An excerpt identified in the transcript."""
    quote: str
    categories: List[str]
    insight: str
    transcript_reference: Optional[str] = None
    chunk_number: Optional[int] = None


class ProblemArea(BaseModel):
    """A problem area identified in the interview."""
    problem_id: str
    title: str
    description: str
    excerpts: List[Excerpt]


class SynthesisResult(BaseModel):
    """The complete analysis result."""
    problem_areas: List[ProblemArea]
    synthesis: str
    metadata: Optional[Dict[str, Any]] = None 