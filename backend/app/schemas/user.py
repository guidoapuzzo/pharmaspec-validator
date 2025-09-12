from typing import Optional, List
from pydantic import BaseModel, EmailStr, validator
from datetime import datetime

from app.models.user import UserRole


class UserBase(BaseModel):
    """Base user schema with common fields"""
    email: EmailStr
    full_name: str
    role: UserRole = UserRole.ENGINEER
    is_active: bool = True


class UserCreate(UserBase):
    """Schema for creating new users"""
    password: str
    
    @validator('password')
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        return v


class UserUpdate(BaseModel):
    """Schema for updating users"""
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None


class UserInDB(UserBase):
    """User schema as stored in database"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    last_login: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class User(UserBase):
    """Public user schema (no sensitive data)"""
    id: int
    created_at: datetime
    last_login: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class Token(BaseModel):
    """JWT token response schema"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    scopes: List[str]


class TokenData(BaseModel):
    """JWT token payload data"""
    username: Optional[str] = None
    scopes: List[str] = []


class LoginRequest(BaseModel):
    """Login request schema"""
    username: str  # Email address
    password: str


class RefreshTokenRequest(BaseModel):
    """Refresh token request schema"""
    refresh_token: str


class PasswordChangeRequest(BaseModel):
    """Password change request schema"""
    current_password: str
    new_password: str
    
    @validator('new_password')
    def validate_new_password(cls, v):
        if len(v) < 8:
            raise ValueError('New password must be at least 8 characters long')
        return v