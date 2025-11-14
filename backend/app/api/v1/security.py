"""
Security endpoints for monitoring and reporting
Handles CSP violation reports and other security-related endpoints
"""

import logging
from typing import Any, Dict
from datetime import datetime

from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address

router = APIRouter()
logger = logging.getLogger(__name__)

# Rate limiter instance
limiter = Limiter(key_func=get_remote_address)


@router.post("/csp-report", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("100/hour")  # Limit CSP reports to prevent abuse
async def csp_violation_report(request: Request) -> Any:
    """
    Receive and log Content Security Policy (CSP) violation reports from browsers.

    CSP violations indicate:
    - Potential XSS attack attempts
    - Misconfigured CSP policies
    - Inline scripts/styles that need nonces/hashes

    Reports are sent by browsers when CSP-Report-Only or CSP headers are configured.

    SECURITY: Rate limited to 100 reports per hour per IP to prevent log flooding.
    """
    try:
        # Parse CSP report from request body
        report = await request.json()

        # Extract violation details
        csp_report = report.get("csp-report", {})

        # Log detailed violation information
        logger.warning(
            f"CSP Violation Report",
            extra={
                "timestamp": datetime.utcnow().isoformat(),
                "client_ip": request.client.host if request.client else "unknown",
                "user_agent": request.headers.get("user-agent", "unknown"),
                "document_uri": csp_report.get("document-uri", ""),
                "violated_directive": csp_report.get("violated-directive", ""),
                "blocked_uri": csp_report.get("blocked-uri", ""),
                "original_policy": csp_report.get("original-policy", ""),
                "source_file": csp_report.get("source-file", ""),
                "line_number": csp_report.get("line-number", ""),
                "column_number": csp_report.get("column-number", ""),
            }
        )

        # Optional: Store in database for analysis
        # This can be useful for tracking patterns over time
        # await store_csp_violation(db, csp_report, request.client.host)

        # Return 204 No Content (standard for CSP report endpoint)
        return None

    except Exception as e:
        # Log error but don't expose details to client
        logger.error(f"Error processing CSP report: {e}", exc_info=True)

        # Still return 204 to avoid alerting attackers
        return None


@router.get("/health")
async def security_health_check() -> Dict[str, str]:
    """
    Health check endpoint for security monitoring service.
    Can be used to verify security endpoints are operational.
    """
    return {
        "status": "healthy",
        "service": "security-monitoring",
        "timestamp": datetime.utcnow().isoformat()
    }
