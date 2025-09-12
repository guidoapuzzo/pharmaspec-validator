import json
import asyncio
import logging
from typing import Dict, Any, Optional
import httpx
import ollama
import google.generativeai as genai

from app.core.config import settings

logger = logging.getLogger(__name__)


class AIService:
    """
    AI Service for two-step workflow:
    1. Gemini API for document extraction
    2. Ollama/Llama for matrix generation
    """

    def __init__(self):
        # Configure Gemini API
        if settings.GEMINI_API_KEY:
            genai.configure(api_key=settings.GEMINI_API_KEY)
            self.gemini_model = genai.GenerativeModel('gemini-1.5-flash')
        else:
            self.gemini_model = None
            logger.warning("Gemini API key not configured")

        # Configure Ollama client
        self.ollama_client = ollama.AsyncClient(host=settings.OLLAMA_URL)

    async def extract_document_specifications(
        self,
        document_content: bytes,
        filename: str,
        mime_type: str
    ) -> Dict[str, Any]:
        """
        Step 1: Extract technical specifications from document using Gemini
        
        Args:
            document_content: Raw document bytes
            filename: Original filename
            mime_type: MIME type of document
            
        Returns:
            Structured JSON with extracted specifications
        """
        if not self.gemini_model:
            raise ValueError("Gemini API not configured")

        try:
            # Prepare extraction prompt for pharmaceutical CSV context
            extraction_prompt = """
            You are an expert pharmaceutical CSV (Computerized System Validation) consultant.
            Analyze this supplier specification document and extract ALL technical information that would be relevant for creating a traceability matrix.
            
            Extract and structure the information as JSON with the following categories:
            
            {
                "system_specifications": [
                    {
                        "category": "Hardware/Software/Network/etc",
                        "specification": "specific requirement or capability",
                        "reference": "section or page reference",
                        "criticality": "critical/important/nice-to-have"
                    }
                ],
                "functional_requirements": [
                    {
                        "function": "what the system does",
                        "description": "detailed description",
                        "reference": "document reference",
                        "compliance_standards": ["21CFR11", "GAMP5", "etc"]
                    }
                ],
                "technical_details": [
                    {
                        "component": "system component",
                        "details": "technical specifications",
                        "reference": "document reference",
                        "validation_requirements": "validation notes"
                    }
                ],
                "compliance_information": [
                    {
                        "standard": "regulatory standard",
                        "requirement": "specific requirement", 
                        "supplier_response": "how supplier addresses it",
                        "reference": "document reference"
                    }
                ],
                "interfaces_integrations": [
                    {
                        "interface_type": "API/Database/File/etc",
                        "description": "interface details",
                        "protocols": "communication protocols",
                        "security": "security measures"
                    }
                ],
                "security_features": [
                    {
                        "feature": "security feature name",
                        "description": "detailed description",
                        "compliance": "relevant standards"
                    }
                ]
            }
            
            Focus on extracting information that would help validate user requirements against supplier capabilities.
            Be thorough and include all technical details, but avoid speculation - only extract what's explicitly stated in the document.
            """

            # Upload document to Gemini
            if mime_type.startswith('image/'):
                # Handle image documents (PDF pages converted to images)
                uploaded_file = genai.upload_file(document_content, mime_type=mime_type)
                response = await asyncio.to_thread(
                    self.gemini_model.generate_content,
                    [uploaded_file, extraction_prompt]
                )
            else:
                # Handle text documents
                response = await asyncio.to_thread(
                    self.gemini_model.generate_content,
                    [extraction_prompt, f"Document filename: {filename}"]
                )

            # Parse response
            extracted_text = response.text
            
            # Try to extract JSON from response
            try:
                # Look for JSON block in response
                start_idx = extracted_text.find('{')
                end_idx = extracted_text.rfind('}') + 1
                
                if start_idx != -1 and end_idx > start_idx:
                    json_str = extracted_text[start_idx:end_idx]
                    extracted_data = json.loads(json_str)
                else:
                    # If no JSON found, structure the response
                    extracted_data = {
                        "extraction_method": "gemini-text-analysis",
                        "raw_content": extracted_text[:5000],  # Truncate for storage
                        "structured_data": self._structure_text_content(extracted_text)
                    }
                    
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse JSON from Gemini response: {e}")
                extracted_data = {
                    "extraction_method": "gemini-text-fallback",
                    "raw_content": extracted_text[:5000],
                    "error": str(e)
                }

            # Add metadata
            extracted_data["extraction_metadata"] = {
                "model": "gemini-1.5-flash",
                "filename": filename,
                "mime_type": mime_type,
                "extraction_timestamp": "auto-generated",
                "content_length": len(document_content)
            }

            logger.info(f"Successfully extracted specifications from {filename}")
            return extracted_data

        except Exception as e:
            logger.error(f"Document extraction failed for {filename}: {e}")
            raise

    async def generate_matrix_entry(
        self,
        requirement: str,
        requirement_category: str,
        extracted_specs: Dict[str, Any],
        project_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Step 2: Generate traceability matrix entry using local Llama model
        
        Args:
            requirement: User requirement text
            requirement_category: Category of the requirement
            extracted_specs: Structured specifications from Step 1
            project_context: Additional project context
            
        Returns:
            Generated matrix entry data
        """
        try:
            # Prepare generation prompt for traceability matrix
            matrix_prompt = f"""
            You are an expert pharmaceutical CSV consultant creating a traceability matrix entry.
            
            USER REQUIREMENT:
            Category: {requirement_category}
            Requirement: {requirement}
            
            SUPPLIER SPECIFICATIONS (extracted from documentation):
            {json.dumps(extracted_specs, indent=2)}
            
            PROJECT CONTEXT:
            {json.dumps(project_context or {}, indent=2)}
            
            Generate a comprehensive traceability matrix entry with the following JSON structure:
            {{
                "spec_reference": "Specific reference to supplier spec that addresses this requirement",
                "supplier_response": "How the supplier addresses this requirement based on their documentation",
                "justification": "Technical justification for why this requirement is satisfied",
                "compliance_status": "Compliant|Non-compliant|Partial|Requires Clarification",
                "test_reference": "Suggested test approach or reference",
                "risk_assessment": "Low|Medium|High risk and explanation",
                "comments": "Additional notes or concerns",
                "confidence_score": "0-100 confidence in this assessment",
                "verification_needed": "List of items that need verification during validation"
            }}
            
            Base your assessment ONLY on the provided supplier specifications. 
            If information is missing, indicate "Requires Clarification" and note what's needed.
            Be precise and reference specific sections of the supplier documentation.
            """

            # Call Ollama with local Llama model
            response = await self.ollama_client.generate(
                model='llama3.2',  # Adjust model name as needed
                prompt=matrix_prompt,
                options={
                    'temperature': 0.3,  # Lower temperature for consistency
                    'top_p': 0.9,
                    'num_predict': 2048  # Limit response length
                }
            )

            # Parse response
            response_text = response['response']
            
            try:
                # Extract JSON from response
                start_idx = response_text.find('{')
                end_idx = response_text.rfind('}') + 1
                
                if start_idx != -1 and end_idx > start_idx:
                    json_str = response_text[start_idx:end_idx]
                    matrix_entry = json.loads(json_str)
                else:
                    # Fallback structure
                    matrix_entry = {
                        "spec_reference": "Generated by AI - review required",
                        "supplier_response": response_text[:1000],
                        "justification": "AI-generated assessment - requires validation",
                        "compliance_status": "Requires Clarification",
                        "confidence_score": 50,
                        "comments": "AI response parsing failed - manual review needed"
                    }

            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse JSON from Ollama response: {e}")
                matrix_entry = {
                    "spec_reference": "AI generation failed",
                    "supplier_response": response_text[:1000],
                    "justification": "AI-generated - requires manual review",
                    "compliance_status": "Requires Clarification",
                    "confidence_score": 30,
                    "comments": f"JSON parsing error: {str(e)}"
                }

            # Add generation metadata
            matrix_entry["generation_metadata"] = {
                "model": "llama3.2",
                "requirement": requirement,
                "requirement_category": requirement_category,
                "generation_timestamp": "auto-generated",
                "prompt_version": "v1.0"
            }

            logger.info(f"Successfully generated matrix entry for requirement: {requirement[:50]}...")
            return matrix_entry

        except Exception as e:
            logger.error(f"Matrix generation failed for requirement '{requirement}': {e}")
            # Return error entry that can still be used
            return {
                "spec_reference": "AI generation failed",
                "supplier_response": "Error during AI processing",
                "justification": f"AI service error: {str(e)}",
                "compliance_status": "Requires Clarification",
                "confidence_score": 0,
                "comments": "Manual review required due to AI processing error",
                "generation_error": str(e)
            }

    def _structure_text_content(self, text: str) -> Dict[str, Any]:
        """
        Fallback method to structure text content when JSON parsing fails
        """
        return {
            "content_summary": text[:500],
            "extraction_method": "text-fallback",
            "requires_manual_review": True,
            "system_specifications": [],
            "functional_requirements": [],
            "technical_details": [],
            "compliance_information": []
        }

    async def health_check(self) -> Dict[str, bool]:
        """Check health of AI services"""
        status = {
            "gemini_available": bool(self.gemini_model),
            "ollama_available": False
        }

        try:
            # Test Ollama connection
            models = await self.ollama_client.list()
            status["ollama_available"] = len(models.get('models', [])) > 0
        except Exception as e:
            logger.warning(f"Ollama health check failed: {e}")

        return status