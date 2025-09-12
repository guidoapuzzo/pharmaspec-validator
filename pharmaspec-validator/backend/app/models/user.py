from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum

from app.core.database import Base


class UserRole(str, enum.Enum):
    """User roles for RBAC"""
    ENGINEER = "engineer"
    ADMIN = "admin"


class User(Base):
    """
    User model for authentication and authorization
    Supports GxP requirements with audit trail
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(
        Enum(UserRole), 
        nullable=False, 
        default=UserRole.ENGINEER,
        index=True
    )
    is_active = Column(Boolean, default=True, nullable=False)
    
    # GxP Compliance timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_login = Column(DateTime(timezone=True))
    password_changed_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Electronic signature tracking
    signature_token = Column(String(255))  # For 21 CFR Part 11 compliance
    
    # Relationships
    projects = relationship(
        "Project", 
        back_populates="owner",
        cascade="all, delete-orphan"
    )
    audit_logs = relationship(
        "AuditLog", 
        back_populates="user",
        cascade="all, delete-orphan"
    )
    matrix_entries_created = relationship(
        "MatrixEntry",
        back_populates="created_by_user",
        foreign_keys="[MatrixEntry.created_by]"
    )
    matrix_entries_modified = relationship(
        "MatrixEntry",
        back_populates="last_modified_by_user", 
        foreign_keys="[MatrixEntry.last_modified_by]"
    )
    
    def __repr__(self):
        return f"<User(id={self.id}, email='{self.email}', role='{self.role}')>"
    
    @property
    def scopes(self) -> list[str]:
        """Return OAuth2 scopes based on user role"""
        base_scopes = ["me"]
        
        if self.role == UserRole.ENGINEER:
            return base_scopes + ["engineer"]
        elif self.role == UserRole.ADMIN:
            return base_scopes + ["engineer", "admin", "audit"]
        
        return base_scopes