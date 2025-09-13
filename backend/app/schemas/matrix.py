from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class MatrixEntryBase(BaseModel):
    requirement_text: str = Field(..., min_length=1, description="The requirement text from URS")
    requirement_category: str = Field(..., description="Category of requirement (Functional, Performance, etc.)")
    specification_reference: str = Field(..., description="Reference to supplier specification section")
    test_method: str = Field(..., description="Proposed test method for verification")
    acceptance_criteria: str = Field(..., description="Criteria for accepting test results")
    verification_status: str = Field(default="pending", description="Status: pending, verified, failed")
    risk_assessment: Optional[str] = Field(None, description="Risk assessment notes")
    test_evidence: Optional[str] = Field(None, description="Evidence or test results documentation")


class MatrixEntryCreate(MatrixEntryBase):
    """Schema for creating a new matrix entry"""
    project_id: int = Field(..., description="ID of the associated project")
    requirement_id: Optional[int] = Field(None, description="Optional link to requirement record")


class MatrixEntryUpdate(BaseModel):
    """Schema for updating matrix entry"""
    requirement_text: Optional[str] = Field(None, min_length=1, description="Updated requirement text")
    requirement_category: Optional[str] = Field(None, description="Updated requirement category")
    specification_reference: Optional[str] = Field(None, description="Updated specification reference")
    test_method: Optional[str] = Field(None, description="Updated test method")
    acceptance_criteria: Optional[str] = Field(None, description="Updated acceptance criteria")
    verification_status: Optional[str] = Field(None, description="Updated verification status")
    risk_assessment: Optional[str] = Field(None, description="Updated risk assessment")
    test_evidence: Optional[str] = Field(None, description="Updated test evidence")


class MatrixEntry(MatrixEntryBase):
    """Schema for matrix entry response"""
    id: int
    project_id: int
    requirement_id: Optional[int]
    created_at: datetime
    updated_at: datetime
    created_by_id: int
    updated_by_id: Optional[int]

    class Config:
        from_attributes = True


class MatrixEntryWithDetails(MatrixEntry):
    """Extended schema with related data"""
    created_by: Optional[dict] = Field(None, description="User who created this entry")
    updated_by: Optional[dict] = Field(None, description="User who last updated this entry")