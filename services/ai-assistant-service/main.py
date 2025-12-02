"""
AI Assistant Service - Chatbot for RiskRadar
Provides conversational AI assistance for users
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import logging
from contextlib import asynccontextmanager
import os
from datetime import datetime

from kafka_client import get_kafka_client
from audit_client import get_audit_client

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Pydantic models
class Message(BaseModel):
    role: str = Field(..., description="Message role: 'user' or 'assistant'")
    content: str = Field(..., description="Message content")
    timestamp: Optional[str] = None

class ChatRequest(BaseModel):
    user_id: str = Field(..., description="User ID")
    message: str = Field(..., description="User message")
    conversation_id: Optional[str] = None
    context: Optional[Dict[str, Any]] = None

class ChatResponse(BaseModel):
    conversation_id: str
    message: str
    suggestions: Optional[List[str]] = None
    metadata: Optional[Dict[str, Any]] = None

class HealthResponse(BaseModel):
    status: str
    service: str
    timestamp: str
    kafka_enabled: bool

# Lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown"""
    logger.info("🚀 Starting AI Assistant Service...")
    
    # Initialize Kafka
    kafka_client = get_kafka_client()
    try:
        await kafka_client.start_producer()
        logger.info("Kafka producer initialized")
    except Exception as e:
        logger.warning(f"Kafka producer failed to initialize: {e}")
    
    # Log startup
    audit_client = get_audit_client()
    await audit_client.log_event(
        action="service_startup",
        actor={"id": "system", "type": "system"},
        status="success",
        log_type="SYSTEM",
        metadata={"service_version": "1.0.0"}
    )
    
    logger.info("✅ AI Assistant Service started successfully")
    
    yield
    
    # Cleanup
    logger.info("Shutting down AI Assistant Service...")
    await kafka_client.stop_producer()
    await audit_client.log_event(
        action="service_shutdown",
        actor={"id": "system", "type": "system"},
        status="success",
        log_type="SYSTEM"
    )
    logger.info("AI Assistant Service stopped")

# Initialize FastAPI app
app = FastAPI(
    title="AI Assistant Service",
    description="Chatbot and conversational AI for RiskRadar",
    version="1.0.0",
    lifespan=lifespan
)

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    kafka_client = get_kafka_client()
    return HealthResponse(
        status="healthy",
        service="ai-assistant-service",
        timestamp=datetime.utcnow().isoformat() + "Z",
        kafka_enabled=kafka_client.enabled and kafka_client.producer is not None
    )

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Process chat message and return AI response
    """
    audit_client = get_audit_client()
    kafka_client = get_kafka_client()
    
    try:
        # Log the request
        await audit_client.log_event(
            action="chat_request",
            actor={"id": request.user_id, "type": "user"},
            status="success",
            log_type="ACTION",
            metadata={
                "conversation_id": request.conversation_id,
                "message_length": len(request.message)
            }
        )
        
        # Generate conversation ID if not provided
        conversation_id = request.conversation_id or f"conv_{request.user_id}_{datetime.utcnow().timestamp()}"
        
        # TODO: Implement actual AI chatbot logic
        # For now, return a simple response
        response_message = f"Hello! I'm your RiskRadar assistant. You said: {request.message}"
        suggestions = [
            "Zgłoś problem",
            "Sprawdź status zgłoszenia",
            "Pomoc"
        ]
        
        # Publish to Kafka for further processing
        await kafka_client.publish(
            topic="ai_assistant_events",
            message={
                "event_type": "chat_interaction",
                "user_id": request.user_id,
                "conversation_id": conversation_id,
                "user_message": request.message,
                "assistant_response": response_message,
                "timestamp": datetime.utcnow().isoformat()
            },
            key=request.user_id
        )
        
        # Publish notification event if needed
        await kafka_client.publish(
            topic="notification_events",
            message={
                "type": "chat_response",
                "user_id": request.user_id,
                "conversation_id": conversation_id,
                "timestamp": datetime.utcnow().isoformat()
            },
            key=request.user_id
        )
        
        return ChatResponse(
            conversation_id=conversation_id,
            message=response_message,
            suggestions=suggestions,
            metadata={"processed_at": datetime.utcnow().isoformat()}
        )
        
    except Exception as e:
        logger.error(f"Chat processing error: {e}")
        await audit_client.log_event(
            action="chat_request",
            actor={"id": request.user_id, "type": "user"},
            status="error",
            log_type="ERROR",
            metadata={"error": str(e)}
        )
        raise HTTPException(status_code=500, detail="Chat processing failed")

@app.get("/conversations/{conversation_id}")
async def get_conversation(conversation_id: str):
    """Get conversation history"""
    # TODO: Implement conversation retrieval
    return {
        "conversation_id": conversation_id,
        "messages": [],
        "metadata": {}
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
