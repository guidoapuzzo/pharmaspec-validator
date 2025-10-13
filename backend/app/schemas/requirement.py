from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class RequirementBase(BaseModel):
    requirement_id: str = Field(..., min_length=1, max_length=50, description="User-defined requirement ID (e.g., REQ-001)")
    description: str = Field(..., min_length=1, description="Requirement description text")
    category: Optional[str] = Field(None, max_length=100, description="Category (e.g., Functional, Performance, Security)")
    priority: str = Field(default="medium", description="Priority: low, medium, high")
    status: str = Field(default="pending", description="Status: pending, in_progress, completed")


class RequirementCreate(RequirementBase):
    """Schema for creating a new requirement"""
    pass


class RequirementUpdate(BaseModel):
    """Schema for updating requirement details"""
    requirement_id: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = Field(None, min_length=1)
    category: Optional[str] = Field(None, max_length=100)
    priority: Optional[str] = Field(None)
    status: Optional[str] = Field(None)


class Requirement(RequirementBase):
    """Schema for requirement response"""
    id: int
    project_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)