from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, status, Security, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload

from app.api.deps import (
    get_current_user, 
    get_current_admin_user, 
    verify_project_access,
    log_audit_event
)
from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.project import Project
from app.models.document import Document
from app.models.requirement import Requirement
from app.models.matrix import MatrixEntry
from app.schemas.project import (
    Project as ProjectSchema,
    ProjectCreate,
    ProjectUpdate,
    ProjectSummary,
    ProjectWithOwner
)

router = APIRouter()


@router.get("/", response_model=List[ProjectSummary])
async def list_projects(
    request: Request,
    current_user: User = Security(get_current_user, scopes=["engineer"]),
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 50
) -> Any:
    """
    List projects accessible to current user
    Engineers see only their projects, Admins see all projects
    """
    # Build base query
    if current_user.role == UserRole.ADMIN:
        # Admin can see all projects
        stmt = select(Project).where(Project.deleted_at.is_(None))
    else:
        # Engineers see only their own projects
        stmt = select(Project).where(
            and_(
                Project.owner_id == current_user.id,
                Project.deleted_at.is_(None)
            )
        )
    
    stmt = stmt.offset(skip).limit(limit).order_by(Project.created_at.desc())
    result = await db.execute(stmt)
    projects = result.scalars().all()
    
    # Get summary statistics for each project
    project_summaries = []
    for project in projects:
        # Count documents
        doc_stmt = select(func.count(Document.id)).where(
            and_(
                Document.project_id == project.id,
                Document.deleted_at.is_(None)
            )
        )
        doc_result = await db.execute(doc_stmt)
        documents_count = doc_result.scalar() or 0
        
        # Count requirements
        req_stmt = select(func.count(Requirement.id)).where(
            and_(
                Requirement.project_id == project.id,
                Requirement.deleted_at.is_(None)
            )
        )
        req_result = await db.execute(req_stmt)
        requirements_count = req_result.scalar() or 0
        
        # Count matrix entries
        matrix_stmt = select(func.count(MatrixEntry.id)).join(Requirement).where(
            and_(
                Requirement.project_id == project.id,
                Requirement.deleted_at.is_(None),
                MatrixEntry.deleted_at.is_(None)
            )
        )
        matrix_result = await db.execute(matrix_stmt)
        matrix_entries_count = matrix_result.scalar() or 0
        
        # Calculate completion percentage
        completion_percentage = 0.0
        if requirements_count > 0:
            completion_percentage = (matrix_entries_count / requirements_count) * 100
        
        project_summaries.append(ProjectSummary(
            id=project.id,
            name=project.name,
            description=project.description,
            status=project.status,
            created_at=project.created_at,
            documents_count=documents_count,
            requirements_count=requirements_count,
            matrix_entries_count=matrix_entries_count,
            completion_percentage=completion_percentage
        ))
    
    return project_summaries


@router.post("/", response_model=ProjectSchema)
async def create_project(
    request: Request,
    project_data: ProjectCreate,
    current_user: User = Security(get_current_user, scopes=["engineer"]),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Create a new project"""
    
    # Create project
    project = Project(
        name=project_data.name,
        description=project_data.description,
        owner_id=current_user.id,
        status=project_data.status
    )
    
    db.add(project)
    await db.commit()
    await db.refresh(project)
    
    # Log audit event
    await log_audit_event(
        request=request,
        current_user=current_user,
        action="PROJECT_CREATED",
        entity_type="project",
        entity_id=project.id,
        details={"project_name": project.name},
        db=db
    )
    
    return project


@router.get("/{project_id}", response_model=ProjectWithOwner)
async def get_project(
    project_id: int,
    current_user: User = Security(get_current_user, scopes=["engineer"]),
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_project_access)  # Verify access
) -> Any:
    """Get project details"""
    
    stmt = select(Project).options(
        selectinload(Project.owner)
    ).where(
        and_(
            Project.id == project_id,
            Project.deleted_at.is_(None)
        )
    )
    result = await db.execute(stmt)
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    return project


@router.put("/{project_id}", response_model=ProjectSchema)
async def update_project(
    project_id: int,
    request: Request,
    project_data: ProjectUpdate,
    current_user: User = Security(get_current_user, scopes=["engineer"]),
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_project_access)  # Verify access
) -> Any:
    """Update project"""
    
    stmt = select(Project).where(
        and_(
            Project.id == project_id,
            Project.deleted_at.is_(None)
        )
    )
    result = await db.execute(stmt)
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Track changes for audit
    changes = {}
    if project_data.name is not None and project_data.name != project.name:
        changes["name"] = {"old": project.name, "new": project_data.name}
        project.name = project_data.name
        
    if project_data.description is not None and project_data.description != project.description:
        changes["description"] = {"old": project.description, "new": project_data.description}
        project.description = project_data.description
        
    if project_data.status is not None and project_data.status != project.status:
        changes["status"] = {"old": project.status, "new": project_data.status}
        project.status = project_data.status
    
    if not changes:
        return project  # No changes made
    
    await db.commit()
    await db.refresh(project)
    
    # Log audit event for each changed field
    for field, change in changes.items():
        await log_audit_event(
            request=request,
            current_user=current_user,
            action="PROJECT_UPDATED",
            entity_type="project",
            entity_id=project.id,
            details={
                "field": field,
                "old_value": change["old"],
                "new_value": change["new"]
            },
            db=db
        )
    
    return project


@router.delete("/{project_id}")
async def delete_project(
    project_id: int,
    request: Request,
    current_user: User = Security(get_current_user, scopes=["engineer"]),
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_project_access)  # Verify access
) -> Any:
    """Soft delete project (GxP compliance - data retention)"""
    
    stmt = select(Project).where(
        and_(
            Project.id == project_id,
            Project.deleted_at.is_(None)
        )
    )
    result = await db.execute(stmt)
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Soft delete (set deleted_at timestamp)
    project.deleted_at = func.now()
    
    await db.commit()
    
    # Log audit event
    await log_audit_event(
        request=request,
        current_user=current_user,
        action="PROJECT_DELETED",
        entity_type="project",
        entity_id=project.id,
        details={"project_name": project.name},
        db=db
    )
    
    return {"message": "Project deleted successfully"}


@router.get("/{project_id}/statistics")
async def get_project_statistics(
    project_id: int,
    current_user: User = Security(get_current_user, scopes=["engineer"]),
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_project_access)  # Verify access
) -> Any:
    """Get detailed project statistics"""
    
    # Verify project exists
    stmt = select(Project).where(
        and_(
            Project.id == project_id,
            Project.deleted_at.is_(None)
        )
    )
    result = await db.execute(stmt)
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found"
        )
    
    # Get document statistics
    doc_stmt = select(
        func.count(Document.id).label('total'),
        func.count(Document.id).filter(Document.extraction_status == 'completed').label('extracted'),
        func.count(Document.id).filter(Document.extraction_status == 'pending').label('pending'),
        func.count(Document.id).filter(Document.extraction_status == 'failed').label('failed')
    ).where(
        and_(
            Document.project_id == project_id,
            Document.deleted_at.is_(None)
        )
    )
    doc_result = await db.execute(doc_stmt)
    doc_stats = doc_result.first()
    
    # Get requirement statistics
    req_stmt = select(
        func.count(Requirement.id).label('total'),
        func.count(Requirement.id).filter(Requirement.status == 'completed').label('completed'),
        func.count(Requirement.id).filter(Requirement.status == 'in_progress').label('in_progress'),
        func.count(Requirement.id).filter(Requirement.status == 'pending').label('pending')
    ).where(
        and_(
            Requirement.project_id == project_id,
            Requirement.deleted_at.is_(None)
        )
    )
    req_result = await db.execute(req_stmt)
    req_stats = req_result.first()
    
    # Get matrix entry statistics
    matrix_stmt = select(
        func.count(MatrixEntry.id).label('total'),
        func.count(MatrixEntry.id).filter(MatrixEntry.review_status == 'approved').label('approved'),
        func.count(MatrixEntry.id).filter(MatrixEntry.review_status == 'reviewed').label('reviewed'),
        func.count(MatrixEntry.id).filter(MatrixEntry.review_status == 'pending').label('pending'),
        func.count(MatrixEntry.id).filter(MatrixEntry.compliance_status == 'Compliant').label('compliant'),
        func.count(MatrixEntry.id).filter(MatrixEntry.compliance_status == 'Non-compliant').label('non_compliant')
    ).join(Requirement).where(
        and_(
            Requirement.project_id == project_id,
            Requirement.deleted_at.is_(None),
            MatrixEntry.deleted_at.is_(None)
        )
    )
    matrix_result = await db.execute(matrix_stmt)
    matrix_stats = matrix_result.first()
    
    return {
        "project_id": project_id,
        "project_name": project.name,
        "documents": {
            "total": doc_stats.total or 0,
            "extracted": doc_stats.extracted or 0,
            "pending": doc_stats.pending or 0,
            "failed": doc_stats.failed or 0,
            "extraction_rate": (doc_stats.extracted or 0) / max(doc_stats.total or 1, 1) * 100
        },
        "requirements": {
            "total": req_stats.total or 0,
            "completed": req_stats.completed or 0,
            "in_progress": req_stats.in_progress or 0,
            "pending": req_stats.pending or 0,
            "completion_rate": (req_stats.completed or 0) / max(req_stats.total or 1, 1) * 100
        },
        "matrix_entries": {
            "total": matrix_stats.total or 0,
            "approved": matrix_stats.approved or 0,
            "reviewed": matrix_stats.reviewed or 0,
            "pending": matrix_stats.pending or 0,
            "compliant": matrix_stats.compliant or 0,
            "non_compliant": matrix_stats.non_compliant or 0,
            "approval_rate": (matrix_stats.approved or 0) / max(matrix_stats.total or 1, 1) * 100,
            "compliance_rate": (matrix_stats.compliant or 0) / max(matrix_stats.total or 1, 1) * 100
        }
    }