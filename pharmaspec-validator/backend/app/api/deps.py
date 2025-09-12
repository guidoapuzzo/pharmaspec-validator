from typing import Optional
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer, SecurityScopes
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import ValidationError
import secrets

from app.core.database import get_db
from app.core.security import verify_token
from app.core.config import settings
from app.models.user import User
from app.models.audit_log import AuditLog
from app.schemas.user import TokenData


# OAuth2 scheme with scopes as per FastAPI best practices
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/token",
    scopes={
        "me": "Access to own profile information",
        "engineer": "Standard validation engineer access", 
        "admin": "Administrative access to all projects",
        "audit": "Access to audit trail information"
    }
)


async def get_current_user(
    security_scopes: SecurityScopes,
    db: AsyncSession = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    """
    Get current user from JWT token with scope validation
    Following FastAPI security best practices from Context7
    """
    # Build authentication value for WWW-Authenticate header
    if security_scopes.scopes:
        authenticate_value = f'Bearer scope="{security_scopes.scope_str}"'
    else:
        authenticate_value = "Bearer"

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": authenticate_value},
    )

    try:
        # Verify and decode JWT token
        payload = verify_token(token)
        if payload is None:
            raise credentials_exception
            
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
            
        token_scopes = payload.get("scopes", [])
        token_data = TokenData(username=username, scopes=token_scopes)
        
    except (ValidationError, ValueError):
        raise credentials_exception

    # Get user from database
    stmt = select(User).where(User.email == token_data.username, User.is_active == True)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if user is None:
        raise credentials_exception

    # Verify that all required scopes are present in the token
    for scope in security_scopes.scopes:
        if scope not in token_data.scopes:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions",
                headers={"WWW-Authenticate": authenticate_value},
            )

    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current active user (already validated by get_current_user)"""
    return current_user


async def get_current_admin_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current user and verify admin role"""
    from app.models.user import UserRole
    
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


async def verify_project_access(
    project_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> bool:
    """
    Verify that current user has access to the project
    Implements data isolation for GxP compliance
    """
    from app.models.project import Project
    from app.models.user import UserRole
    
    # Admin users can access all projects
    if current_user.role == UserRole.ADMIN:
        return True
    
    # Check if user owns the project
    stmt = select(Project).where(
        Project.id == project_id,
        Project.owner_id == current_user.id,
        Project.deleted_at.is_(None)
    )
    result = await db.execute(stmt)
    project = result.scalar_one_or_none()
    
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found or access denied"
        )
    
    return True


async def log_audit_event(
    request: Request,
    current_user: User,
    action: str,
    entity_type: str = None,
    entity_id: int = None,
    details: dict = None,
    db: AsyncSession = Depends(get_db)
) -> None:
    """
    Log audit event for GxP compliance
    """
    # Extract client information
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    request_id = request.headers.get("x-request-id")
    
    # Create audit log entry
    audit_log = AuditLog.create_log(
        user_id=current_user.id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        ip_address=client_ip,
        user_agent=user_agent,
        request_id=request_id,
        details=details
    )
    
    db.add(audit_log)
    await db.commit()


def generate_api_key() -> str:
    """
    Generate secure API key for service-to-service communication
    Using secrets.token_urlsafe as recommended by FastAPI security docs
    """
    return secrets.token_urlsafe(32)


def verify_api_key(api_key: str) -> bool:
    """
    Verify API key using constant-time comparison
    Prevents timing attacks as recommended in FastAPI security docs
    """
    expected_key = settings.SECRET_KEY
    return secrets.compare_digest(
        api_key.encode("utf-8"),
        expected_key.encode("utf-8")
    )