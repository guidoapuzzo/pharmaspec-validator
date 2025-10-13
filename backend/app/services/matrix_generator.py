import logging
import asyncio
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.services.ai_service import AIService
from app.models.requirement import Requirement
from app.models.matrix import MatrixEntry
from app.models.document import Document
from app.models.user import User

logger = logging.getLogger(__name__)


class MatrixGenerator:
    """
    Service for generating traceability matrix entries
    Orchestrates the two-step AI workflow for matrix generation
    """

    def __init__(self):
        self.ai_service = AIService()

    async def generate_matrix_for_project(
        self,
        project_id: int,
        user_id: int,
        db: AsyncSession,
        batch_size: int = 5
    ) -> Dict[str, Any]:
        """
        Generate traceability matrix for all requirements in a project
        
        Args:
            project_id: Project ID
            user_id: User ID for audit trail
            db: Database session
            batch_size: Number of requirements to process in parallel
            
        Returns:
            Generation summary and results
        """
        logger.info(f"Starting matrix generation for project {project_id}")
        
        try:
            # Get all requirements for the project
            stmt = select(Requirement).where(
                Requirement.project_id == project_id,
                Requirement.deleted_at.is_(None)
            ).order_by(Requirement.id)
            result = await db.execute(stmt)
            requirements = result.scalars().all()
            
            if not requirements:
                return {
                    "success": False,
                    "error": "No requirements found for project",
                    "generated_count": 0
                }
            
            # Get extracted document specifications for the project
            stmt = select(Document).where(
                Document.project_id == project_id,
                Document.extraction_status == "completed",
                Document.deleted_at.is_(None)
            )
            result = await db.execute(stmt)
            documents = result.scalars().all()
            
            if not documents:
                return {
                    "success": False,
                    "error": "No extracted documents found for project",
                    "generated_count": 0
                }
            
            # Combine all extracted specifications
            combined_specs = await self._combine_document_specifications(documents)
            
            # Process requirements in batches to avoid overwhelming the AI service
            total_requirements = len(requirements)
            generated_count = 0
            failed_count = 0
            results = []
            
            for i in range(0, total_requirements, batch_size):
                batch = requirements[i:i + batch_size]
                batch_results = await self._process_requirements_batch(
                    batch, combined_specs, user_id, db
                )
                
                for result in batch_results:
                    if result["success"]:
                        generated_count += 1
                    else:
                        failed_count += 1
                    results.append(result)
                
                # Small delay between batches to be respectful to AI services
                if i + batch_size < total_requirements:
                    await asyncio.sleep(1)
            
            logger.info(
                f"Matrix generation completed for project {project_id}: "
                f"{generated_count} generated, {failed_count} failed"
            )
            
            return {
                "success": True,
                "total_requirements": total_requirements,
                "generated_count": generated_count,
                "failed_count": failed_count,
                "results": results
            }
            
        except Exception as e:
            logger.error(f"Matrix generation failed for project {project_id}: {e}")
            return {
                "success": False,
                "error": str(e),
                "generated_count": 0
            }

    async def generate_matrix_for_requirement(
        self,
        requirement_id: int,
        user_id: int,
        db: AsyncSession,
        regenerate: bool = False
    ) -> Dict[str, Any]:
        """
        Generate matrix entry for a single requirement
        
        Args:
            requirement_id: Requirement ID
            user_id: User ID for audit trail
            db: Database session
            regenerate: Whether to regenerate existing entries
            
        Returns:
            Generation result
        """
        try:
            # Get requirement
            stmt = select(Requirement).where(Requirement.id == requirement_id)
            result = await db.execute(stmt)
            requirement = result.scalar_one_or_none()
            
            if not requirement:
                return {"success": False, "error": "Requirement not found"}
            
            # Check if matrix entry already exists
            if not regenerate:
                stmt = select(MatrixEntry).where(
                    MatrixEntry.requirement_id == requirement_id,
                    MatrixEntry.deleted_at.is_(None)
                )
                result = await db.execute(stmt)
                existing_entry = result.scalar_one_or_none()
                
                if existing_entry:
                    return {
                        "success": False,
                        "error": "Matrix entry already exists. Use regenerate=True to overwrite.",
                        "existing_entry_id": existing_entry.id
                    }
            
            # Get extracted specifications for the project
            stmt = select(Document).where(
                Document.project_id == requirement.project_id,
                Document.extraction_status == "completed",
                Document.deleted_at.is_(None)
            )
            result = await db.execute(stmt)
            documents = result.scalars().all()
            
            if not documents:
                return {
                    "success": False,
                    "error": "No extracted documents found for project"
                }
            
            # Combine specifications
            combined_specs = await self._combine_document_specifications(documents)
            
            # Generate matrix entry
            generated_entry = await self.ai_service.generate_matrix_entry(
                requirement=requirement.description,
                requirement_category=requirement.category or "General",
                extracted_specs=combined_specs,
                project_context={
                    "project_id": requirement.project_id,
                    "requirement_id": requirement.requirement_id,
                    "priority": requirement.priority
                }
            )
            
            # Create or update matrix entry in database
            if regenerate:
                # Update existing entry
                stmt = select(MatrixEntry).where(
                    MatrixEntry.requirement_id == requirement_id,
                    MatrixEntry.deleted_at.is_(None)
                )
                result = await db.execute(stmt)
                matrix_entry = result.scalar_one_or_none()
                
                if matrix_entry:
                    # Update fields
                    matrix_entry.spec_reference = generated_entry.get("spec_reference")
                    matrix_entry.supplier_response = generated_entry.get("supplier_response")
                    matrix_entry.justification = generated_entry.get("justification")
                    matrix_entry.compliance_status = generated_entry.get("compliance_status")
                    matrix_entry.test_reference = generated_entry.get("test_reference")
                    matrix_entry.risk_assessment = generated_entry.get("risk_assessment")
                    matrix_entry.comments = generated_entry.get("comments")
                    matrix_entry.generation_model = generated_entry["generation_metadata"]["model"]
                    matrix_entry.generation_metadata = generated_entry.get("generation_metadata")
                    matrix_entry.last_modified_by = user_id
                    matrix_entry.review_status = "pending"
                else:
                    # Create new entry
                    matrix_entry = MatrixEntry(
                        requirement_id=requirement_id,
                        spec_reference=generated_entry.get("spec_reference"),
                        supplier_response=generated_entry.get("supplier_response"),
                        justification=generated_entry.get("justification"),
                        compliance_status=generated_entry.get("compliance_status"),
                        test_reference=generated_entry.get("test_reference"),
                        risk_assessment=generated_entry.get("risk_assessment"),
                        comments=generated_entry.get("comments"),
                        generation_model=generated_entry["generation_metadata"]["model"],
                        generation_metadata=generated_entry.get("generation_metadata"),
                        created_by=user_id,
                        review_status="pending"
                    )
                    db.add(matrix_entry)
            else:
                # Create new entry
                matrix_entry = MatrixEntry(
                    requirement_id=requirement_id,
                    spec_reference=generated_entry.get("spec_reference"),
                    supplier_response=generated_entry.get("supplier_response"),
                    justification=generated_entry.get("justification"),
                    compliance_status=generated_entry.get("compliance_status"),
                    test_reference=generated_entry.get("test_reference"),
                    risk_assessment=generated_entry.get("risk_assessment"),
                    comments=generated_entry.get("comments"),
                    generation_model=generated_entry["generation_metadata"]["model"],
                    generation_metadata=generated_entry.get("generation_metadata"),
                    created_by=user_id,
                    review_status="pending"
                )
                db.add(matrix_entry)
            
            await db.commit()
            
            return {
                "success": True,
                "matrix_entry_id": matrix_entry.id,
                "confidence_score": generated_entry.get("confidence_score", 0),
                "compliance_status": generated_entry.get("compliance_status")
            }
            
        except Exception as e:
            logger.error(f"Matrix generation failed for requirement {requirement_id}: {e}")
            await db.rollback()
            return {"success": False, "error": str(e)}

    async def _process_requirements_batch(
        self,
        requirements: List[Requirement],
        combined_specs: Dict[str, Any],
        user_id: int,
        db: AsyncSession
    ) -> List[Dict[str, Any]]:
        """Process a batch of requirements in parallel"""
        
        tasks = []
        for requirement in requirements:
            task = self._generate_single_matrix_entry(
                requirement, combined_specs, user_id, db
            )
            tasks.append(task)
        
        # Execute all tasks in parallel
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        # Process results
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                processed_results.append({
                    "success": False,
                    "requirement_id": requirements[i].id,
                    "error": str(result)
                })
            else:
                processed_results.append(result)
        
        return processed_results

    async def _generate_single_matrix_entry(
        self,
        requirement: Requirement,
        combined_specs: Dict[str, Any],
        user_id: int,
        db: AsyncSession
    ) -> Dict[str, Any]:
        """Generate matrix entry for a single requirement"""
        
        try:
            # Check if entry already exists
            stmt = select(MatrixEntry).where(
                MatrixEntry.requirement_id == requirement.id,
                MatrixEntry.deleted_at.is_(None)
            )
            result = await db.execute(stmt)
            existing_entry = result.scalar_one_or_none()
            
            if existing_entry:
                return {
                    "success": False,
                    "requirement_id": requirement.id,
                    "error": "Matrix entry already exists",
                    "existing_entry_id": existing_entry.id
                }
            
            # Generate matrix entry using AI service
            generated_entry = await self.ai_service.generate_matrix_entry(
                requirement=requirement.description,
                requirement_category=requirement.category or "General",
                extracted_specs=combined_specs,
                project_context={
                    "project_id": requirement.project_id,
                    "requirement_id": requirement.requirement_id,
                    "priority": requirement.priority
                }
            )
            
            # Create matrix entry in database
            matrix_entry = MatrixEntry(
                requirement_id=requirement.id,
                spec_reference=generated_entry.get("spec_reference"),
                supplier_response=generated_entry.get("supplier_response"),
                justification=generated_entry.get("justification"),
                compliance_status=generated_entry.get("compliance_status"),
                test_reference=generated_entry.get("test_reference"),
                risk_assessment=generated_entry.get("risk_assessment"),
                comments=generated_entry.get("comments"),
                generation_model=generated_entry["generation_metadata"]["model"],
                generation_metadata=generated_entry.get("generation_metadata"),
                created_by=user_id,
                review_status="pending"
            )
            
            db.add(matrix_entry)
            await db.commit()
            
            return {
                "success": True,
                "requirement_id": requirement.id,
                "matrix_entry_id": matrix_entry.id,
                "confidence_score": generated_entry.get("confidence_score", 0)
            }
            
        except Exception as e:
            await db.rollback()
            return {
                "success": False,
                "requirement_id": requirement.id,
                "error": str(e)
            }

    async def _combine_document_specifications(
        self, documents: List[Document]
    ) -> Dict[str, Any]:
        """Combine extracted specifications from multiple documents"""

        logger.info(f"_combine_document_specifications called with {len(documents)} documents")

        combined = {
            "documents": [],
            "document_sources": []
        }

        for doc in documents:
            logger.info(f"Processing document {doc.id}: {doc.original_filename}")
            logger.info(f"  has extracted_json: {doc.extracted_json is not None}")

            if not doc.extracted_json:
                logger.warning(f"  Document {doc.id} has no extracted_json, skipping")
                continue

            logger.info(f"  document_info: {doc.extracted_json.get('document_info', {})}")
            sections_count = len(doc.extracted_json.get('sections', []))
            logger.info(f"  sections count: {sections_count}")

            if sections_count > 0:
                first_section_preview = str(doc.extracted_json['sections'][0])[:200]
                logger.info(f"  First section preview: {first_section_preview}")

            # Add full extracted document with actual content
            combined["documents"].append({
                "filename": doc.original_filename,
                "document_info": doc.extracted_json.get("document_info", {}),
                "sections": doc.extracted_json.get("sections", []),
                "extraction_metadata": doc.extracted_json.get("extraction_metadata", {})
            })

            # Add source tracking
            combined["document_sources"].append({
                "document_id": doc.id,
                "filename": doc.original_filename,
                "extraction_model": doc.extraction_model,
                "extracted_at": str(doc.extracted_at) if doc.extracted_at else None
            })

        logger.info(f"Returning combined specs with {len(combined['documents'])} documents")
        if len(combined['documents']) == 0:
            logger.error("WARNING: No documents in combined specs! Llama will have nothing to reference.")

        return combined