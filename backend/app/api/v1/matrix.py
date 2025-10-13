import logging
from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, status, Security, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from sqlalchemy.sql import func

from app.api.deps import (
    get_current_user,
    verify_project_access,
    log_audit_event
)
from app.core.database import get_db
from app.models.user import User
from app.models.requirement import Requirement
from app.models.document import Document
from app.models.matrix import MatrixEntry as MatrixEntryModel
from app.schemas.matrix import (
    MatrixEntry as MatrixEntrySchema,
    MatrixEntryUpdate,
    MatrixEntryReview,
    AnalyzeDocumentRequest
)
from app.services.ai_service import AIService

router = APIRouter()
logger = logging.getLogger(__name__)


@router.put("/{entry_id}")
async def update_matrix_entry(
    entry_id: int,
    entry_data: MatrixEntryUpdate,
    request: Request,
    current_user: User = Security(get_current_user, scopes=["engineer"]),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Update a matrix entry - Engineers only, admins have read-only access"""
    from app.models.user import UserRole

    # Admins have read-only access
    if current_user.role == UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admins have read-only access. Only engineers can modify matrix entries."
        )

    stmt = select(MatrixEntryModel).where(
        and_(
            MatrixEntryModel.id == entry_id,
            MatrixEntryModel.deleted_at.is_(None)
        )
    )
    result = await db.execute(stmt)
    entry = result.scalar_one_or_none()

    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Matrix entry not found"
        )

    # Track changes
    changes = {}

    if entry_data.spec_reference is not None and entry_data.spec_reference != entry.spec_reference:
        changes["spec_reference"] = {"old": entry.spec_reference, "new": entry_data.spec_reference}
        entry.spec_reference = entry_data.spec_reference

    if entry_data.supplier_response is not None and entry_data.supplier_response != entry.supplier_response:
        changes["supplier_response"] = {"old": entry.supplier_response[:50] if entry.supplier_response else None, "new": entry_data.supplier_response[:50]}
        entry.supplier_response = entry_data.supplier_response

    if entry_data.justification is not None and entry_data.justification != entry.justification:
        changes["justification"] = {"old": entry.justification[:50] if entry.justification else None, "new": entry_data.justification[:50]}
        entry.justification = entry_data.justification

    if entry_data.compliance_status is not None and entry_data.compliance_status != entry.compliance_status:
        changes["compliance_status"] = {"old": entry.compliance_status, "new": entry_data.compliance_status}
        entry.compliance_status = entry_data.compliance_status

    if entry_data.test_reference is not None and entry_data.test_reference != entry.test_reference:
        changes["test_reference"] = {"old": entry.test_reference, "new": entry_data.test_reference}
        entry.test_reference = entry_data.test_reference

    if entry_data.risk_assessment is not None and entry_data.risk_assessment != entry.risk_assessment:
        changes["risk_assessment"] = {"old": entry.risk_assessment, "new": entry_data.risk_assessment}
        entry.risk_assessment = entry_data.risk_assessment

    if entry_data.comments is not None and entry_data.comments != entry.comments:
        changes["comments"] = {"old": entry.comments, "new": entry_data.comments}
        entry.comments = entry_data.comments

    if not changes:
        return MatrixEntrySchema.model_validate(entry)

    # Update metadata
    entry.last_modified_by = current_user.id

    await db.commit()
    await db.refresh(entry)

    # Log audit event
    await log_audit_event(
        request=request,
        current_user=current_user,
        action="MATRIX_ENTRY_UPDATED",
        entity_type="matrix_entry",
        entity_id=entry.id,
        details={"changes": changes},
        db=db
    )

    return MatrixEntrySchema.model_validate(entry)


@router.patch("/{entry_id}/review")
async def review_matrix_entry(
    entry_id: int,
    review_data: MatrixEntryReview,
    request: Request,
    current_user: User = Security(get_current_user, scopes=["engineer"]),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Update review status of a matrix entry - Engineers only, admins have read-only access"""
    from app.models.user import UserRole

    # Admins have read-only access
    if current_user.role == UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admins have read-only access. Only engineers can review matrix entries."
        )

    stmt = select(MatrixEntryModel).where(
        and_(
            MatrixEntryModel.id == entry_id,
            MatrixEntryModel.deleted_at.is_(None)
        )
    )
    result = await db.execute(stmt)
    entry = result.scalar_one_or_none()

    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Matrix entry not found"
        )

    # Update review fields
    old_status = entry.review_status
    entry.review_status = review_data.review_status
    entry.reviewer_comments = review_data.reviewer_comments

    if review_data.review_status == "approved":
        entry.approved_at = func.now()
        entry.approved_by = current_user.id

    entry.last_modified_by = current_user.id

    await db.commit()
    await db.refresh(entry)

    # Log audit event
    await log_audit_event(
        request=request,
        current_user=current_user,
        action="MATRIX_ENTRY_REVIEWED",
        entity_type="matrix_entry",
        entity_id=entry.id,
        details={
            "old_status": old_status,
            "new_status": review_data.review_status,
            "reviewer_comments": review_data.reviewer_comments
        },
        db=db
    )

    return MatrixEntrySchema.model_validate(entry)
