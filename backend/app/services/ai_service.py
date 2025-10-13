import json
import asyncio
import logging
import io
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

    # JSON schema for matrix entry structured output
    MATRIX_ENTRY_SCHEMA = {
        "type": "object",
        "required": [
            "spec_reference",
            "supplier_response",
            "justification",
            "compliance_status",
            "confidence_score"
        ],
        "properties": {
            "spec_reference": {
                "type": "string",
                "description": "Section number and heading from supplier document"
            },
            "supplier_response": {
                "type": "string",
                "description": "Direct quote from supplier document"
            },
            "justification": {
                "type": "string",
                "description": "Technical justification for compliance assessment"
            },
            "compliance_status": {
                "type": "string",
                "enum": ["Compliant", "Non-Compliant", "Partial", "Requires Clarification"],
                "description": "Compliance status"
            },
            "test_reference": {
                "type": "string",
                "description": "Suggested test approach"
            },
            "risk_assessment": {
                "type": "string",
                "description": "Risk level and explanation"
            },
            "comments": {
                "type": "string",
                "description": "Additional validation notes"
            },
            "confidence_score": {
                "type": "number",
                "minimum": 0,
                "maximum": 100,
                "description": "Confidence in assessment (0-100)"
            },
            "verification_needed": {
                "type": "string",
                "description": "Items to verify during testing"
            }
        }
    }

    def __init__(self):
        # Configure Gemini API
        if settings.GEMINI_API_KEY:
            genai.configure(api_key=settings.GEMINI_API_KEY)

            # Gemini model for document extraction
            self.gemini_extraction_model = genai.GenerativeModel(
                settings.GEMINI_MODEL_EXTRACTION,
                generation_config={
                    "response_mime_type": "application/json",
                    "temperature": 0.1,  # Low temperature for consistent, deterministic outputs
                }
            )

            # Gemini model for matrix generation
            self.gemini_matrix_model = genai.GenerativeModel(
                settings.GEMINI_MODEL_MATRIX,
                generation_config={
                    "response_mime_type": "application/json",
                    "temperature": 0.0,  # Deterministic for traceability
                }
            )

            logger.info(f"Gemini configured: Extraction={settings.GEMINI_MODEL_EXTRACTION}, Matrix={settings.GEMINI_MODEL_MATRIX}")
        else:
            self.gemini_extraction_model = None
            self.gemini_matrix_model = None
            logger.warning("Gemini API key not configured")

        # Configure Ollama client
        self.ollama_client = ollama.AsyncClient(host=settings.OLLAMA_URL)
        logger.info(f"Matrix generation provider: {settings.MATRIX_GENERATION_PROVIDER}")

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
        if not self.gemini_extraction_model:
            raise ValueError("Gemini API not configured")

        try:
            # Prepare extraction prompt for RAW document extraction (GxP compliant)
            # Note: JSON mode is enabled - Gemini will output pure JSON automatically
            extraction_prompt = """
            You are a technical documentation specialist performing VERBATIM extraction of a supplier specification document.

            CRITICAL MISSION: Extract this document preserving EVERY SINGLE WORD EXACTLY as written.
            This is for pharmaceutical GxP/21 CFR Part 11 regulatory compliance.
            Auditors will compare your extraction with the original document word-by-word.

            You are NOT summarizing. You are NOT interpreting. You are COPYING TEXT EXACTLY.
            Think of yourself as a precise text copier, not a content analyzer.

            Output ONLY valid JSON in this exact format:
            {
                "document_info": {
                    "title": "document title if present",
                    "version": "version number if present",
                    "date": "document date if present",
                    "supplier": "supplier/vendor name if present"
                },
                "sections": [
                    {
                        "section_number": "1.0",
                        "heading": "exact section heading text",
                        "content": "exact paragraph text - copy verbatim, preserve ALL technical details and specifications",
                        "page_number": "page number if visible",
                        "subsections": [
                            {
                                "section_number": "1.1",
                                "heading": "exact subsection heading",
                                "content": "exact content",
                                "page_number": "page number if visible"
                            }
                        ],
                        "tables": [
                            {
                                "caption": "table caption if present",
                                "headers": ["column1", "column2", "column3"],
                                "rows": [
                                    ["exact cell content", "exact cell content", "exact cell content"],
                                    ["row 2 data", "row 2 data", "row 2 data"]
                                ]
                            }
                        ],
                        "lists": [
                            "exact bullet point or list item text",
                            "another list item with exact wording"
                        ]
                    }
                ]
            }

            CRITICAL RULES FOR VERBATIM EXTRACTION:

            WHAT "VERBATIM" MEANS:
            - Copy the EXACT spelling (even if there are typos in the source)
            - Copy the EXACT punctuation (commas, periods, semicolons, dashes)
            - Copy the EXACT numbers (99.9 not 99, 5432 not 5431)
            - Copy the EXACT capitalization (System not system, if source uses System)
            - Copy the EXACT wording (do not change "provides" to "supports" or "includes")
            - If a word is misspelled in source, copy it misspelled
            - If a sentence is awkward in source, copy it awkward

            MANDATORY REQUIREMENTS:
            1. Copy ALL text VERBATIM - every single word, letter, and punctuation mark
            2. Preserve complete document structure (sections, subsections, sub-subsections with exact numbering)
            3. Include ALL tables with exact cell contents (including units, symbols, formatting)
            4. Include ALL lists with exact bullet/number text
            5. Preserve ALL technical specifications (exact numbers, units, tolerances, ranges)
            6. Include ALL references to standards (21 CFR Part 11, GAMP 5, ISO, FDA, etc.)
            7. Do NOT change a single word - not even to "improve" grammar or clarity
            8. Do NOT skip headers, footers, captions, or any text
            9. Do NOT add explanations, summaries, or interpretations
            10. Do NOT reorder content - maintain exact sequence from document

            STRICT PROHIBITIONS:
            ❌ NO paraphrasing ("audit trail" must NOT become "audit logging")
            ❌ NO summarizing (include every sentence, even if repetitive)
            ❌ NO interpreting (don't explain what specs mean)
            ❌ NO correcting (copy typos exactly as they appear)
            ❌ NO filling gaps (if info is unclear, copy it unclear)
            ❌ NO assumptions (only include what is explicitly written)

            This is for FDA/EMA regulatory validation. Auditors will perform word-by-word comparison.
            Your accuracy determines whether this system passes regulatory inspection.
            When in doubt: COPY EXACTLY, don't interpret.
            """

            # Upload document to Gemini (supports PDFs, images, DOCX, etc.)
            # Wrap bytes in BytesIO to create a file-like object for upload
            file_obj = io.BytesIO(document_content)
            uploaded_file = genai.upload_file(
                path=file_obj,
                mime_type=mime_type,
                display_name=filename
            )

            # Generate content with uploaded file and extraction prompt
            # Use configurable timeout (important for gemini-2.5-pro which is slower)
            response = await asyncio.to_thread(
                self.gemini_extraction_model.generate_content,
                [uploaded_file, extraction_prompt],
                request_options={"timeout": settings.GEMINI_EXTRACTION_TIMEOUT}
            )

            # Parse response
            extracted_text = response.text

            # Log response info for debugging
            response_size = len(extracted_text)
            logger.info(f"Gemini response size: {response_size} characters")

            # Try to extract JSON from response
            try:
                # Handle markdown code fences (```json\n{...}\n```)
                json_str = extracted_text
                if "```json" in json_str:
                    json_str = json_str.split("```json", 1)[1]
                    json_str = json_str.split("```", 1)[0]
                elif "```" in json_str:
                    json_str = json_str.split("```", 1)[1]
                    json_str = json_str.split("```", 1)[0]

                json_str = json_str.strip()

                # Look for JSON block in response
                start_idx = json_str.find('{')
                end_idx = json_str.rfind('}') + 1

                if start_idx != -1 and end_idx > start_idx:
                    json_str = json_str[start_idx:end_idx]
                    extracted_data = json.loads(json_str)
                    logger.info("Successfully parsed JSON from Gemini response")
                else:
                    # If no JSON found, structure the response
                    logger.warning("No JSON structure found in Gemini response")
                    extracted_data = {
                        "extraction_method": "gemini-text-analysis",
                        "raw_content": extracted_text[:5000],  # Truncate for storage
                        "structured_data": self._structure_text_content(extracted_text)
                    }

            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON from Gemini response: {e}")
                logger.error(f"Response size: {response_size} chars")
                logger.error(f"Response preview (first 500 chars): {extracted_text[:500]}")
                logger.error(f"Response preview (last 500 chars): {extracted_text[-500:]}")
                extracted_data = {
                    "extraction_method": "gemini-text-fallback",
                    "raw_content": extracted_text[:5000],
                    "error": str(e)
                }

            # Add metadata and quality warnings
            extracted_data["extraction_metadata"] = {
                "model": settings.GEMINI_MODEL_EXTRACTION,
                "extraction_method": "ai_based",
                "filename": filename,
                "mime_type": mime_type,
                "extraction_timestamp": "auto-generated",
                "content_length": len(document_content),
                "temperature": 0.1,
                "json_mode": True
            }

            # Add extraction quality warnings for GxP compliance
            extracted_data["extraction_quality_warnings"] = [
                "⚠️ AI-based extraction using Large Language Model (LLM)",
                "LLM extraction is NOT guaranteed to be verbatim - it reconstructs content based on understanding",
                "Manual verification recommended: compare extracted text with original document",
                "For GxP compliance: perform spot-checks on critical specifications",
                "Extraction accuracy estimated at 95-98% with current configuration",
                "Consider using deterministic parsers (PyPDF2, python-docx) for 100% verbatim extraction"
            ]

            extracted_data["manual_review_recommended"] = True

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
        Step 2: Generate traceability matrix entry using configured AI provider (Gemini or Ollama)
        
        Args:
            requirement: User requirement text
            requirement_category: Category of the requirement
            extracted_specs: Structured specifications from Step 1
            project_context: Additional project context
            
        Returns:
            Generated matrix entry data
        """
        # Dispatch to appropriate provider based on configuration
        if settings.MATRIX_GENERATION_PROVIDER == "gemini":
            logger.info(f"Using Gemini ({settings.GEMINI_MODEL_MATRIX}) for matrix generation")
            return await self._generate_matrix_with_gemini(
                requirement, requirement_category, extracted_specs, project_context
            )
        else:  # ollama
            logger.info(f"Using Ollama ({settings.OLLAMA_MODEL}) for matrix generation")
            return await self._generate_matrix_with_ollama(
                requirement, requirement_category, extracted_specs, project_context
            )

    # ==================== OLLAMA-BASED MATRIX GENERATION ====================
    async def _generate_matrix_with_ollama(
        self,
        requirement: str,
        requirement_category: str,
        extracted_specs: Dict[str, Any],
        project_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Generate matrix entry using local Ollama/Llama model (FREE but less accurate with 3B)"""
        try:
            # Prepare generation prompt for traceability matrix with raw document
            matrix_prompt = f"""You are an expert pharmaceutical CSV consultant creating a traceability matrix entry for GxP validation.

RESPOND ONLY WITH VALID JSON. Do not include any explanatory text before or after the JSON object.

USER REQUIREMENT TO VALIDATE:
Category: {requirement_category}
Requirement: {requirement}

SUPPLIER SPECIFICATION DOCUMENT (complete raw extraction):
{json.dumps(extracted_specs, indent=2)}

PROJECT CONTEXT:
{json.dumps(project_context or {}, indent=2)}

INSTRUCTIONS:
1. Search through ALL sections of the supplier document to find content addressing this requirement
2. Cite EXACT section numbers and use EXACT quotes from the supplier document
3. If the requirement is addressed, reference the specific section(s) and quote the relevant text
4. If not addressed, set spec_reference to "Not Found" and compliance_status to "Requires Clarification"

CRITICAL RULES:
- Base assessment ONLY on explicit statements in the supplier document
- Use exact section numbers (e.g., "Section 3.2.1 Audit Trail Features")
- Quote supplier text verbatim in supplier_response field
- If information is missing or unclear, mark compliance_status as "Requires Clarification"
- Never make assumptions - only cite what is explicitly documented
- compliance_status must be one of: "Compliant", "Non-Compliant", "Partial", "Requires Clarification"
- confidence_score must be a number between 0 and 100

This matrix will be reviewed by QA and submitted to regulatory authorities.
Accuracy and traceability to source documentation is critical for audit defense.

OUTPUT ONLY THE JSON OBJECT - NO OTHER TEXT."""

            # Log prompt diagnostics to identify if prompt is too large
            prompt_length = len(matrix_prompt)
            logger.warning(f"Prompt length: {prompt_length} characters ({prompt_length // 1024}KB)")
            logger.warning(f"Document count in extracted_specs: {len(extracted_specs.get('documents', []))}")

            # Log document structure details
            if extracted_specs.get('documents'):
                first_doc = extracted_specs['documents'][0]
                sections_count = len(first_doc.get('sections', []))
                logger.warning(f"First document has {sections_count} sections")
                if sections_count > 0:
                    first_section = first_doc['sections'][0]
                    content_length = len(str(first_section.get('content', '')))
                    logger.warning(f"First section content length: {content_length} characters")

            # Call Ollama with local Llama model using structured JSON output
            response = await self.ollama_client.generate(
                model=settings.OLLAMA_MODEL,
                prompt=matrix_prompt,
                format=self.MATRIX_ENTRY_SCHEMA,  # Force JSON schema compliance
                options={
                    'temperature': 0.0,  # Deterministic output for consistency
                    'top_p': 0.9,
                    'num_predict': 4096,  # Increased limit for longer responses
                    'num_ctx': 32768  # Set context window to 32K tokens (~80KB text) - llama3.2 supports up to 128K
                }
            )

            # Log response metadata
            logger.warning(f"Ollama response metadata - model: {response.get('model', 'unknown')}, "
                          f"total_duration: {response.get('total_duration', 0) / 1e9:.2f}s, "
                          f"prompt_eval_count: {response.get('prompt_eval_count', 0)}, "
                          f"eval_count: {response.get('eval_count', 0)}")

            # Parse response (with format parameter, response is pure JSON)
            response_text = response['response']
            logger.warning(f"Raw Llama response for requirement '{requirement[:50]}...': {response_text[:1000]}")

            try:
                # Direct JSON parsing (format parameter ensures valid JSON)
                matrix_entry = json.loads(response_text)

                # Validate that Llama provided meaningful content
                spec_ref = matrix_entry.get("spec_reference", "")
                supplier_resp = matrix_entry.get("supplier_response", "")

                if not spec_ref or not supplier_resp or spec_ref == "" or supplier_resp == "":
                    logger.warning(f"Llama returned empty/missing fields for requirement '{requirement[:50]}...'")
                    logger.warning(f"spec_reference: '{spec_ref}', supplier_response: '{supplier_resp}'")
                    logger.warning(f"Full Llama response: {response_text}")

                    # Add warning to comments if fields are empty
                    if "comments" not in matrix_entry or not matrix_entry["comments"]:
                        matrix_entry["comments"] = "Warning: AI returned empty fields - requires manual completion"
                    else:
                        matrix_entry["comments"] += " | Warning: Some fields were empty in AI response"

            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON from Ollama response: {e}")
                logger.error(f"Response text that failed to parse: {response_text}")
                matrix_entry = {
                    "spec_reference": "AI generation failed - JSON parsing error",
                    "supplier_response": response_text[:1000] if response_text else "No response from AI",
                    "justification": "AI-generated response could not be parsed",
                    "compliance_status": "Requires Clarification",
                    "confidence_score": 0,
                    "comments": f"JSON parsing error: {str(e)}"
                }

            # Add generation metadata
            matrix_entry["generation_metadata"] = {
                "model": settings.OLLAMA_MODEL,
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

    # ==================== GEMINI-BASED MATRIX GENERATION ====================
    async def _generate_matrix_with_gemini(
        self,
        requirement: str,
        requirement_category: str,
        extracted_specs: Dict[str, Any],
        project_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Generate matrix entry using Google Gemini API (PAID but more accurate)"""
        if not self.gemini_matrix_model:
            raise ValueError("Gemini API not configured")

        try:
            # Prepare generation prompt
            matrix_prompt = f"""You are an expert pharmaceutical CSV consultant creating a traceability matrix entry for GxP validation.

USER REQUIREMENT TO VALIDATE:
Category: {requirement_category}
Requirement: {requirement}

SUPPLIER SPECIFICATION DOCUMENT (complete raw extraction):
{json.dumps(extracted_specs, indent=2)}

PROJECT CONTEXT:
{json.dumps(project_context or {}, indent=2)}

INSTRUCTIONS:
1. Search through ALL sections of the supplier document to find content addressing this requirement
2. Cite EXACT section numbers and use EXACT quotes from the supplier document
3. If the requirement is addressed, reference the specific section(s) and quote the relevant text
4. If not addressed, set spec_reference to "Not Found" and compliance_status to "Requires Clarification"

Output a JSON object with this structure:
{{
  "spec_reference": "Section X.X (exact section number and heading from document)",
  "supplier_response": "Direct quote from supplier document",
  "justification": "Technical justification explaining why this satisfies the requirement",
  "compliance_status": "Compliant|Non-Compliant|Partial|Requires Clarification",
  "test_reference": "Suggested test approach to verify compliance",
  "risk_assessment": "Low|Medium|High - explanation of risk",
  "comments": "Additional validation notes or concerns",
  "confidence_score": 0-100,
  "verification_needed": "Specific items to verify during IQ/OQ/PQ testing"
}}

CRITICAL RULES:
- Base assessment ONLY on explicit statements in the supplier document
- Use exact section numbers and quote supplier text verbatim
- Never make assumptions - only cite what is explicitly documented
- compliance_status must be one of: "Compliant", "Non-Compliant", "Partial", "Requires Clarification"
- confidence_score must be a number between 0 and 100

This matrix will be reviewed by QA and submitted to regulatory authorities.
Accuracy and traceability to source documentation is critical for audit defense."""

            # Log diagnostics
            prompt_length = len(matrix_prompt)
            logger.info(f"Gemini matrix prompt length: {prompt_length} characters ({prompt_length // 1024}KB)")
            logger.info(f"Document count: {len(extracted_specs.get('documents', []))}")

            # Call Gemini API
            response = await asyncio.to_thread(
                self.gemini_matrix_model.generate_content,
                matrix_prompt
            )

            # Parse JSON response
            response_text = response.text
            logger.info(f"Gemini matrix response preview: {response_text[:200]}")

            try:
                # Gemini JSON mode ensures valid JSON
                matrix_entry = json.loads(response_text)

                # Validate fields
                spec_ref = matrix_entry.get("spec_reference", "")
                supplier_resp = matrix_entry.get("supplier_response", "")

                if not spec_ref or not supplier_resp:
                    logger.warning(f"Gemini returned empty fields for requirement '{requirement[:50]}...'")
                    if "comments" not in matrix_entry or not matrix_entry["comments"]:
                        matrix_entry["comments"] = "Warning: AI returned empty fields - requires manual completion"

            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON from Gemini response: {e}")
                matrix_entry = {
                    "spec_reference": "AI generation failed - JSON parsing error",
                    "supplier_response": response_text[:1000] if response_text else "No response from AI",
                    "justification": "AI-generated response could not be parsed",
                    "compliance_status": "Requires Clarification",
                    "confidence_score": 0,
                    "comments": f"JSON parsing error: {str(e)}"
                }

            # Add generation metadata
            matrix_entry["generation_metadata"] = {
                "model": settings.GEMINI_MODEL_MATRIX,
                "provider": "gemini",
                "requirement": requirement,
                "requirement_category": requirement_category,
                "generation_timestamp": "auto-generated",
                "prompt_version": "v1.0"
            }

            logger.info(f"Successfully generated matrix entry for requirement: {requirement[:50]}...")
            return matrix_entry

        except Exception as e:
            logger.error(f"Gemini matrix generation failed for requirement '{requirement}': {e}")
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
        Returns raw document structure format for consistency
        """
        return {
            "document_info": {
                "title": "Extraction Failed - Manual Review Required",
                "extraction_method": "text-fallback"
            },
            "sections": [
                {
                    "section_number": "0",
                    "heading": "Raw Extracted Text (Requires Manual Processing)",
                    "content": text,
                    "page_number": "unknown",
                    "subsections": [],
                    "tables": [],
                    "lists": []
                }
            ],
            "extraction_warnings": [
                "JSON parsing failed - Gemini did not return properly structured data",
                "Content preserved as single section for manual review",
                "Recommend re-uploading document or checking document quality"
            ],
            "requires_manual_review": True
        }

    async def health_check(self) -> Dict[str, bool]:
        """Check health of AI services"""
        status = {
            "gemini_available": bool(self.gemini_extraction_model),
            "ollama_available": False
        }

        try:
            # Test Ollama connection
            models = await self.ollama_client.list()
            status["ollama_available"] = len(models.get('models', [])) > 0
        except Exception as e:
            logger.warning(f"Ollama health check failed: {e}")

        return status
