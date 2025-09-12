from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, JSON, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class AuditLog(Base):
    """
    Immutable Audit Log model for GxP compliance
    Records all user actions and data changes
    """
    __tablename__ = "audit_logs"
    
    # Composite indexes for performance
    __table_args__ = (
        Index('ix_audit_user_timestamp', 'user_id', 'timestamp'),
        Index('ix_audit_entity_timestamp', 'entity_type', 'entity_id', 'timestamp'),
        Index('ix_audit_action_timestamp', 'action', 'timestamp'),
    )

    id = Column(Integer, primary_key=True, index=True)
    
    # User who performed the action
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Action details
    action = Column(String(100), nullable=False, index=True)  # CREATE, UPDATE, DELETE, LOGIN, etc.
    entity_type = Column(String(50), nullable=True, index=True)  # project, document, matrix_entry, etc.
    entity_id = Column(Integer, nullable=True, index=True)
    
    # Change tracking (for UPDATE operations)
    field_name = Column(String(100), nullable=True)  # Which field was changed
    old_value = Column(JSON, nullable=True)  # Previous value
    new_value = Column(JSON, nullable=True)  # New value
    
    # Request metadata
    ip_address = Column(String(45), nullable=True)  # IPv4/IPv6 support
    user_agent = Column(Text, nullable=True)
    request_id = Column(String(36), nullable=True, index=True)  # UUID for correlation
    
    # Additional context
    details = Column(JSON, nullable=True)  # Additional action details
    error_message = Column(Text, nullable=True)  # For failed actions
    
    # GxP compliance timestamp (immutable)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Session information
    session_id = Column(String(255), nullable=True)
    
    # Electronic signature reference (21 CFR Part 11)
    signature_reference = Column(String(255), nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="audit_logs")
    
    def __repr__(self):
        return f"<AuditLog(id={self.id}, user_id={self.user_id}, action='{self.action}', timestamp='{self.timestamp}')>"
    
    @property
    def formatted_timestamp(self) -> str:
        """Return formatted timestamp for display"""
        return self.timestamp.strftime("%Y-%m-%d %H:%M:%S UTC")
    
    @classmethod
    def create_log(
        cls,
        user_id: int,
        action: str,
        entity_type: str = None,
        entity_id: int = None,
        field_name: str = None,
        old_value = None,
        new_value = None,
        ip_address: str = None,
        user_agent: str = None,
        request_id: str = None,
        details: dict = None,
        session_id: str = None
    ) -> 'AuditLog':
        """
        Factory method to create audit log entries
        
        Args:
            user_id: ID of user performing action
            action: Action being performed
            entity_type: Type of entity being modified
            entity_id: ID of entity being modified
            field_name: Name of field being changed (for updates)
            old_value: Previous value
            new_value: New value
            ip_address: Client IP address
            user_agent: Client user agent
            request_id: Request correlation ID
            details: Additional details
            session_id: User session ID
            
        Returns:
            AuditLog instance
        """
        return cls(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            ip_address=ip_address,
            user_agent=user_agent,
            request_id=request_id,
            details=details,
            session_id=session_id
        )