import logging
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status, Security, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.api.deps import (
    get_current_user,
    log_audit_event
)
from app.core.database import get_db
from app.models.user import User
from app.models.requirement import Requirement
from app.schemas.requirement import (
    Requirement as RequirementSchema,
    RequirementUpdate
)

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/{requirement_id}", response_model=RequirementSchema)
async def get_requirement(
    requirement_id: int,
    current_user: User = Security(get_current_user, scopes=["engineer"]),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Get a specific requirement"""

    stmt = select(Requirement).where(
        and_(
            Requirement.id == requirement_id,
            Requirement.deleted_at.is_(None)
        )
    )
    result = await db.execute(stmt)
    requirement = result.scalar_one_or_none()

    if not requirement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Requirement not found"
        )

    return requirement


@router.put("/{requirement_id}", response_model=RequirementSchema)
async def update_requirement(
    requirement_id: int,
    requirement_data: RequirementUpdate,
    request: Request,
    current_user: User = Security(get_current_user, scopes=["engineer"]),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Update a requirement - Engineers only, admins have read-only access"""
    from app.models.user import UserRole

    # Admins have read-only access
    if current_user.role == UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admins have read-only access. Only engineers can modify requirements."
        )

    stmt = select(Requirement).where(
        and_(
            Requirement.id == requirement_id,
            Requirement.deleted_at.is_(None)
        )
    )
    result = await db.execute(stmt)
    requirement = result.scalar_one_or_none()

    if not requirement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Requirement not found"
        )

    # Track changes for audit
    changes = {}

    if requirement_data.requirement_id is not None and requirement_data.requirement_id != requirement.requirement_id:
        changes["requirement_id"] = {"old": requirement.requirement_id, "new": requirement_data.requirement_id}
        requirement.requirement_id = requirement_data.requirement_id

    if requirement_data.description is not None and requirement_data.description != requirement.description:
        changes["description"] = {"old": requirement.description[:50], "new": requirement_data.description[:50]}
        requirement.description = requirement_data.description

    if requirement_data.category is not None and requirement_data.category != requirement.category:
        changes["category"] = {"old": requirement.category, "new": requirement_data.category}
        requirement.category = requirement_data.category

    if requirement_data.priority is not None and requirement_data.priority != requirement.priority:
        changes["priority"] = {"old": requirement.priority, "new": requirement_data.priority}
        requirement.priority = requirement_data.priority

    if requirement_data.status is not None and requirement_data.status != requirement.status:
        changes["status"] = {"old": requirement.status, "new": requirement_data.status}
        requirement.status = requirement_data.status

    if not changes:
        return requirement

    await db.commit()
    await db.refresh(requirement)

    # Log audit event
    await log_audit_event(
        request=request,
        current_user=current_user,
        action="REQUIREMENT_UPDATED",
        entity_type="requirement",
        entity_id=requirement.id,
        details={"changes": changes},
        db=db
    )

    return requirement


@router.delete("/{requirement_id}")
async def delete_requirement(
    requirement_id: int,
    request: Request,
    current_user: User = Security(get_current_user, scopes=["engineer"]),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Soft delete a requirement - Engineers only, admins have read-only access"""
    from sqlalchemy.sql import func
    from app.models.user import UserRole

    # Admins have read-only access
    if current_user.role == UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admins have read-only access. Only engineers can delete requirements."
        )

    stmt = select(Requirement).where(
        and_(
            Requirement.id == requirement_id,
            Requirement.deleted_at.is_(None)
        )
    )
    result = await db.execute(stmt)
    requirement = result.scalar_one_or_none()

    if not requirement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Requirement not found"
        )

    # Soft delete
    requirement.deleted_at = func.now()
    await db.commit()

    # Log audit event
    await log_audit_event(
        request=request,
        current_user=current_user,
        action="REQUIREMENT_DELETED",
        entity_type="requirement",
        entity_id=requirement.id,
        details={
            "requirement_id": requirement.requirement_id,
            "description": requirement.description[:50]
        },
        db=db
    )

    return {"message": "Requirement deleted successfully"}
