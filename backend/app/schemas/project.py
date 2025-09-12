from typing import Optional, List
from pydantic import BaseModel, validator
from datetime import datetime

from app.schemas.user import User


class ProjectBase(BaseModel):
    """Base project schema"""
    name: str
    description: Optional[str] = None
    status: str = "active"
    
    @validator('name')
    def validate_name(cls, v):
        if not v or len(v.strip()) < 3:
            raise ValueError('Project name must be at least 3 characters long')
        return v.strip()


class ProjectCreate(ProjectBase):
    """Schema for creating projects"""
    pass


class ProjectUpdate(BaseModel):
    """Schema for updating projects"""
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    
    @validator('name')
    def validate_name(cls, v):
        if v is not None and len(v.strip()) < 3:
            raise ValueError('Project name must be at least 3 characters long')
        return v.strip() if v else v


class Project(ProjectBase):
    """Public project schema"""
    id: int
    owner_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class ProjectWithOwner(Project):
    """Project schema with owner information"""
    owner: User
    
    class Config:
        from_attributes = True


class ProjectSummary(BaseModel):
    """Project summary for dashboard"""
    id: int
    name: str
    description: Optional[str]
    status: str
    created_at: datetime
    documents_count: int = 0
    requirements_count: int = 0
    matrix_entries_count: int = 0
    completion_percentage: float = 0.0
    
    class Config:
        from_attributes = True