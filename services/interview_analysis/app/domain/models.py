"""
Core domain models for the interview analysis service.
These models represent the fundamental business entities independent of infrastructure.
"""
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime


class TranscriptChunk(BaseModel):
    """A chunk of transcript text with speaker information."""
    chunk_number: int
    speaker: str
    text: str


class Excerpt(BaseModel):
    """An excerpt from an interview transcript identified as significant."""
    text: str
    categories: List[str]
    insight_summary: str
    transcript_reference: Optional[str] = None
    chunk_number: Optional[int] = None


class ProblemArea(BaseModel):
    """A problem area identified in the interview."""
    problem_id: str
    title: str
    description: str
    excerpts: List[Excerpt]


class Synthesis(BaseModel):
    """Synthesis of the interview findings."""
    background: Optional[str] = None
    problem_areas: Optional[List[str]] = None
    next_steps: Optional[List[str]] = None


class AnalysisMetadata(BaseModel):
    """Metadata about the analysis."""
    transcript_length: int
    problem_areas_count: int
    excerpts_count: int


class StorageInfo(BaseModel):
    """Information about how/where the analysis is stored."""
    id: Optional[str] = None
    created_at: Optional[datetime] = None
    error: Optional[str] = None


class InterviewAnalysis(BaseModel):
    """Complete analysis of an interview transcript."""
    problem_areas: List[ProblemArea]
    transcript: List[TranscriptChunk]
    synthesis: Synthesis
    metadata: AnalysisMetadata
    storage: Optional[StorageInfo] = None 