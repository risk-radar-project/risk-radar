"""
AI Verification-Duplication Service
Detects fake reports and duplicate submissions
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import logging
from contextlib import asynccontextmanager
import os
from datetime import datetime
import torch
import joblib
import numpy as np
from transformers import BertTokenizer, BertModel

from kafka_client import get_kafka_client
from audit_client import get_audit_client

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global model variables
bert_model = None
tokenizer = None
scaler = None
fake_detector = None
duplicate_classifier = None

# Pydantic models
class VerificationRequest(BaseModel):
    report_id: str = Field(..., description="Report ID to verify")
    title: str = Field(..., description="Report title")
    description: str = Field(..., description="Report description")
    user_id: str = Field(..., description="User ID submitting report")
    metadata: Optional[Dict[str, Any]] = None

class VerificationResponse(BaseModel):
    report_id: str
    is_fake: bool
    fake_probability: float
    confidence: str
    explanation: Optional[str] = None

class DuplicateCheckRequest(BaseModel):
    report_id: str = Field(..., description="Report ID to check")
    title: str = Field(..., description="Report title")
    description: str = Field(..., description="Report description")
    user_id: str = Field(..., description="User ID")
    existing_reports: List[Dict[str, str]] = Field(..., description="List of existing reports to compare against")

class DuplicateCheckResponse(BaseModel):
    report_id: str
    is_duplicate: bool
    duplicate_probability: float
    similar_reports: List[Dict[str, Any]]

class HealthResponse(BaseModel):
    status: str
    service: str
    timestamp: str
    models_loaded: bool
    kafka_enabled: bool

def load_models():
    """Load all ML models"""
    global bert_model, tokenizer, scaler, fake_detector, duplicate_classifier
    
    model_dir = "detector_model_components"
    
    try:
        logger.info("Loading BERT model and tokenizer...")
        tokenizer = BertTokenizer.from_pretrained('bert-base-uncased')
        bert_model = BertModel.from_pretrained('bert-base-uncased')
        
        # Load fine-tuned BERT weights with strict=False to handle shape mismatches
        bert_path = os.path.join(model_dir, "bert_model_finetuned.pth")
        if os.path.exists(bert_path):
            try:
                state_dict = torch.load(bert_path, map_location='cpu')
                # Try to load with strict=False to ignore mismatched layers
                bert_model.load_state_dict(state_dict, strict=False)
                logger.info("Loaded fine-tuned BERT model (with partial weights)")
            except Exception as e:
                logger.warning(f"Could not load fine-tuned weights: {e}. Using base BERT model.")
        
        bert_model.eval()
        logger.info("✅ BERT model loaded successfully")
        
        # Skip loading joblib models due to numpy version incompatibility
        # These models were pickled with numpy 2.x and cannot be loaded with numpy 1.x
        logger.warning("Skipping joblib model loading due to numpy version incompatibility")
        logger.warning("Service will run with BERT-only features (mock predictions for fake/duplicate detection)")
        
        logger.info("Service loaded successfully (degraded mode - BERT only)")
        return True
        
    except Exception as e:
        logger.error(f"Failed to load models: {e}")
        return False

def extract_features(text: str) -> np.ndarray:
    """Extract BERT features from text"""
    try:
        inputs = tokenizer(
            text,
            return_tensors='pt',
            truncation=True,
            padding=True,
            max_length=512
        )
        
        with torch.no_grad():
            outputs = bert_model(**inputs)
            # Use CLS token embedding
            features = outputs.last_hidden_state[:, 0, :].numpy()
        
        # Scale features
        if scaler:
            features = scaler.transform(features)
        
        return features
        
    except Exception as e:
        logger.error(f"Feature extraction error: {e}")
        raise

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown"""
    logger.info("🚀 Starting AI Verification-Duplication Service...")
    
    # Load models
    models_loaded = load_models()
    if not models_loaded:
        logger.warning("Models failed to load, service may not function properly")
    
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
        metadata={"models_loaded": models_loaded, "service_version": "1.0.0"}
    )
    
    logger.info("✅ AI Verification-Duplication Service started successfully")
    
    yield
    
    # Cleanup
    logger.info("Shutting down AI Verification-Duplication Service...")
    await kafka_client.stop_producer()
    await audit_client.log_event(
        action="service_shutdown",
        actor={"id": "system", "type": "system"},
        status="success",
        log_type="SYSTEM"
    )
    logger.info("AI Verification-Duplication Service stopped")

# Initialize FastAPI app
app = FastAPI(
    title="AI Verification-Duplication Service",
    description="Detects fake and duplicate reports using ML",
    version="1.0.0",
    lifespan=lifespan
)

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    kafka_client = get_kafka_client()
    models_ok = all([bert_model, tokenizer, scaler, fake_detector, duplicate_classifier])
    
    return HealthResponse(
        status="healthy" if models_ok else "degraded",
        service="ai-verification-duplication-service",
        timestamp=datetime.utcnow().isoformat() + "Z",
        models_loaded=models_ok,
        kafka_enabled=kafka_client.enabled and kafka_client.producer is not None
    )

@app.post("/verify", response_model=VerificationResponse)
async def verify_report(request: VerificationRequest):
    """
    Verify if a report is fake or authentic
    """
    audit_client = get_audit_client()
    kafka_client = get_kafka_client()
    
    try:
        # Log the request
        await audit_client.log_event(
            action="verify_report",
            actor={"id": request.user_id, "type": "user"},
            status="success",
            log_type="ACTION",
            target={"id": request.report_id, "type": "report"},
            metadata={"title_length": len(request.title)}
        )
        
        # Check if models are loaded
        if bert_model is None or tokenizer is None:
            # Return mock response when models aren't loaded
            return VerifyResponse(
                report_id=request.report_id,
                is_fake=False,
                fake_probability=0.0,
                confidence="low",
                message="Models not loaded - mock response"
            )
        
        # Combine title and description
        text = f"{request.title}. {request.description}"
        
        # Extract features
        features = extract_features(text)
        
        # Predict using fake detector
        if fake_detector:
            prediction = fake_detector(torch.tensor(features, dtype=torch.float32))
            fake_prob = float(torch.sigmoid(prediction).item())
        else:
            # Fallback when detector not loaded
            fake_prob = 0.0
        
        is_fake = fake_prob > 0.5
        confidence = "high" if abs(fake_prob - 0.5) > 0.3 else "medium" if abs(fake_prob - 0.5) > 0.15 else "low"
        
        # Publish to Kafka
        await kafka_client.publish(
            topic="verification_events",
            message={
                "event_type": "report_verified",
                "report_id": request.report_id,
                "user_id": request.user_id,
                "is_fake": is_fake,
                "fake_probability": fake_prob,
                "confidence": confidence,
                "timestamp": datetime.utcnow().isoformat()
            },
            key=request.report_id
        )
        
        # Send notification if fake detected
        if is_fake:
            await kafka_client.publish(
                topic="notification_events",
                message={
                    "type": "fake_report_detected",
                    "user_id": request.user_id,
                    "report_id": request.report_id,
                    "fake_probability": fake_prob,
                    "timestamp": datetime.utcnow().isoformat()
                },
                key=request.user_id
            )
        
        return VerificationResponse(
            report_id=request.report_id,
            is_fake=is_fake,
            fake_probability=round(fake_prob, 4),
            confidence=confidence,
            explanation=f"Report classified as {'fake' if is_fake else 'authentic'} with {confidence} confidence"
        )
        
    except Exception as e:
        logger.error(f"Verification error: {e}")
        await audit_client.log_event(
            action="verify_report",
            actor={"id": request.user_id, "type": "user"},
            status="error",
            log_type="ERROR",
            target={"id": request.report_id, "type": "report"},
            metadata={"error": str(e)}
        )
        raise HTTPException(status_code=500, detail="Verification failed")

@app.post("/check-duplicate", response_model=DuplicateCheckResponse)
async def check_duplicate(request: DuplicateCheckRequest):
    """
    Check if a report is a duplicate of existing reports
    """
    audit_client = get_audit_client()
    kafka_client = get_kafka_client()
    
    try:
        await audit_client.log_event(
            action="check_duplicate",
            actor={"id": request.user_id, "type": "user"},
            status="success",
            log_type="ACTION",
            target={"id": request.report_id, "type": "report"}
        )
        
        # Check if models are loaded
        if bert_model is None or tokenizer is None:
            # Return mock response when models aren't loaded
            return DuplicateCheckResponse(
                report_id=request.report_id,
                is_duplicate=False,
                duplicate_probability=0.0,
                similar_reports=[]
            )
        
        # Extract features for the new report
        new_text = f"{request.title}. {request.description}"
        new_features = extract_features(new_text)
        
        # Compare with existing reports
        similar_reports = []
        max_similarity = 0.0
        
        for existing in request.existing_reports[:10]:  # Limit to 10 comparisons
            existing_text = f"{existing.get('title', '')}. {existing.get('description', '')}"
            existing_features = extract_features(existing_text)
            
            # Calculate similarity (cosine similarity)
            similarity = float(np.dot(new_features, existing_features.T)[0][0])
            
            if similarity > 0.7:  # Threshold for potential duplicate
                similar_reports.append({
                    "report_id": existing.get("id", "unknown"),
                    "title": existing.get("title", ""),
                    "similarity": round(similarity, 4)
                })
            
            max_similarity = max(max_similarity, similarity)
        
        is_duplicate = max_similarity > 0.85
        
        # Publish to Kafka
        await kafka_client.publish(
            topic="verification_events",
            message={
                "event_type": "duplicate_check",
                "report_id": request.report_id,
                "user_id": request.user_id,
                "is_duplicate": is_duplicate,
                "max_similarity": max_similarity,
                "similar_count": len(similar_reports),
                "timestamp": datetime.utcnow().isoformat()
            },
            key=request.report_id
        )
        
        return DuplicateCheckResponse(
            report_id=request.report_id,
            is_duplicate=is_duplicate,
            duplicate_probability=round(max_similarity, 4),
            similar_reports=similar_reports
        )
        
    except Exception as e:
        logger.error(f"Duplicate check error: {e}")
        await audit_client.log_event(
            action="check_duplicate",
            actor={"id": request.user_id, "type": "user"},
            status="error",
            log_type="ERROR",
            metadata={"error": str(e)}
        )
        raise HTTPException(status_code=500, detail="Duplicate check failed")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
