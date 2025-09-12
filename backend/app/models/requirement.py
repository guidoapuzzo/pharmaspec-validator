from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Requirement(Base):
    """
    User Requirements model
    Stores the requirements that need to be traced in the matrix
    """
    __tablename__ = "requirements"

    id = Column(Integer, primary_key=True, index=True)
    requirement_id = Column(String(50), nullable=False, index=True)  # User-defined ID (e.g., "REQ-001")
    description = Column(Text, nullable=False)
    category = Column(String(100), nullable=True, index=True)  # Functional, Performance, etc.
    
    # Priority and status for workflow management
    priority = Column(String(20), default="medium", index=True)  # high, medium, low
    status = Column(String(50), default="pending", index=True)  # pending, in_progress, completed
    
    # Project relationship
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)
    
    # GxP timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Soft delete for compliance
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    project = relationship("Project", back_populates="requirements")
    matrix_entries = relationship(
        "MatrixEntry", 
        back_populates="requirement",
        cascade="all, delete-orphan"
    )
    
    def __repr__(self):
        return f"<Requirement(id={self.id}, requirement_id='{self.requirement_id}', project_id={self.project_id})>"