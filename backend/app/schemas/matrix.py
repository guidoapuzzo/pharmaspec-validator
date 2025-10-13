from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class MatrixEntryBase(BaseModel):
    spec_reference: Optional[str] = Field(None, description="Reference to supplier spec")
    supplier_response: Optional[str] = Field(None, description="How supplier addresses requirement")
    justification: Optional[str] = Field(None, description="Rationale for traceability")
    compliance_status: Optional[str] = Field(None, description="Compliant, Non-compliant, Partial, Requires Clarification")
    test_reference: Optional[str] = Field(None, description="Link to test cases")
    risk_assessment: Optional[str] = Field(None, description="Risk analysis")
    comments: Optional[str] = Field(None, description="Additional notes")


class MatrixEntryCreate(MatrixEntryBase):
    """Schema for creating a new matrix entry"""
    requirement_id: int = Field(..., description="ID of the associated requirement")
    document_id: int = Field(..., description="ID of the document this entry was generated from")


class MatrixEntryUpdate(BaseModel):
    """Schema for updating matrix entry"""
    spec_reference: Optional[str] = None
    supplier_response: Optional[str] = None
    justification: Optional[str] = None
    compliance_status: Optional[str] = None
    test_reference: Optional[str] = None
    risk_assessment: Optional[str] = None
    comments: Optional[str] = None


class MatrixEntryReview(BaseModel):
    """Schema for reviewing a matrix entry"""
    review_status: str = Field(..., description="pending, reviewed, approved")
    reviewer_comments: Optional[str] = Field(None, description="Review comments")


class MatrixEntry(MatrixEntryBase):
    """Schema for matrix entry response"""
    id: int
    requirement_id: int
    document_id: int
    generation_model: Optional[str] = None
    generated_at: Optional[datetime] = None
    generation_metadata: Optional[Dict[str, Any]] = None
    review_status: str
    reviewer_comments: Optional[str] = None
    approved_at: Optional[datetime] = None
    approved_by: Optional[int] = None
    created_by: int
    last_modified_by: Optional[int] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class AnalyzeDocumentRequest(BaseModel):
    """Request schema for analyzing document against requirements"""
    document_id: int = Field(..., description="ID of the document to analyze")
    requirement_ids: list[int] = Field(..., min_length=1, description="List of requirement IDs to analyze")
    force_regenerate: bool = Field(default=False, description="Force regenerate existing matrix entries")