"""
Pydantic models for validating and structuring Gemini API responses.
"""
from pydantic import BaseModel, Field, field_validator
from typing import List, Dict, Any, Optional, Union


class Excerpt(BaseModel):
    """An excerpt identified in the transcript with supporting evidence."""
    quote: str = Field(..., description="Direct quote from the transcript")
    categories: List[str] = Field(..., description="Categories such as 'Pain Point', 'Current Approach', etc.")
    insight: str = Field(..., description="Analysis of what this quote reveals")
    chunk_number: Optional[int] = Field(None, description="Reference to transcript chunk number")
    
    @field_validator('categories')
    @classmethod
    def validate_categories(cls, categories):
        """Ensure categories are from the allowed set."""
        allowed_categories = {"Pain Point", "Current Approach", "Ideal Solution", "Impact"}
        for category in categories:
            if category not in allowed_categories:
                raise ValueError(f"Invalid category: {category}. Must be one of {allowed_categories}")
        return categories


class ProblemArea(BaseModel):
    """A problem area identified in the interview."""
    problem_id: str = Field(..., description="Unique identifier for the problem area")
    title: str = Field(..., description="Short descriptive title")
    description: str = Field(..., description="Detailed explanation of the problem")
    excerpts: List[Excerpt] = Field(default_factory=list, description="Supporting evidence")
    
    @field_validator('problem_id')
    @classmethod
    def validate_problem_id(cls, value):
        """Ensure problem_id is numeric."""
        if not value.isdigit():
            raise ValueError("problem_id must be numeric")
        return value


class AnalysisResult(BaseModel):
    """The complete interview analysis result with problem areas and synthesis."""
    problem_areas: List[ProblemArea] = Field(..., description="Identified problem areas")
    synthesis: Union[str, Dict[str, Any]] = Field(..., description="Overall synthesis of findings")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    participants: Optional[List[str]] = Field(None, description="List of identified participant names")
    
    @field_validator('problem_areas')
    @classmethod
    def validate_problem_areas(cls, problem_areas):
        """Ensure we have a reasonable number of problem areas."""
        if not (1 <= len(problem_areas) <= 10):
            raise ValueError("Number of problem areas should be between 1 and 10")
        return problem_areas 