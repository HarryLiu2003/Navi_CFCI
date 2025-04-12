"""
Pydantic models for validating the response from the Gemini persona suggestion pipeline.
"""
from pydantic import BaseModel, Field, validator
from typing import List

class PersonaSuggestions(BaseModel):
    """
    Defines the expected structure for persona suggestions.
    """
    existing_persona_ids: List[str] = Field(
        default_factory=list,
        description="List of IDs of existing personas identified as matches."
    )
    suggested_new_personas: List[str] = Field(
        default_factory=list, 
        description="List of names for suggested new personas (if no existing match)."
    )

    # @validator('suggested_new_personas') # Temporarily comment out validator
    # def check_suggestion_conditions(cls, suggested_new, values):
    #     """Validate that new personas are only suggested if no existing ones match."""
    #     existing_ids = values.get('existing_persona_ids')
    #     if existing_ids and suggested_new:
    #         # Allow some flexibility, maybe log a warning instead of raising an error?
    #         # For now, let's enforce the rule strictly as per the prompt.
    #         raise ValueError("New personas should not be suggested if existing personas are matched.")
    #     return suggested_new

    # Optional: Add more validators if needed, e.g., for the format of suggested names 