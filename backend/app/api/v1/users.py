import logging
from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, status, Security, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.sql import func

from app.api.deps import get_current_user, get_current_admin_user, log_audit_event
from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.schemas.user import (
    User as UserSchema,
    UserCreate,
    UserUpdate
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/", response_model=List[UserSchema])
async def list_users(
    current_user: User = Security(get_current_admin_user, scopes=["admin"]),
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    role: str = None,
    is_active: bool = None
) -> Any:
    """
    List all users (Admin only)
    Supports filtering by role and active status
    """
    # Build query
    stmt = select(User)

    # Apply filters
    if role:
        stmt = stmt.where(User.role == role)
    if is_active is not None:
        stmt = stmt.where(User.is_active == is_active)

    stmt = stmt.offset(skip).limit(limit).order_by(User.created_at.desc())

    result = await db.execute(stmt)
    users = result.scalars().all()

    return users


@router.post("/", response_model=UserSchema)
async def create_user(
    request: Request,
    user_data: UserCreate,
    current_user: User = Security(get_current_admin_user, scopes=["admin"]),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Create new user (Admin only)"""

    # Check if user with email already exists
    stmt = select(User).where(User.email == user_data.email.lower())
    result = await db.execute(stmt)
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with email {user_data.email} already exists"
        )

    # Hash password
    hashed_password = get_password_hash(user_data.password)

    # Create new user
    new_user = User(
        email=user_data.email.lower(),
        hashed_password=hashed_password,
        full_name=user_data.full_name,
        role=user_data.role,
        is_active=user_data.is_active
    )

    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # Log audit event
    await log_audit_event(
        request=request,
        current_user=current_user,
        action="USER_CREATED",
        entity_type="user",
        entity_id=new_user.id,
        details={
            "user_email": new_user.email,
            "user_role": new_user.role.value,
            "created_by": current_user.email
        },
        db=db
    )

    logger.info(f"Admin {current_user.email} created new user: {new_user.email}")

    return new_user


@router.get("/{user_id}", response_model=UserSchema)
async def get_user(
    user_id: int,
    current_user: User = Security(get_current_admin_user, scopes=["admin"]),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Get user by ID (Admin only)"""

    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return user


@router.put("/{user_id}", response_model=UserSchema)
async def update_user(
    user_id: int,
    request: Request,
    user_data: UserUpdate,
    current_user: User = Security(get_current_admin_user, scopes=["admin"]),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Update user (Admin only)"""

    # Get existing user
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Check if email is being changed and if it already exists
    if user_data.email and user_data.email.lower() != user.email:
        email_check = select(User).where(User.email == user_data.email.lower())
        email_result = await db.execute(email_check)
        if email_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email {user_data.email} is already in use"
            )

    # Track changes for audit
    changes = {}

    if user_data.email and user_data.email.lower() != user.email:
        changes["email"] = {"old": user.email, "new": user_data.email.lower()}
        user.email = user_data.email.lower()

    if user_data.full_name and user_data.full_name != user.full_name:
        changes["full_name"] = {"old": user.full_name, "new": user_data.full_name}
        user.full_name = user_data.full_name

    if user_data.role and user_data.role != user.role:
        # Prevent changing the last admin to engineer
        if user.role == UserRole.ADMIN and user_data.role != UserRole.ADMIN:
            admin_count = await db.scalar(select(func.count(User.id)).where(User.role == UserRole.ADMIN, User.is_active == True))
            if admin_count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot remove admin role from the last active admin user"
                )

        changes["role"] = {"old": user.role.value, "new": user_data.role.value}
        user.role = user_data.role

    if user_data.is_active is not None and user_data.is_active != user.is_active:
        # Prevent deactivating the last admin
        if user.role == UserRole.ADMIN and not user_data.is_active:
            admin_count = await db.scalar(select(func.count(User.id)).where(User.role == UserRole.ADMIN, User.is_active == True))
            if admin_count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot deactivate the last active admin user"
                )

        changes["is_active"] = {"old": user.is_active, "new": user_data.is_active}
        user.is_active = user_data.is_active

    if not changes:
        return user  # No changes made

    await db.commit()
    await db.refresh(user)

    # Log audit event for each changed field
    for field, change in changes.items():
        await log_audit_event(
            request=request,
            current_user=current_user,
            action="USER_UPDATED",
            entity_type="user",
            entity_id=user.id,
            details={
                "user_email": user.email,
                "field": field,
                "old_value": change["old"],
                "new_value": change["new"],
                "updated_by": current_user.email
            },
            db=db
        )

    logger.info(f"Admin {current_user.email} updated user {user.email}: {changes}")

    return user


@router.patch("/{user_id}/deactivate")
async def deactivate_user(
    user_id: int,
    request: Request,
    current_user: User = Security(get_current_admin_user, scopes=["admin"]),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Deactivate user (Admin only) - GxP compliant soft delete"""

    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Prevent deactivating the last admin
    if user.role == UserRole.ADMIN:
        admin_count = await db.scalar(select(func.count(User.id)).where(User.role == UserRole.ADMIN, User.is_active == True))
        if admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot deactivate the last active admin user"
            )

    # Prevent deactivating self
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account"
        )

    user.is_active = False
    await db.commit()

    # Log audit event
    await log_audit_event(
        request=request,
        current_user=current_user,
        action="USER_DEACTIVATED",
        entity_type="user",
        entity_id=user.id,
        details={
            "user_email": user.email,
            "deactivated_by": current_user.email
        },
        db=db
    )

    logger.info(f"Admin {current_user.email} deactivated user: {user.email}")

    return {"message": f"User {user.email} has been deactivated"}


@router.patch("/{user_id}/activate")
async def activate_user(
    user_id: int,
    request: Request,
    current_user: User = Security(get_current_admin_user, scopes=["admin"]),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Activate user (Admin only)"""

    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    user.is_active = True
    await db.commit()

    # Log audit event
    await log_audit_event(
        request=request,
        current_user=current_user,
        action="USER_ACTIVATED",
        entity_type="user",
        entity_id=user.id,
        details={
            "user_email": user.email,
            "activated_by": current_user.email
        },
        db=db
    )

    logger.info(f"Admin {current_user.email} activated user: {user.email}")

    return {"message": f"User {user.email} has been activated"}
