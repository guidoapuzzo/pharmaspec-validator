import logging
from celery import Celery
from sqlalchemy import select, update
from sqlalchemy.sql import func

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.document import Document
from app.services.ai_service import AIService
from app.services.document_processor import DocumentProcessor

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


@celery_app.task(name="tasks.process_document", bind=True, max_retries=3)
def process_document_task(self, document_id: int):
    """
    Background task to process document with Gemini API
    
    Args:
        document_id: ID of the document to process
    """
    import asyncio
    
    async def _process():
        async with AsyncSessionLocal() as db:
            try:
                # Get document from database
                stmt = select(Document).where(Document.id == document_id)
                result = await db.execute(stmt)
                document = result.scalar_one_or_none()
                
                if not document:
                    logger.error(f"Document {document_id} not found")
                    return
                
                logger.info(f"Starting extraction for document {document_id}: {document.filename}")
                
                # Update status to processing
                document.extraction_status = "processing"
                await db.commit()
                
                # Initialize services
                ai_service = AIService()
                doc_processor = DocumentProcessor()
                
                # Read file content
                file_content = await doc_processor.get_file_content(document.file_path)
                
                if not file_content:
                    raise Exception(f"Failed to read file: {document.file_path}")
                
                logger.info(f"File read successfully, size: {len(file_content)} bytes")
                
                # Extract specifications with Gemini
                logger.info(f"Calling Gemini API for document {document_id}")
                extracted_data = await ai_service.extract_document_specifications(
                    document_content=file_content,
                    filename=document.original_filename,
                    mime_type=document.mime_type
                )
                
                logger.info(f"Gemini extraction completed for document {document_id}")
                
                # Update document with extracted data
                stmt = (
                    update(Document)
                    .where(Document.id == document_id)
                    .values(
                        extracted_json=extracted_data,
                        extraction_status="completed",
                        extraction_model="gemini-1.5-flash",
                        extracted_at=func.now()
                    )
                )
                await db.execute(stmt)
                await db.commit()
                
                logger.info(f"Document {document_id} extraction completed successfully")
                
            except Exception as e:
                logger.error(f"Error processing document {document_id}: {str(e)}", exc_info=True)
                
                # Update status to failed
                stmt = (
                    update(Document)
                    .where(Document.id == document_id)
                    .values(
                        extraction_status="failed",
                        extraction_error=str(e)
                    )
                )
                await db.execute(stmt)
                await db.commit()
                
                # Retry the task if not max retries
                if self.request.retries < self.max_retries:
                    logger.info(f"Retrying document {document_id} processing...")
                    raise self.retry(exc=e, countdown=60)  # Retry after 60 seconds
    
    # Run the async function
    asyncio.run(_process())


@celery_app.task(name="tasks.health_check")
def health_check_task():
    """Simple health check task"""
    return {"status": "healthy", "task": "health_check"}
