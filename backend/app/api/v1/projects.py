import logging
from app.core.config import settings
from typing import List, Any
from fastapi import APIRouter, Depends, HTTPException, status, Security, Request, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from app.schemas.document import Document as DocumentSchema

from app.api.deps import (
    get_current_user,
    get_current_admin_user,
    verify_project_access,
    verify_project_write_access,
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
    ProjectWithOwner,
    ProjectPasswordVerify
)

router = APIRouter()

logger = logging.getLogger(__name__)

@router.get("/", response_model=List[ProjectSummary])
async def list_projects(
    request: Request,
    current_user: User = Security(get_current_user, scopes=["engineer"]),
    db: AsyncSession = Depends(get_db),
    skip: int = 0,
    limit: int = 50,
    owner_id: int = None,
    status: str = None
) -> Any:
    """
    List projects accessible to current user
    All users (engineers and admins) can see all projects in the company
    Supports filtering by owner_id and status
    """
    # Build base query - all users see all projects
    stmt = select(Project).options(selectinload(Project.owner)).where(Project.deleted_at.is_(None))

    # Apply optional filters
    if owner_id is not None:
        stmt = stmt.where(Project.owner_id == owner_id)

    if status is not None:
        stmt = stmt.where(Project.status == status)

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
            owner_id=project.owner_id,
            owner_name=project.owner.full_name,
            owner_email=project.owner.email,
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
    """Create a new project with optional password protection"""
    from app.core.security import get_password_hash

    # Hash password if provided
    password_hash = None
    if project_data.password:
        password_hash = get_password_hash(project_data.password)

    # Create project
    project = Project(
        name=project_data.name,
        description=project_data.description,
        owner_id=current_user.id,
        status=project_data.status,
        password_hash=password_hash
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
        details={
            "project_name": project.name,
            "has_password": password_hash is not None
        },
        db=db
    )

    return project


@router.post("/{project_id}/verify-password")
async def verify_project_password(
    project_id: int,
    request: Request,
    password_data: ProjectPasswordVerify,
    current_user: User = Security(get_current_user, scopes=["engineer"]),
    db: AsyncSession = Depends(get_db)
) -> Any:
    """Verify password for a password-protected project"""
    from app.core.security import verify_password
    from app.models.project_access import ProjectAccess

    # Get the project
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

    # Check if project has password protection
    if not project.password_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This project is not password protected"
        )

    # Verify password
    if not verify_password(password_data.password, project.password_hash):
        # Log failed attempt
        await log_audit_event(
            request=request,
            current_user=current_user,
            action="PROJECT_PASSWORD_VERIFY_FAILED",
            entity_type="project",
            entity_id=project.id,
            details={"project_name": project.name},
            db=db
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password"
        )

    # Check if access record already exists
    access_stmt = select(ProjectAccess).where(
        and_(
            ProjectAccess.user_id == current_user.id,
            ProjectAccess.project_id == project_id
        )
    )
    access_result = await db.execute(access_stmt)
    existing_access = access_result.scalar_one_or_none()

    if not existing_access:
        # Create access record
        project_access = ProjectAccess(
            user_id=current_user.id,
            project_id=project_id
        )
        db.add(project_access)
        await db.commit()

    # Log successful verification
    await log_audit_event(
        request=request,
        current_user=current_user,
        action="PROJECT_PASSWORD_VERIFIED",
        entity_type="project",
        entity_id=project.id,
        details={"project_name": project.name},
        db=db
    )

    return {"message": "Password verified successfully", "success": True}


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
    _: bool = Depends(verify_project_write_access)  # Verify write access (engineers only)
) -> Any:
    """Update project - Engineers only, admins have read-only access"""
    
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
    _: bool = Depends(verify_project_write_access)  # Verify write access (engineers only)
) -> Any:
    """Soft delete project (GxP compliance - data retention) - Engineers only"""
    
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
@router.get("/{project_id}/documents", response_model=List[DocumentSchema])
async def list_documents(
    project_id: int,
    current_user: User = Security(get_current_user, scopes=["engineer"]),
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_project_access)
) -> Any:
    """Get all documents for a project"""

    stmt = select(Document).where(
        and_(
            Document.project_id == project_id,
            Document.deleted_at.is_(None)
        )
    ).order_by(Document.created_at.desc())

    result = await db.execute(stmt)
    documents = result.scalars().all()

    return documents


@router.post("/{project_id}/documents", response_model=DocumentSchema)
async def upload_document(
    project_id: int,
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Security(get_current_user, scopes=["engineer"]),
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_project_write_access)  # Verify write access (engineers only)
) -> Any:
    """Upload a document and trigger async processing - Engineers only"""
    from app.services.document_processor import DocumentProcessor
    from app.models.document import Document

    # Validate file
    processor = DocumentProcessor()
    content = await file.read()

    validation = await processor.validate_file(
        filename=file.filename,
        content=content,
        max_size=settings.MAX_UPLOAD_SIZE
    )

    if not validation["valid"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=validation["error"]
        )

    # Save file
    save_result = await processor.save_file(
        content=content,
        original_filename=file.filename,
        project_id=project_id,
        validation_result=validation
    )

    if not save_result["success"]:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=save_result["error"]
        )

    # Create document record
    document = Document(
        filename=save_result["filename"],
        original_filename=save_result["original_filename"],
        file_path=save_result["file_path"],
        file_size=save_result["file_size"],
        mime_type=save_result["mime_type"],
        file_hash=save_result["file_hash"],
        project_id=project_id,
        extraction_status="pending"
    )

    db.add(document)
    await db.commit()
    await db.refresh(document)

    # Log audit event
    await log_audit_event(
        request=request,
        current_user=current_user,
        action="DOCUMENT_UPLOADED",
        entity_type="document",
        entity_id=document.id,
        details={
            "filename": file.filename,
            "size": save_result["file_size"]
        },
        db=db
    )

    # Trigger background processing
    from app.tasks import process_document_task
    task = process_document_task.delay(document.id)

    logger.info(f"Queued document {document.id} for processing, task_id: {task.id}")

    return document

@router.get("/{project_id}/documents/{document_id}/status")
async def get_document_status(
    project_id: int,
    document_id: int,
    current_user: User = Security(get_current_user, scopes=["engineer"]),
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_project_access)
) -> Any:
    """Get document processing status"""
    
    stmt = select(Document).where(
        Document.id == document_id,
        Document.project_id == project_id,
        Document.deleted_at.is_(None)
    )
    result = await db.execute(stmt)
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )
    
    return {
        "id": document.id,
        "filename": document.original_filename,
        "extraction_status": document.extraction_status,
        "extraction_model": document.extraction_model,
        "extracted_at": document.extracted_at.isoformat() if document.extracted_at else None,
        "extraction_error": document.extraction_error,
        "has_extracted_data": document.extracted_json is not None
    }


@router.delete("/{project_id}/documents/{document_id}")
async def delete_document(
    project_id: int,
    document_id: int,
    request: Request,
    current_user: User = Security(get_current_user, scopes=["engineer"]),
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_project_write_access)  # Verify write access (engineers only)
) -> Any:
    """Soft delete a document - Engineers only"""

    stmt = select(Document).where(
        and_(
            Document.id == document_id,
            Document.project_id == project_id,
            Document.deleted_at.is_(None)
        )
    )
    result = await db.execute(stmt)
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    # Soft delete
    document.deleted_at = func.now()
    await db.commit()

    # Log audit event
    await log_audit_event(
        request=request,
        current_user=current_user,
        action="DOCUMENT_DELETED",
        entity_type="document",
        entity_id=document.id,
        details={
            "filename": document.original_filename,
            "project_id": project_id
        },
        db=db
    )

    return {"message": "Document deleted successfully"}


@router.get("/{project_id}/requirements")
async def list_requirements(
    project_id: int,
    current_user: User = Security(get_current_user, scopes=["engineer"]),
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_project_access)
) -> Any:
    """Get all requirements for a project"""
    from app.models.requirement import Requirement
    from app.schemas.requirement import Requirement as RequirementSchema

    stmt = select(Requirement).where(
        and_(
            Requirement.project_id == project_id,
            Requirement.deleted_at.is_(None)
        )
    ).order_by(Requirement.requirement_id)

    result = await db.execute(stmt)
    requirements = result.scalars().all()

    # Convert to Pydantic schemas for serialization
    return [RequirementSchema.model_validate(req) for req in requirements]


@router.post("/{project_id}/requirements")
async def create_requirement(
    project_id: int,
    request: Request,
    current_user: User = Security(get_current_user, scopes=["engineer"]),
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_project_write_access)  # Verify write access (engineers only)
) -> Any:
    """Create a new requirement for a project - Engineers only"""
    from app.models.requirement import Requirement
    from app.schemas.requirement import RequirementCreate, Requirement as RequirementSchema

    # Get request body
    requirement_data = await request.json()
    requirement_create = RequirementCreate(**requirement_data)

    # Check if requirement_id already exists in this project
    existing_stmt = select(Requirement).where(
        and_(
            Requirement.project_id == project_id,
            Requirement.requirement_id == requirement_create.requirement_id,
            Requirement.deleted_at.is_(None)
        )
    )
    existing_result = await db.execute(existing_stmt)
    existing = existing_result.scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Requirement ID '{requirement_create.requirement_id}' already exists in this project"
        )

    # Create requirement
    requirement = Requirement(
        requirement_id=requirement_create.requirement_id,
        description=requirement_create.description,
        category=requirement_create.category,
        priority=requirement_create.priority,
        status=requirement_create.status,
        project_id=project_id
    )

    db.add(requirement)
    await db.commit()
    await db.refresh(requirement)

    # Log audit event
    await log_audit_event(
        request=request,
        current_user=current_user,
        action="REQUIREMENT_CREATED",
        entity_type="requirement",
        entity_id=requirement.id,
        details={
            "requirement_id": requirement.requirement_id,
            "category": requirement.category
        },
        db=db
    )

    # Convert to Pydantic schema for serialization
    return RequirementSchema.model_validate(requirement)


@router.post("/{project_id}/analyze")
async def analyze_document(
    project_id: int,
    request: Request,
    current_user: User = Security(get_current_user, scopes=["engineer"]),
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_project_write_access)  # Verify write access (engineers only)
) -> Any:
    """
    Analyze a document against selected requirements using local Llama model.
    Generates traceability matrix entries - Engineers only.
    """
    from app.models.matrix import MatrixEntry as MatrixEntryModel
    from app.schemas.matrix import (
        AnalyzeDocumentRequest,
        MatrixEntry as MatrixEntrySchema
    )
    from app.services.ai_service import AIService

    # Get request body
    request_body = await request.json()
    analyze_request = AnalyzeDocumentRequest(**request_body)

    # Fetch document
    doc_stmt = select(Document).where(
        and_(
            Document.id == analyze_request.document_id,
            Document.project_id == project_id,
            Document.deleted_at.is_(None)
        )
    )
    doc_result = await db.execute(doc_stmt)
    document = doc_result.scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found"
        )

    if document.extraction_status != "completed" or not document.extracted_json:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document has not been processed yet or extraction failed"
        )

    # Fetch requirements
    req_stmt = select(Requirement).where(
        and_(
            Requirement.id.in_(analyze_request.requirement_ids),
            Requirement.project_id == project_id,
            Requirement.deleted_at.is_(None)
        )
    )
    req_result = await db.execute(req_stmt)
    requirements = req_result.scalars().all()

    if len(requirements) != len(analyze_request.requirement_ids):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="One or more requirements not found"
        )

    # Initialize AI service
    ai_service = AIService()

    # Generate matrix entries for each requirement
    created_entries = []

    for requirement in requirements:
        try:
            # Check if matrix entry already exists for this requirement-document pair
            existing_stmt = select(MatrixEntryModel).where(
                and_(
                    MatrixEntryModel.requirement_id == requirement.id,
                    MatrixEntryModel.document_id == document.id,
                    MatrixEntryModel.deleted_at.is_(None)
                )
            )
            existing_result = await db.execute(existing_stmt)
            existing_entry = existing_result.scalar_one_or_none()

            if existing_entry:
                if analyze_request.force_regenerate:
                    # Soft delete the existing entry
                    logger.info(f"Force regenerating: Deleting existing matrix entry {existing_entry.id} for requirement {requirement.id} and document {document.id}")
                    existing_entry.deleted_at = func.now()
                    await db.flush()

                    # Log audit event for deletion
                    await log_audit_event(
                        request=request,
                        current_user=current_user,
                        action="MATRIX_ENTRY_DELETED",
                        entity_type="matrix_entry",
                        entity_id=existing_entry.id,
                        details={
                            "reason": "force_regenerate",
                            "requirement_id": requirement.requirement_id,
                            "document_id": document.id
                        },
                        db=db
                    )
                else:
                    logger.info(f"Matrix entry already exists for requirement {requirement.id} and document {document.id}, skipping")
                    continue

            # Generate matrix entry using AI
            logger.info(f"Generating matrix entry for requirement {requirement.id}: {requirement.requirement_id}")

            # Wrap document in expected format for AI service
            formatted_specs = {
                "documents": [
                    {
                        "filename": document.original_filename,
                        "document_info": document.extracted_json.get("document_info", {}),
                        "sections": document.extracted_json.get("sections", []),
                        "extraction_metadata": document.extracted_json.get("extraction_metadata", {})
                    }
                ],
                "document_sources": [
                    {
                        "document_id": document.id,
                        "filename": document.original_filename,
                        "extraction_model": document.extraction_model
                    }
                ]
            }

            matrix_data = await ai_service.generate_matrix_entry(
                requirement=requirement.description,
                requirement_category=requirement.category or "General",
                extracted_specs=formatted_specs
            )

            # Create matrix entry
            matrix_entry = MatrixEntryModel(
                requirement_id=requirement.id,
                document_id=document.id,
                spec_reference=matrix_data.get("spec_reference"),
                supplier_response=matrix_data.get("supplier_response"),
                justification=matrix_data.get("justification"),
                compliance_status=matrix_data.get("compliance_status", "Requires Clarification"),
                test_reference=matrix_data.get("test_reference"),
                risk_assessment=matrix_data.get("risk_assessment"),
                comments=matrix_data.get("comments"),
                generation_model=matrix_data.get("generation_metadata", {}).get("model", settings.OLLAMA_MODEL),
                generated_at=func.now(),
                generation_metadata=matrix_data.get("generation_metadata"),
                review_status="pending",
                created_by=current_user.id
            )

            db.add(matrix_entry)
            await db.flush()  # Get ID without committing
            await db.refresh(matrix_entry)

            created_entries.append(matrix_entry)

            # Log audit event
            await log_audit_event(
                request=request,
                current_user=current_user,
                action="MATRIX_ENTRY_GENERATED",
                entity_type="matrix_entry",
                entity_id=matrix_entry.id,
                details={
                    "requirement_id": requirement.requirement_id,
                    "document_id": document.id,
                    "compliance_status": matrix_entry.compliance_status
                },
                db=db
            )

        except Exception as e:
            logger.error(f"Failed to generate matrix entry for requirement {requirement.id}: {e}")
            # Continue with other requirements
            continue

    # Commit all entries
    await db.commit()

    # Convert to Pydantic schemas
    return {
        "message": f"Generated {len(created_entries)} matrix entries",
        "entries": [MatrixEntrySchema.model_validate(entry) for entry in created_entries],
        "skipped": len(requirements) - len(created_entries)
    }


@router.get("/{project_id}/matrix")
async def list_matrix_entries(
    project_id: int,
    current_user: User = Security(get_current_user, scopes=["engineer"]),
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_project_access),
    compliance_status: str = None,
    review_status: str = None
) -> Any:
    """List all matrix entries for a project"""
    from app.models.matrix import MatrixEntry as MatrixEntryModel
    from app.schemas.matrix import MatrixEntry as MatrixEntrySchema

    # Build query with joins
    stmt = select(MatrixEntryModel).join(Requirement).where(
        and_(
            Requirement.project_id == project_id,
            Requirement.deleted_at.is_(None),
            MatrixEntryModel.deleted_at.is_(None)
        )
    )

    # Apply filters
    if compliance_status:
        stmt = stmt.where(MatrixEntryModel.compliance_status == compliance_status)

    if review_status:
        stmt = stmt.where(MatrixEntryModel.review_status == review_status)

    stmt = stmt.order_by(MatrixEntryModel.created_at.desc())

    result = await db.execute(stmt)
    entries = result.scalars().all()

    # Convert to Pydantic schemas
    return [MatrixEntrySchema.model_validate(entry) for entry in entries]
