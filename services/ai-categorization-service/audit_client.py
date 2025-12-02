"""
Audit Log Client
Sends audit events to the audit-log-service using aiohttp
"""
import aiohttp
import logging
import os
from typing import Dict, Optional, Any

logger = logging.getLogger(__name__)

class AuditLogClient:
    def __init__(self):
        self.audit_service_url = os.getenv(
            "AUDIT_SERVICE_URL",
            "http://localhost:8082"
        )
        self.enabled = os.getenv("AUDIT_ENABLED", "true").lower() == "true"
        self.service_name = os.getenv("SERVICE_NAME", "ai-service")
        
    async def log_event(
        self,
        action: str,
        actor: Dict[str, str],
        status: str,
        log_type: str,
        target: Optional[Dict[str, str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        operation_id: Optional[str] = None
    ):
        """Send audit log event"""
        if not self.enabled:
            return
            
        payload = {
            "service": self.service_name,
            "action": action,
            "actor": actor,
            "status": status,
            "log_type": log_type
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
                    timeout=aiohttp.ClientTimeout(total=5)
                ) as response:
                    if response.status == 201:
                        logger.debug(f"Audit log sent: {action}")
                    else:
                        logger.warning(f"Audit log failed: {response.status}")
        except Exception as e:
            logger.error(f"Failed to send audit log: {e}")

# Singleton instance
_audit_client = None

def get_audit_client() -> AuditLogClient:
    """Get singleton audit client instance"""
    global _audit_client
    if _audit_client is None:
        _audit_client = AuditLogClient()
    return _audit_client
