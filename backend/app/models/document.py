from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, JSON, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Document(Base):
    """
    Document model for storing supplier specification documents
    Contains extracted JSON data from Gemini API
    """
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size = Column(BigInteger, nullable=False)  # Size in bytes
    mime_type = Column(String(100), nullable=False)
    
    # SHA-256 hash for integrity verification (GxP requirement)
    file_hash = Column(String(64), nullable=False, index=True)
    
    # Extracted JSON data from Gemini API (Step 1 of AI workflow)
    extracted_json = Column(JSON, nullable=True)
    extraction_status = Column(String(50), default="pending", index=True)
    extraction_model = Column(String(100), nullable=True)  # Track which model was used
    extracted_at = Column(DateTime(timezone=True), nullable=True)
    extraction_error = Column(Text, nullable=True)
    
    # Project relationship
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    
    # GxP timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Soft delete for compliance
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    project = relationship("Project", back_populates="documents")
    matrix_entries = relationship("MatrixEntry", back_populates="document")
    
    def __repr__(self):
        return f"<Document(id={self.id}, filename='{self.filename}', project_id={self.project_id})>"
    
    @property
    def is_extracted(self) -> bool:
        """Check if document has been successfully extracted"""
        return self.extraction_status == "completed" and self.extracted_json is not None
    
    @property
    def file_size_mb(self) -> float:
        """Return file size in megabytes"""
        return round(self.file_size / (1024 * 1024), 2)