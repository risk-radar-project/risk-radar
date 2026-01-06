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
import uuid
from transformers import RobertaTokenizer, RobertaModel, RobertaConfig

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
    should_reject: bool = False  # Only True when high confidence fake
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

def check_lfs_pointer(file_path: str) -> bool:
    """Check if a file is a Git LFS pointer instead of actual content"""
    try:
        with open(file_path, 'rb') as f:
            header = f.read(50)
            # LFS pointers start with "version https://git-lfs"
            if b'version https://git-lfs' in header:
                return True
    except:
        pass
    return False

def load_models():
    """Load all ML models - ALL models are REQUIRED"""
    global bert_model, tokenizer, scaler, fake_detector, duplicate_classifier
    
    model_dir = "detector_model_components"
    
    logger.info("Loading BERT model and tokenizer...")
    
    # Load fine-tuned BERT weights - REQUIRED
    bert_path = os.path.join(model_dir, "bert_model_finetuned.pth")
    if not os.path.exists(bert_path):
        raise RuntimeError(f"Required model file not found: {bert_path}. Run 'git lfs pull' to download model files.")
    
    # Check if file is LFS pointer
    if check_lfs_pointer(bert_path):
        raise RuntimeError(
            f"Model file {bert_path} is a Git LFS pointer, not actual model data. "
            "Please run: git lfs install && git lfs pull"
        )
    
    try:
        state_dict = torch.load(bert_path, map_location='cpu')
    except Exception as e:
        raise RuntimeError(
            f"Failed to load model {bert_path}: {e}. "
            "The file may be corrupted or a Git LFS pointer. "
            "Please run: git lfs pull"
        )
    
    # Detect model configuration from saved weights
    vocab_size = state_dict['embeddings.word_embeddings.weight'].shape[0]
    max_position = state_dict['embeddings.position_embeddings.weight'].shape[0]
    logger.info(f"Detected model config: vocab_size={vocab_size}, max_position={max_position}")
    
    # Use RoBERTa tokenizer and model since the fine-tuned model has RoBERTa-like config
    from transformers import RobertaTokenizer, RobertaModel, RobertaConfig
    
    # Create custom config matching the saved model
    config = RobertaConfig(
        vocab_size=vocab_size,
        max_position_embeddings=max_position,
        hidden_size=768,
        num_hidden_layers=12,
        num_attention_heads=12,
        intermediate_size=3072
    )
    
    tokenizer = RobertaTokenizer.from_pretrained('roberta-base')
    bert_model = RobertaModel(config)
    bert_model.load_state_dict(state_dict, strict=False)
    bert_model.eval()
    logger.info("✅ BERT/RoBERTa model loaded successfully")
    
    # Load scaler - REQUIRED
    scaler_path = os.path.join(model_dir, "scaler.joblib")
    if not os.path.exists(scaler_path):
        raise RuntimeError(f"Required model file not found: {scaler_path}")
    scaler = joblib.load(scaler_path)
    logger.info("✅ Scaler loaded successfully")
    
    # Load fake detector head - REQUIRED
    fake_detector_path = os.path.join(model_dir, "fake_detector_head.pth")
    if not os.path.exists(fake_detector_path):
        raise RuntimeError(f"Required model file not found: {fake_detector_path}")
    
    # Create classifier head for fake detection (768→256→64→2)
    fake_detector = torch.nn.Sequential(
        torch.nn.Linear(768, 256),
        torch.nn.ReLU(),
        torch.nn.Dropout(0.3),
        torch.nn.Linear(256, 64),
        torch.nn.ReLU(),
        torch.nn.Dropout(0.3),
        torch.nn.Linear(64, 2)
    )
    # Load state dict - weights are saved with "classifier." prefix
    state_dict = torch.load(fake_detector_path, map_location='cpu')
    # Map classifier.X.weight/bias to X.weight/bias
    new_state_dict = {}
    for k, v in state_dict.items():
        new_key = k.replace('classifier.', '')
        new_state_dict[new_key] = v
    fake_detector.load_state_dict(new_state_dict)
    fake_detector.eval()
    logger.info("✅ Fake detector loaded successfully")
    
    # Load duplicate classifier - REQUIRED
    duplicate_path = os.path.join(model_dir, "duplicate_classifier.joblib")
    if not os.path.exists(duplicate_path):
        raise RuntimeError(f"Required model file not found: {duplicate_path}")
    duplicate_classifier = joblib.load(duplicate_path)
    logger.info("✅ Duplicate classifier loaded successfully")
    
    logger.info("All models loaded successfully")
    return True

def extract_features(text: str) -> np.ndarray:
    """Extract BERT features from text"""
    if bert_model is None or tokenizer is None:
        raise RuntimeError("BERT model not loaded")
    
    inputs = tokenizer(
        text,
        return_tensors='pt',
        truncation=True,
        padding=True,
        max_length=512
    )
    
    with torch.no_grad():
        outputs = bert_model(**inputs)
        # Use CLS token embedding - convert to numpy via cpu
        features = outputs.last_hidden_state[:, 0, :].cpu().detach().numpy()
    
    return features

# Kafka message handler
async def handle_report_message(message: Dict[str, Any], topic: str, partition: int, offset: int):
    """Handle incoming report messages from Kafka for verification"""
    logger.info(f"Received verification request from topic {topic} (partition {partition}, offset {offset})")
    
    try:
        # For verification, we only need the basic details
        verify_request = VerificationRequest(
            report_id=message.get("id"),
            title=message.get("title"),
            description=message.get("description"),
            user_id=message.get("user_id", "system"),
            metadata={"source_topic": topic}
        )
        await verify_report(verify_request)
        
        # For duplication check, we would need existing reports.
        # This part is more complex and might require a separate trigger or fetching reports from DB.
        # For now, we focus on verification.
        logger.info(f"Skipping duplicate check for now for report {message.get('id')}")

    except Exception as e:
        logger.error(f"Error processing Kafka message for verification: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown"""
    logger.info("🚀 Starting AI Verification-Duplication Service...")
    
    # Load models - REQUIRED, fail if not loaded
    load_models()  # Will raise RuntimeError if models cannot be loaded
    
    # Initialize Kafka
    kafka_client = get_kafka_client()
    try:
        # Create required topics
        topics = [
            {"name": "verification_events", "partitions": 2, "replication_factor": 1},
            {"name": "report", "partitions": 2, "replication_factor": 1},
            {"name": "notification_events", "partitions": 2, "replication_factor": 1}
        ]
        kafka_client.create_topics(topics)
        
        await kafka_client.start_producer()
        logger.info("Kafka producer initialized")

        # Start consumer for report events (topic 'report' from report-service)
        await kafka_client.start_consumer(
            topics=["report"],
            group_id="ai-verification-group",
            handler=handle_report_message
        )

    except Exception as e:
        logger.warning(f"Kafka client failed to initialize: {e}")
    
    # Log startup
    audit_client = get_audit_client()
    await audit_client.log_event(
        action="service_startup",
        actor={"id": "system", "type": "system"},
        status="success",
        log_type="SYSTEM",
        metadata={"models_loaded": True, "service_version": "1.0.0"}
    )
    
    logger.info("✅ AI Verification-Duplication Service started successfully")
    
    yield
    
    # Cleanup
    logger.info("Shutting down AI Verification-Duplication Service...")
    await kafka_client.stop_producer()
    await kafka_client.stop_consumer()
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
    # Core models required: BERT, tokenizer, fake_detector, duplicate_classifier
    # Scaler is loaded but not used (dimension mismatch: expects 4, BERT outputs 768)
    models_ok = all([bert_model is not None, tokenizer is not None,  
                     fake_detector is not None, duplicate_classifier is not None])
    
    return HealthResponse(
        status="healthy" if models_ok else "unhealthy",
        service="ai-verification-duplication-service",
        timestamp=datetime.utcnow().isoformat() + "Z",
        models_loaded=models_ok,
        kafka_enabled=kafka_client.enabled and kafka_client.producer is not None
    )

@app.post("/verify", response_model=VerificationResponse)
async def verify_report(request: VerificationRequest):
    """
    Verify if a report is fake or authentic - uses ONLY pre-trained models
    """
    audit_client = get_audit_client()
    kafka_client = get_kafka_client()
    
    # Check if required models are loaded (scaler not used due to dimension mismatch)
    if bert_model is None or tokenizer is None or fake_detector is None:
        raise HTTPException(status_code=503, detail="Required models not loaded")
    
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
        
        # Combine title and description
        text = f"{request.title}. {request.description}"
        
        # Extract features using BERT
        features = extract_features(text)
        
        # Predict using fake detector model (output: [class_0, class_1])
        # Index 0 = authentic probability, Index 1 = fake probability
        with torch.no_grad():
            logits = fake_detector(torch.tensor(features, dtype=torch.float32))
            probabilities = torch.softmax(logits, dim=1)[0]
            
            authentic_prob = float(probabilities[0].item())
            fake_prob = float(probabilities[1].item())
            
            logger.info(f"Raw probabilities - authentic: {authentic_prob:.4f}, fake: {fake_prob:.4f}")
        
        is_fake = fake_prob > 0.5
        confidence = "high" if abs(fake_prob - 0.5) > 0.3 else "medium" if abs(fake_prob - 0.5) > 0.15 else "low"
        
        # AI NEVER auto-rejects - only human moderators can reject reports
        # If is_fake=true -> PENDING (needs manual review)
        # If is_fake=false -> VERIFIED (auto-accepted)
        
        logger.info(f"Verification result for {request.report_id}: is_fake={is_fake}, fake_prob={fake_prob:.4f}, authentic_prob={authentic_prob:.4f}, confidence={confidence}")
        
        # Publish to Kafka - no should_reject field, AI never rejects
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
        
        # Send notification for suspicious reports (needs moderator review)
        if is_fake:
            await kafka_client.publish(
                topic="notification_events",
                message={
                    "eventId": str(uuid.uuid4()),
                    "eventType": "SUSPICIOUS_REPORT_DETECTED",
                    "userId": request.user_id,
                    "source": "ai-verification-duplication-service",
                    "payload": {
                        "reportId": request.report_id,
                        "fake_probability": round(fake_prob * 100, 2),
                        "confidence": confidence,
                        "message": "Zgłoszenie wymaga weryfikacji przez moderatora"
                    }
                },
                key=request.user_id
            )
        
        # Explanation for user - simple feedback
        if not is_fake:
            user_explanation = "Zgłoszenie zostało zaakceptowane."
        else:
            user_explanation = "Zgłoszenie oczekuje na weryfikację przez moderatora."
        
        return VerificationResponse(
            report_id=request.report_id,
            is_fake=is_fake,
            fake_probability=round(fake_prob, 4),
            confidence=confidence,
            should_reject=False,  # AI never auto-rejects
            explanation=user_explanation
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
    Check if a report is a duplicate of existing reports - uses ONLY pre-trained models
    """
    audit_client = get_audit_client()
    kafka_client = get_kafka_client()
    
    # Check if required models are loaded (scaler not used due to dimension mismatch)
    if bert_model is None or tokenizer is None or duplicate_classifier is None:
        raise HTTPException(status_code=503, detail="Required models not loaded")
    
    try:
        await audit_client.log_event(
            action="check_duplicate",
            actor={"id": request.user_id, "type": "user"},
            status="success",
            log_type="ACTION",
            target={"id": request.report_id, "type": "report"}
        )
        
        # Extract features for the new report
        new_text = f"{request.title}. {request.description}"
        new_features = extract_features(new_text)
        
        # Compare with existing reports using the duplicate classifier model
        similar_reports = []
        max_similarity = 0.0
        
        for existing in request.existing_reports[:10]:  # Limit to 10 comparisons
            existing_text = f"{existing.get('title', '')}. {existing.get('description', '')}"
            existing_features = extract_features(existing_text)
            
            # Use duplicate classifier to predict similarity
            # Concatenate features for comparison
            combined_features = np.concatenate([new_features, existing_features], axis=1)
            similarity = float(duplicate_classifier.predict_proba(combined_features)[0][1])
            
            if similarity > 0.7:  # Threshold for potential duplicate
                similar_reports.append({
                    "report_id": existing.get("id", "unknown"),
                    "title": existing.get("title", ""),
                    "similarity": round(similarity, 4)
                })
            
            max_similarity = max(max_similarity, similarity)
        
        is_duplicate = max_similarity > 0.85
        
        logger.info(f"Duplicate check for {request.report_id}: is_duplicate={is_duplicate}, max_similarity={max_similarity:.4f}")
        
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
