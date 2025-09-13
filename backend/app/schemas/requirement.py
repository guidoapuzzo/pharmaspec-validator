from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class RequirementBase(BaseModel):
    requirement_text: str = Field(..., min_length=1, description="The requirement description text")
    requirement_category: str = Field(..., description="Category of the requirement (e.g., Functional, Performance)")
    priority: str = Field(default="medium", description="Priority level: low, medium, high, critical")
    source_section: Optional[str] = Field(None, description="Section reference in source document")


class RequirementCreate(RequirementBase):
    """Schema for creating a new requirement"""
    document_id: int = Field(..., description="ID of the source document")


class RequirementUpdate(BaseModel):
    """Schema for updating requirement details"""
    requirement_text: Optional[str] = Field(None, min_length=1, description="Updated requirement text")
    requirement_category: Optional[str] = Field(None, description="Updated requirement category")
    priority: Optional[str] = Field(None, description="Updated priority level")
    source_section: Optional[str] = Field(None, description="Updated source section reference")


class Requirement(RequirementBase):
    """Schema for requirement response"""
    id: int
    document_id: int
    project_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True