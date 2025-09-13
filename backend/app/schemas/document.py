from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class DocumentBase(BaseModel):
    filename: str = Field(..., description="Original filename of the uploaded document")
    original_filename: str = Field(..., description="Original filename as uploaded by user")
    file_path: str = Field(..., description="Server file path where document is stored")
    file_size: int = Field(..., gt=0, description="File size in bytes")
    mime_type: str = Field(..., description="MIME type of the document")
    file_hash: str = Field(..., description="SHA-256 hash for integrity verification")
    extraction_status: str = Field(..., description="Status of AI extraction process")


class DocumentCreate(DocumentBase):
    """Schema for creating a new document"""
    pass


class DocumentUpdate(BaseModel):
    """Schema for updating document metadata"""
    filename: Optional[str] = Field(None, description="Updated filename")
    extraction_status: Optional[str] = Field(None, description="Updated extraction status")
    extracted_data: Optional[Dict[str, Any]] = Field(None, description="Extracted JSON data from Gemini API")
    processing_notes: Optional[str] = Field(None, description="Processing notes or error messages")


class Document(DocumentBase):
    """Schema for document response"""
    id: int
    project_id: int
    extracted_data: Optional[Dict[str, Any]] = Field(None, description="Extracted JSON data from Gemini API")
    processing_notes: Optional[str] = Field(None, description="Processing notes or error messages")
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True