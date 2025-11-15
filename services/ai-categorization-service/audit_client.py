"""
Audit Log Service Client for AI Categorization Service
Handles communication with the Audit Log Service
"""
import httpx
import logging
from typing import Optional, Dict, Any
from datetime import datetime
import os

logger = logging.getLogger(__name__)

class AuditLogClient:
    """Client for sending audit logs to the Audit Log Service"""
    
    def __init__(self, base_url: Optional[str] = None, timeout: float = 5.0):
        """
        Initialize the audit log client
        
        Args:
            base_url: Base URL of the audit log service (e.g., http://localhost:8082)
            timeout: Request timeout in seconds
        """
        self.base_url = base_url or os.getenv("AUDIT_LOG_SERVICE_URL", "http://localhost:8082")
        self.timeout = timeout
        self.service_name = "ai-categorization-service"
        self.enabled = os.getenv("AUDIT_LOG_ENABLED", "true").lower() == "true"
        
        if not self.enabled:
            logger.info("Audit logging is disabled")
    
    async def log_event(
        self,
        action: str,
        actor: Dict[str, Any],
        status: str = "success",
        log_type: str = "ACTION",
        target: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        operation_id: Optional[str] = None
    ) -> bool:
        """
        Send an audit log to the service
        
        Args:
            action: Action performed (e.g., "categorize", "batch_categorize")
            actor: Actor information (user, system, etc.)
            status: Operation status ('success', 'failure', 'warning', 'error')
            log_type: Log type ('ACTION', 'SECURITY', 'SYSTEM', 'ERROR', 'INFO')
            target: Target resource (optional)
            metadata: Additional context data (optional)
            operation_id: Idempotency key (optional)
        
        Returns:
            bool: True if log was sent successfully, False otherwise
        """
        if not self.enabled:
            return True
        
        try:
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
            
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/logs",
                    json=payload
                )
                
                # 201 = created, 204 = idempotent duplicate
                if response.status_code in [201, 204]:
                    if response.status_code == 204:
                        logger.debug(f"Audit log skipped (duplicate operation_id): {operation_id}")
                    return True
                else:
                    logger.warning(
                        f"Audit log failed: {response.status_code} - {response.text}"
                    )
                    return False
                    
        except Exception as e:
            logger.error(f"Failed to send audit log: {str(e)}")
            return False
    
    async def log_prediction(
        self,
        title: str,
        predicted_category: str,
        confidence: Optional[float],
        processing_time_ms: float,
        actor_id: str = "system",
        actor_type: str = "system",
        success: bool = True
    ) -> bool:
        """Log a categorization prediction"""
        return await self.log_event(
            action="categorize_incident",
            actor={
                "id": actor_id,
                "type": actor_type
            },
            status="success" if success else "failure",
            log_type="ACTION",
            target={
                "id": "incident",
                "type": "incident_title"
            },
            metadata={
                "title": title,
                "predicted_category": predicted_category,
                "confidence": confidence,
                "processing_time_ms": processing_time_ms,
                "timestamp": datetime.utcnow().isoformat()
            }
        )
    
    async def log_batch_prediction(
        self,
        total_items: int,
        successful: int,
        failed: int,
        total_time_ms: float,
        actor_id: str = "system",
        actor_type: str = "system"
    ) -> bool:
        """Log a batch categorization operation"""
        return await self.log_event(
            action="batch_categorize",
            actor={
                "id": actor_id,
                "type": actor_type
            },
            status="success" if failed == 0 else "warning",
            log_type="ACTION",
            metadata={
                "total_items": total_items,
                "successful": successful,
                "failed": failed,
                "total_time_ms": total_time_ms,
                "timestamp": datetime.utcnow().isoformat()
            }
        )
    
    async def log_error(
        self,
        action: str,
        error_message: str,
        error_details: Optional[Dict[str, Any]] = None,
        actor_id: str = "system"
    ) -> bool:
        """Log an error event"""
        metadata = {
            "error_message": error_message,
            "timestamp": datetime.utcnow().isoformat()
        }
        if error_details:
            metadata.update(error_details)
        
        return await self.log_event(
            action=action,
            actor={
                "id": actor_id,
                "type": "system"
            },
            status="error",
            log_type="ERROR",
            metadata=metadata
        )
    
    async def log_model_load(
        self,
        model_file: str,
        model_type: str,
        success: bool,
        load_time_ms: Optional[float] = None,
        error: Optional[str] = None
    ) -> bool:
        """Log model loading event"""
        metadata = {
            "model_file": model_file,
            "model_type": model_type,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        if load_time_ms:
            metadata["load_time_ms"] = load_time_ms
        if error:
            metadata["error"] = error
        
        return await self.log_event(
            action="load_model",
            actor={
                "id": "system",
                "type": "system"
            },
            status="success" if success else "failure",
            log_type="SYSTEM",
            metadata=metadata
        )

# Global audit client instance
_audit_client: Optional[AuditLogClient] = None

def get_audit_client() -> AuditLogClient:
    """Get or create the global audit client instance"""
    global _audit_client
    if _audit_client is None:
        _audit_client = AuditLogClient()
    return _audit_client