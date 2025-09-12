from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class Project(Base):
    """
    Project model for managing CSV validation projects
    Each project belongs to a single user (data isolation)
    """
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text)
    
    # Owner relationship for RBAC data isolation
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # GxP timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Soft delete for compliance
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    
    # Project status for workflow management
    status = Column(String(50), default="active", index=True)
    
    # Relationships
    owner = relationship("User", back_populates="projects")
    documents = relationship(
        "Document", 
        back_populates="project",
        cascade="all, delete-orphan"
    )
    requirements = relationship(
        "Requirement", 
        back_populates="project",
        cascade="all, delete-orphan"
    )
    
    def __repr__(self):
        return f"<Project(id={self.id}, name='{self.name}', owner_id={self.owner_id})>"