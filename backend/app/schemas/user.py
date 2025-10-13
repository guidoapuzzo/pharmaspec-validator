from typing import Optional, List, Annotated
from pydantic import BaseModel, field_validator, Field
from datetime import datetime

from app.models.user import UserRole


# Custom email type that allows .local domains for development
EmailString = Annotated[str, Field(pattern=r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$')]


class UserBase(BaseModel):
    """Base user schema with common fields"""
    email: EmailString
    full_name: str
    role: UserRole = UserRole.ENGINEER
    is_active: bool = True
    
    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        """Validate email format (allowing .local for development)"""
        if '@' not in v:
            raise ValueError('Invalid email format')
        return v.lower()


class UserCreate(UserBase):
    """Schema for creating new users"""
    password: str
    
    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        return v


class UserUpdate(BaseModel):
    """Schema for updating users"""
    email: Optional[EmailString] = None
    full_name: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    
    @field_validator('email')
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        """Validate email format (allowing .local for development)"""
        if v and '@' not in v:
            raise ValueError('Invalid email format')
        return v.lower() if v else v


class UserInDB(UserBase):
    """User schema as stored in database"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    last_login: Optional[datetime] = None
    
    model_config = {"from_attributes": True}


class User(UserBase):
    """Public user schema (no sensitive data)"""
    id: int
    created_at: datetime
    last_login: Optional[datetime] = None
    
    model_config = {"from_attributes": True}


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
    
    @field_validator('new_password')
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError('New password must be at least 8 characters long')
        return v
