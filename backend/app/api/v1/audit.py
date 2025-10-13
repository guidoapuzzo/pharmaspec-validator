import logging
from typing import List, Any, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Security, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload

from app.api.deps import (
    get_current_user,
    get_current_admin_user,
    verify_project_access
)
from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.audit_log import AuditLog
from app.models.project import Project
from app.models.requirement import Requirement
from app.models.document import Document

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/", response_model=List[dict])
async def get_all_audit_logs(
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_db),
    user_id: Optional[int] = Query(None, description="Filter by user ID"),
    action: Optional[str] = Query(None, description="Filter by action type"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type"),
    entity_id: Optional[int] = Query(None, description="Filter by entity ID"),
    start_date: Optional[datetime] = Query(None, description="Filter entries after this date"),
    end_date: Optional[datetime] = Query(None, description="Filter entries before this date"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of entries"),
    offset: int = Query(0, ge=0, description="Number of entries to skip")
) -> Any:
    """
    Get all audit logs - Admin only
    Supports filtering by user, action, entity type/id, and date range
    """
    # Build query with filters
    stmt = select(AuditLog).options(selectinload(AuditLog.user))

    filters = []
    if user_id is not None:
        filters.append(AuditLog.user_id == user_id)
    if action is not None:
        filters.append(AuditLog.action == action)
    if entity_type is not None:
        filters.append(AuditLog.entity_type == entity_type)
    if entity_id is not None:
        filters.append(AuditLog.entity_id == entity_id)
    if start_date is not None:
        filters.append(AuditLog.timestamp >= start_date)
    if end_date is not None:
        filters.append(AuditLog.timestamp <= end_date)

    if filters:
        stmt = stmt.where(and_(*filters))

    stmt = stmt.order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit)
    result = await db.execute(stmt)
    logs = result.scalars().all()

    # Format response with user details
    return [
        {
            "id": log.id,
            "user_id": log.user_id,
            "user_email": log.user.email if log.user else None,
            "user_full_name": log.user.full_name if log.user else None,
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "field_name": log.field_name,
            "old_value": log.old_value,
            "new_value": log.new_value,
            "ip_address": log.ip_address,
            "user_agent": log.user_agent,
            "request_id": log.request_id,
            "details": log.details,
            "timestamp": log.timestamp,
            "session_id": log.session_id
        }
        for log in logs
    ]


@router.get("/projects/{project_id}", response_model=List[dict])
async def get_project_audit_logs(
    project_id: int,
    current_user: User = Security(get_current_user, scopes=["engineer"]),
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_project_access),
    action: Optional[str] = Query(None, description="Filter by action type"),
    start_date: Optional[datetime] = Query(None, description="Filter entries after this date"),
    end_date: Optional[datetime] = Query(None, description="Filter entries before this date"),
    limit: int = Query(100, ge=1, le=500, description="Maximum number of entries"),
    offset: int = Query(0, ge=0, description="Number of entries to skip")
) -> Any:
    """
    Get audit logs for a specific project
    Includes logs for the project itself and all related entities (documents, requirements, matrix entries)
    Accessible by all engineers and admins
    """
    # Get all related entity IDs for this project
    # 1. Project itself
    project_entity_ids = [project_id]

    # 2. Documents in this project
    doc_stmt = select(Document.id).where(
        and_(
            Document.project_id == project_id,
            Document.deleted_at.is_(None)
        )
    )
    doc_result = await db.execute(doc_stmt)
    document_ids = [row[0] for row in doc_result.all()]

    # 3. Requirements in this project
    req_stmt = select(Requirement.id).where(
        and_(
            Requirement.project_id == project_id,
            Requirement.deleted_at.is_(None)
        )
    )
    req_result = await db.execute(req_stmt)
    requirement_ids = [row[0] for row in req_result.all()]

    # 4. Matrix entries related to this project's requirements
    from app.models.matrix import MatrixEntry
    matrix_stmt = select(MatrixEntry.id).join(Requirement).where(
        and_(
            Requirement.project_id == project_id,
            Requirement.deleted_at.is_(None),
            MatrixEntry.deleted_at.is_(None)
        )
    )
    matrix_result = await db.execute(matrix_stmt)
    matrix_ids = [row[0] for row in matrix_result.all()]

    # Build audit log query
    stmt = select(AuditLog).options(selectinload(AuditLog.user))

    # Filter by entity type and ID combinations
    entity_filters = []
    if project_entity_ids:
        entity_filters.append(
            and_(AuditLog.entity_type == "project", AuditLog.entity_id.in_(project_entity_ids))
        )
    if document_ids:
        entity_filters.append(
            and_(AuditLog.entity_type == "document", AuditLog.entity_id.in_(document_ids))
        )
    if requirement_ids:
        entity_filters.append(
            and_(AuditLog.entity_type == "requirement", AuditLog.entity_id.in_(requirement_ids))
        )
    if matrix_ids:
        entity_filters.append(
            and_(AuditLog.entity_type == "matrix_entry", AuditLog.entity_id.in_(matrix_ids))
        )

    if entity_filters:
        stmt = stmt.where(or_(*entity_filters))
    else:
        # No entities found, return empty list
        return []

    # Apply additional filters
    additional_filters = []
    if action is not None:
        additional_filters.append(AuditLog.action == action)
    if start_date is not None:
        additional_filters.append(AuditLog.timestamp >= start_date)
    if end_date is not None:
        additional_filters.append(AuditLog.timestamp <= end_date)

    if additional_filters:
        stmt = stmt.where(and_(*additional_filters))

    stmt = stmt.order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit)
    result = await db.execute(stmt)
    logs = result.scalars().all()

    # Format response with user details
    return [
        {
            "id": log.id,
            "user_id": log.user_id,
            "user_email": log.user.email if log.user else None,
            "user_full_name": log.user.full_name if log.user else None,
            "action": log.action,
            "entity_type": log.entity_type,
            "entity_id": log.entity_id,
            "field_name": log.field_name,
            "old_value": log.old_value,
            "new_value": log.new_value,
            "ip_address": log.ip_address,
            "user_agent": log.user_agent,
            "request_id": log.request_id,
            "details": log.details,
            "timestamp": log.timestamp,
            "session_id": log.session_id
        }
        for log in logs
    ]
