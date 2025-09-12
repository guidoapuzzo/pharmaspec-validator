import os
import hashlib
import logging
from typing import Optional, Dict, Any
import mimetypes
from pathlib import Path
import pypdf
from datetime import datetime

from app.core.config import settings

logger = logging.getLogger(__name__)


class DocumentProcessor:
    """
    Service for processing and managing document files
    Handles file operations, validation, and metadata extraction
    """

    def __init__(self):
        self.upload_dir = Path(settings.UPLOAD_DIR)
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Supported MIME types for pharmaceutical documents
        self.supported_mime_types = {
            'application/pdf': ['.pdf'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/msword': ['.doc'],
            'application/vnd.ms-excel': ['.xls'],
            'text/plain': ['.txt']
        }

    async def validate_file(
        self,
        filename: str,
        content: bytes,
        max_size: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Validate uploaded file for security and compliance
        
        Args:
            filename: Original filename
            content: File content bytes
            max_size: Maximum allowed file size
            
        Returns:
            Validation result with metadata
        """
        max_size = max_size or settings.MAX_UPLOAD_SIZE
        
        # Basic validations
        if not filename:
            return {"valid": False, "error": "Filename is required"}
        
        if len(content) == 0:
            return {"valid": False, "error": "File is empty"}
        
        if len(content) > max_size:
            return {
                "valid": False,
                "error": f"File too large. Maximum size is {max_size / (1024*1024):.1f}MB"
            }
        
        # File extension validation
        file_ext = Path(filename).suffix.lower()
        if file_ext not in settings.ALLOWED_EXTENSIONS:
            return {
                "valid": False,
                "error": f"File type not allowed. Supported types: {', '.join(settings.ALLOWED_EXTENSIONS)}"
            }
        
        # MIME type detection
        mime_type, _ = mimetypes.guess_type(filename)
        if not mime_type:
            mime_type = "application/octet-stream"
        
        # Security check: verify MIME type matches extension
        if mime_type in self.supported_mime_types:
            expected_extensions = self.supported_mime_types[mime_type]
            if file_ext not in expected_extensions:
                return {
                    "valid": False,
                    "error": f"File extension {file_ext} doesn't match detected type {mime_type}"
                }
        
        # Content validation based on type
        content_validation = await self._validate_content_by_type(content, mime_type, filename)
        if not content_validation["valid"]:
            return content_validation
        
        # Calculate file hash for integrity
        file_hash = hashlib.sha256(content).hexdigest()
        
        return {
            "valid": True,
            "mime_type": mime_type,
            "file_hash": file_hash,
            "file_size": len(content),
            "extension": file_ext,
            "content_info": content_validation.get("content_info", {})
        }

    async def _validate_content_by_type(
        self,
        content: bytes,
        mime_type: str,
        filename: str
    ) -> Dict[str, Any]:
        """Validate file content based on MIME type"""
        
        if mime_type == 'application/pdf':
            return await self._validate_pdf_content(content)
        elif 'word' in mime_type.lower() or 'document' in mime_type.lower():
            return await self._validate_office_document(content, mime_type)
        elif mime_type == 'text/plain':
            return await self._validate_text_content(content)
        else:
            # For other types, basic validation
            return {
                "valid": True,
                "content_info": {
                    "type": "binary",
                    "size": len(content)
                }
            }

    async def _validate_pdf_content(self, content: bytes) -> Dict[str, Any]:
        """Validate PDF content and extract metadata"""
        try:
            # Create a temporary file-like object
            from io import BytesIO
            pdf_buffer = BytesIO(content)
            
            # Read PDF
            pdf_reader = pypdf.PdfReader(pdf_buffer)
            
            # Basic PDF validation
            if len(pdf_reader.pages) == 0:
                return {"valid": False, "error": "PDF has no pages"}
            
            # Extract metadata
            metadata = pdf_reader.metadata or {}
            
            # Extract text from first page for content preview
            first_page_text = ""
            if len(pdf_reader.pages) > 0:
                first_page_text = pdf_reader.pages[0].extract_text()[:500]
            
            return {
                "valid": True,
                "content_info": {
                    "type": "pdf",
                    "pages": len(pdf_reader.pages),
                    "title": metadata.get('/Title', ''),
                    "author": metadata.get('/Author', ''),
                    "creator": metadata.get('/Creator', ''),
                    "producer": metadata.get('/Producer', ''),
                    "creation_date": str(metadata.get('/CreationDate', '')),
                    "modification_date": str(metadata.get('/ModDate', '')),
                    "first_page_preview": first_page_text[:200],
                    "encrypted": pdf_reader.is_encrypted
                }
            }
            
        except Exception as e:
            logger.error(f"PDF validation failed: {e}")
            return {"valid": False, "error": f"Invalid PDF file: {str(e)}"}

    async def _validate_office_document(self, content: bytes, mime_type: str) -> Dict[str, Any]:
        """Validate Microsoft Office documents"""
        try:
            # Basic ZIP validation (Office docs are ZIP archives)
            import zipfile
            from io import BytesIO
            
            zip_buffer = BytesIO(content)
            with zipfile.ZipFile(zip_buffer, 'r') as zip_file:
                # Check for Office document structure
                files = zip_file.namelist()
                
                if 'word' in mime_type:
                    required_files = ['word/document.xml']
                elif 'sheet' in mime_type:
                    required_files = ['xl/workbook.xml']
                else:
                    required_files = []
                
                for required in required_files:
                    if required not in files:
                        return {"valid": False, "error": f"Invalid Office document structure"}
                
                return {
                    "valid": True,
                    "content_info": {
                        "type": "office_document",
                        "mime_type": mime_type,
                        "files_count": len(files)
                    }
                }
                
        except Exception as e:
            logger.error(f"Office document validation failed: {e}")
            return {"valid": False, "error": f"Invalid Office document: {str(e)}"}

    async def _validate_text_content(self, content: bytes) -> Dict[str, Any]:
        """Validate text files"""
        try:
            # Try to decode as UTF-8
            text_content = content.decode('utf-8')
            
            return {
                "valid": True,
                "content_info": {
                    "type": "text",
                    "encoding": "utf-8",
                    "lines": len(text_content.splitlines()),
                    "characters": len(text_content),
                    "preview": text_content[:200]
                }
            }
            
        except UnicodeDecodeError:
            try:
                # Try other encodings
                text_content = content.decode('latin-1')
                return {
                    "valid": True,
                    "content_info": {
                        "type": "text",
                        "encoding": "latin-1",
                        "lines": len(text_content.splitlines()),
                        "characters": len(text_content)
                    }
                }
            except:
                return {"valid": False, "error": "Unable to decode text file"}

    async def save_file(
        self,
        content: bytes,
        original_filename: str,
        project_id: int,
        validation_result: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Save validated file to storage
        
        Args:
            content: File content bytes
            original_filename: Original filename
            project_id: Project ID for organization
            validation_result: Result from validate_file
            
        Returns:
            File storage information
        """
        # Create project-specific directory
        project_dir = self.upload_dir / f"project_{project_id}"
        project_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_ext = Path(original_filename).suffix.lower()
        safe_name = "".join(c for c in Path(original_filename).stem if c.isalnum() or c in '._- ')[:50]
        unique_filename = f"{timestamp}_{safe_name}{file_ext}"
        
        file_path = project_dir / unique_filename
        
        try:
            # Write file to disk
            with open(file_path, 'wb') as f:
                f.write(content)
            
            # Verify file was written correctly
            if not file_path.exists() or file_path.stat().st_size != len(content):
                raise Exception("File write verification failed")
            
            logger.info(f"File saved: {file_path}")
            
            return {
                "success": True,
                "file_path": str(file_path),
                "filename": unique_filename,
                "original_filename": original_filename,
                "file_size": len(content),
                "mime_type": validation_result["mime_type"],
                "file_hash": validation_result["file_hash"]
            }
            
        except Exception as e:
            logger.error(f"File save failed: {e}")
            return {
                "success": False,
                "error": f"Failed to save file: {str(e)}"
            }

    async def delete_file(self, file_path: str) -> bool:
        """
        Safely delete file from storage
        
        Args:
            file_path: Path to file to delete
            
        Returns:
            True if successful, False otherwise
        """
        try:
            path = Path(file_path)
            
            # Security check: ensure file is within upload directory
            if not str(path.resolve()).startswith(str(self.upload_dir.resolve())):
                logger.error(f"Attempt to delete file outside upload directory: {file_path}")
                return False
            
            if path.exists():
                path.unlink()
                logger.info(f"File deleted: {file_path}")
                return True
            else:
                logger.warning(f"File not found for deletion: {file_path}")
                return True  # Already deleted
                
        except Exception as e:
            logger.error(f"File deletion failed: {e}")
            return False

    async def get_file_content(self, file_path: str) -> Optional[bytes]:
        """
        Safely read file content
        
        Args:
            file_path: Path to file
            
        Returns:
            File content bytes or None if error
        """
        try:
            path = Path(file_path)
            
            # Security check
            if not str(path.resolve()).startswith(str(self.upload_dir.resolve())):
                logger.error(f"Attempt to read file outside upload directory: {file_path}")
                return None
            
            if path.exists():
                with open(path, 'rb') as f:
                    return f.read()
            else:
                logger.error(f"File not found: {file_path}")
                return None
                
        except Exception as e:
            logger.error(f"File read failed: {e}")
            return None