from sqlalchemy import Column, Integer, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class ProjectAccess(Base):
    """
    Project access tracking for password-protected projects
    Records when users have successfully verified project passwords
    """
    __tablename__ = "project_access"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, index=True)

    # Timestamp when access was verified
    verified_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="project_accesses")
    project = relationship("Project", back_populates="access_records")

    # Ensure one record per user-project pair
    __table_args__ = (
        UniqueConstraint('user_id', 'project_id', name='unique_user_project_access'),
    )

    def __repr__(self):
        return f"<ProjectAccess(user_id={self.user_id}, project_id={self.project_id})>"
