import logging
from datetime import datetime, timedelta
from celery import Celery
from sqlalchemy import create_engine, select, update
from sqlalchemy.orm import sessionmaker
from sqlalchemy.sql import func

from app.core.config import settings
from app.models.document import Document
from app.models.project import Project
from app.models.audit_log import AuditLog

logger = logging.getLogger(__name__)

# Initialize Celery
celery_app = Celery(
    "pharmaspec",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL
)

celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=600,  # 10 minutes max per task
    worker_prefetch_multiplier=1,
)

# Celery Beat Schedule for periodic tasks
celery_app.conf.beat_schedule = {
    'purge-old-deleted-projects-daily': {
        'task': 'tasks.purge_old_deleted_projects',
        'schedule': 86400.0,  # Run every 24 hours (in seconds)
        # Alternatively, use crontab for specific time:
        # 'schedule': crontab(hour=2, minute=0),  # Run at 2:00 AM UTC daily
        'options': {'expires': 3600},  # Task expires after 1 hour if not executed
    },
}

# Create synchronous database engine for Celery workers
# Convert asyncpg URL to psycopg2 URL
sync_db_url = str(settings.DATABASE_URL).replace(
    'postgresql+asyncpg://', 
    'postgresql+psycopg2://'
)

sync_engine = create_engine(sync_db_url, pool_pre_ping=True)
SyncSessionLocal = sessionmaker(bind=sync_engine)


@celery_app.task(name="tasks.process_document", bind=True, max_retries=3)
def process_document_task(self, document_id: int):
    """
    Background task to process document with Gemini API
    
    Args:
        document_id: ID of the document to process
    """
    db = SyncSessionLocal()
    
    try:
        # Get document from database
        document = db.query(Document).filter(Document.id == document_id).first()
        
        if not document:
            logger.error(f"Document {document_id} not found")
            return
        
        logger.info(f"Starting extraction for document {document_id}: {document.filename}")
        
        # Update status to processing
        document.extraction_status = "processing"
        db.commit()
        
        # Initialize services (import here to avoid circular imports)
        from app.services.ai_service import AIService
        from app.services.document_processor import DocumentProcessor
        import asyncio
        
        ai_service = AIService()
        doc_processor = DocumentProcessor()
        
        # Read file content (this is async, so we need to run it in event loop)
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        try:
            file_content = loop.run_until_complete(
                doc_processor.get_file_content(document.file_path)
            )
            
            if not file_content:
                raise Exception(f"Failed to read file: {document.file_path}")
            
            logger.info(f"File read successfully, size: {len(file_content)} bytes")
            
            # Extract specifications with Gemini
            logger.info(f"Calling Gemini API for document {document_id}")
            extracted_data = loop.run_until_complete(
                ai_service.extract_document_specifications(
                    document_content=file_content,
                    filename=document.original_filename,
                    mime_type=document.mime_type
                )
            )
            
            logger.info(f"Gemini extraction completed for document {document_id}")
            
            # Update document with extracted data
            document.extracted_json = extracted_data
            document.extraction_status = "completed"
            document.extraction_model = "gemini-1.5-flash"
            document.extracted_at = func.now()
            
            db.commit()
            
            logger.info(f"Document {document_id} extraction completed successfully")
            
        finally:
            loop.close()
        
    except Exception as e:
        logger.error(f"Error processing document {document_id}: {str(e)}", exc_info=True)
        
        try:
            # Update status to failed
            document = db.query(Document).filter(Document.id == document_id).first()
            if document:
                document.extraction_status = "failed"
                document.extraction_error = str(e)[:1000]  # Truncate error message
                db.commit()
        except Exception as db_error:
            logger.error(f"Failed to update error status: {db_error}")
        
        # Retry the task if not max retries
        if self.request.retries < self.max_retries:
            logger.info(f"Retrying document {document_id} processing...")
            raise self.retry(exc=e, countdown=60)  # Retry after 60 seconds
        
    finally:
        db.close()


@celery_app.task(name="tasks.health_check")
def health_check_task():
    """Simple health check task"""
    return {"status": "healthy", "task": "health_check"}


@celery_app.task(name="tasks.purge_old_deleted_projects")
def purge_old_deleted_projects_task():
    """
    Periodic task to permanently delete (hard delete) projects that have been
    soft-deleted for longer than DATA_RETENTION_DAYS.

    This ensures compliance with data retention policies while maintaining GxP
    audit trail requirements.
    """
    db = SyncSessionLocal()
    purged_count = 0

    try:
        # Calculate cutoff date
        cutoff_date = datetime.utcnow() - timedelta(days=settings.DATA_RETENTION_DAYS)

        logger.info(f"Starting purge of projects deleted before {cutoff_date.isoformat()}")

        # Query for projects soft-deleted before cutoff date
        stmt = select(Project).where(
            Project.deleted_at.isnot(None),
            Project.deleted_at < cutoff_date
        )

        projects_to_purge = db.execute(stmt).scalars().all()

        if not projects_to_purge:
            logger.info("No projects to purge")
            return {"status": "completed", "purged_count": 0}

        logger.info(f"Found {len(projects_to_purge)} projects to purge")

        for project in projects_to_purge:
            try:
                # Log audit event before permanent deletion
                audit_entry = AuditLog(
                    user_id=None,  # System action
                    action="PROJECT_PURGED",
                    entity_type="project",
                    entity_id=project.id,
                    ip_address="system",
                    user_agent="celery-worker",
                    details={
                        "project_name": project.name,
                        "project_id": project.id,
                        "deleted_at": project.deleted_at.isoformat() if project.deleted_at else None,
                        "retention_days": settings.DATA_RETENTION_DAYS,
                        "reason": "Automatic purge - retention period exceeded"
                    },
                    timestamp=func.now()
                )
                db.add(audit_entry)
                db.flush()

                # Hard delete (CASCADE will handle related documents, requirements, matrix entries)
                logger.info(f"Permanently deleting project {project.id}: {project.name}")
                db.delete(project)
                db.commit()

                purged_count += 1
                logger.info(f"Successfully purged project {project.id}")

            except Exception as e:
                logger.error(f"Failed to purge project {project.id}: {str(e)}", exc_info=True)
                db.rollback()
                continue

        logger.info(f"Purge completed. Total projects purged: {purged_count}")
        return {"status": "completed", "purged_count": purged_count}

    except Exception as e:
        logger.error(f"Error during purge task: {str(e)}", exc_info=True)
        db.rollback()
        return {"status": "failed", "error": str(e), "purged_count": purged_count}

    finally:
        db.close()
