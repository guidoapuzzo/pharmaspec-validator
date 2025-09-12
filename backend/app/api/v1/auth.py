from datetime import timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.sql import func

from app.api.deps import get_current_user, log_audit_event
from app.core.database import get_db
from app.core.security import (
    create_access_token,
    create_refresh_token, 
    verify_password,
    get_password_hash,
    verify_token
)
from app.core.config import settings
from app.models.user import User
from app.schemas.user import (
    Token, 
    User as UserSchema,
    RefreshTokenRequest,
    PasswordChangeRequest
)

router = APIRouter()


@router.post("/token", response_model=Token)
async def login_for_access_token(
    request: Request,
    db: AsyncSession = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
) -> Any:
    """
    OAuth2 compatible token login with scopes
    Following FastAPI OAuth2 pattern from Context7 docs
    """
    # Query user by email
    stmt = select(User).where(User.email == form_data.username)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    # Verify user exists and password is correct
    if not user or not verify_password(form_data.password, user.hashed_password):
        # Log failed login attempt
        if user:
            await log_audit_event(
                request=request,
                current_user=user,
                action="LOGIN_FAILED",
                details={"reason": "invalid_password", "ip": request.client.host},
                db=db
            )
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check if user is active
    if not user.is_active:
        await log_audit_event(
            request=request,
            current_user=user,
            action="LOGIN_FAILED",
            details={"reason": "account_disabled", "ip": request.client.host},
            db=db
        )
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive user account"
        )

    # Get user scopes based on role
    user_scopes = user.scopes
    
    # Filter requested scopes against user's available scopes
    requested_scopes = form_data.scopes or user_scopes
    granted_scopes = [scope for scope in requested_scopes if scope in user_scopes]

    # Create access token with granted scopes
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=user.email,
        expires_delta=access_token_expires,
        scopes=granted_scopes
    )
    
    # Create refresh token
    refresh_token = create_refresh_token(subject=user.email)
    
    # Update user's last login timestamp
    stmt = update(User).where(User.id == user.id).values(last_login=func.now())
    await db.execute(stmt)
    await db.commit()
    
    # Log successful login
    await log_audit_event(
        request=request,
        current_user=user,
        action="LOGIN_SUCCESS",
        details={"scopes": granted_scopes, "ip": request.client.host},
        db=db
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "scopes": granted_scopes
    }


@router.post("/refresh", response_model=Token)
async def refresh_access_token(
    request: Request,
    refresh_request: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Refresh access token using refresh token"""
    
    # Verify refresh token
    payload = verify_token(refresh_request.refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    username = payload.get("sub")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    # Get user from database
    stmt = select(User).where(User.email == username, User.is_active == True)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    
    # Create new access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        subject=user.email,
        expires_delta=access_token_expires,
        scopes=user.scopes
    )
    
    # Create new refresh token
    new_refresh_token = create_refresh_token(subject=user.email)
    
    # Log token refresh
    await log_audit_event(
        request=request,
        current_user=user,
        action="TOKEN_REFRESHED",
        details={"ip": request.client.host},
        db=db
    )
    
    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer", 
        "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "scopes": user.scopes
    }


@router.post("/logout")
async def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Logout current user (invalidate tokens on client side)"""
    
    # Log logout event
    await log_audit_event(
        request=request,
        current_user=current_user,
        action="LOGOUT",
        details={"ip": request.client.host},
        db=db
    )
    
    return {"message": "Successfully logged out"}


@router.get("/me", response_model=UserSchema)
async def read_users_me(
    current_user: User = Depends(get_current_user)
) -> Any:
    """Get current user information"""
    return current_user


@router.post("/change-password")
async def change_password(
    request: Request,
    password_data: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Change user password"""
    
    # Verify current password
    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password"
        )
    
    # Hash new password
    new_hashed_password = get_password_hash(password_data.new_password)
    
    # Update password in database
    stmt = update(User).where(User.id == current_user.id).values(
        hashed_password=new_hashed_password,
        password_changed_at=func.now()
    )
    await db.execute(stmt)
    await db.commit()
    
    # Log password change
    await log_audit_event(
        request=request,
        current_user=current_user,
        action="PASSWORD_CHANGED",
        details={"ip": request.client.host},
        db=db
    )
    
    return {"message": "Password changed successfully"}