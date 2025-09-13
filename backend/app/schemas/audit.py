from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class AuditLogResponse(BaseModel):
    """Schema for audit log entries in API responses"""
    id: int
    user_id: int
    action: str = Field(..., description="Action performed (create, update, delete, etc.)")
    resource_type: str = Field(..., description="Type of resource affected (project, matrix_entry, etc.)")
    resource_id: Optional[int] = Field(None, description="ID of the affected resource")
    old_value: Optional[Dict[str, Any]] = Field(None, description="Previous values before change")
    new_value: Optional[Dict[str, Any]] = Field(None, description="New values after change")
    ip_address: Optional[str] = Field(None, description="Client IP address")
    user_agent: Optional[str] = Field(None, description="Client user agent string")
    session_id: Optional[str] = Field(None, description="Session identifier")
    timestamp: datetime = Field(..., description="When the action occurred")
    
    # Related user information
    user_email: Optional[str] = Field(None, description="Email of user who performed action")
    user_full_name: Optional[str] = Field(None, description="Full name of user who performed action")

    class Config:
        from_attributes = True


class AuditLogFilter(BaseModel):
    """Schema for filtering audit log queries"""
    user_id: Optional[int] = Field(None, description="Filter by specific user")
    action: Optional[str] = Field(None, description="Filter by action type")
    resource_type: Optional[str] = Field(None, description="Filter by resource type")
    resource_id: Optional[int] = Field(None, description="Filter by specific resource")
    start_date: Optional[datetime] = Field(None, description="Filter entries after this date")
    end_date: Optional[datetime] = Field(None, description="Filter entries before this date")
    limit: int = Field(default=100, ge=1, le=1000, description="Maximum number of entries to return")
    offset: int = Field(default=0, ge=0, description="Number of entries to skip")