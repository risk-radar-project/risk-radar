"""
Audit Log Client for AI Verification-Duplication Service

Provides async HTTP client to send audit events to the centralized
audit-log-service for compliance and monitoring purposes.
"""

import logging
import os
from typing import Any, Dict, Optional

import aiohttp

logger = logging.getLogger(__name__)


class AuditLogClient:
    """HTTP client for sending audit events to audit-log-service."""

    def __init__(self):
        self.audit_service_url = os.getenv("AUDIT_SERVICE_URL", "http://localhost:8082")
        self.enabled = os.getenv("AUDIT_ENABLED", "true").lower() == "true"
        self.service_name = "ai-verification-duplication-service"

    async def log_event(
        self,
        action: str,
        actor: Dict[str, str],
        status: str,
        log_type: str,
        target: Optional[Dict[str, str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        operation_id: Optional[str] = None,
    ) -> None:
        """
        Send audit log event to audit-log-service.

        Args:
            action: Event action (e.g., "verify_report", "check_duplicate")
            actor: Who performed action {"id": "...", "type": "user|system"}
            status: Result status ("success", "error")
            log_type: Category ("ACTION", "ERROR", "SYSTEM")
            target: Optional target resource {"id": "...", "type": "report"}
            metadata: Optional additional context data
            operation_id: Optional correlation ID for tracing
        """
        if not self.enabled:
            return

        payload = {
            "service": self.service_name,
            "action": action,
            "actor": actor,
            "status": status,
            "log_type": log_type,
        }

        if target:
            payload["target"] = target
        if metadata:
            payload["metadata"] = metadata
        if operation_id:
            payload["operation_id"] = operation_id

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.audit_service_url}/logs",
                    json=payload,
                    timeout=aiohttp.ClientTimeout(total=5),
                ) as response:
                    if response.status == 201:
                        logger.debug(f"Audit log sent: {action}")
                    else:
                        logger.warning(f"Audit log failed: {response.status}")
        except Exception as e:
            logger.error(f"Failed to send audit log: {e}")


# =============================================================================
# Singleton Instance
# =============================================================================

_audit_client: Optional[AuditLogClient] = None


def get_audit_client() -> AuditLogClient:
    """Get singleton audit client instance (lazy initialization)."""
    global _audit_client
    if _audit_client is None:
        _audit_client = AuditLogClient()
    return _audit_client
