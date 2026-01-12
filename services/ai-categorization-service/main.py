"""
AI Categorization Service
Automatically categorizes incident reports using ML pipeline
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import pandas as pd
import joblib
import logging
from contextlib import asynccontextmanager
import time
from typing import Optional, Dict, Any
import numpy as np
import os
from datetime import datetime
import uuid

from audit_client import get_audit_client
from kafka_client import get_kafka_client

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global variables
model_pipeline = None
label_encoder = None
model_info = {}

async def load_model():
    """Load model components from category-prediction"""
    global model_pipeline, label_encoder, model_info
    
    load_start = time.time()
    audit_client = get_audit_client()
    
    try:
        # Compatibility fix for numpy 2.x models in numpy 1.x environment
        import sys
        if 'numpy._core' not in sys.modules:
            try:
                import numpy.core as numpy_core
                sys.modules['numpy._core'] = numpy_core
                sys.modules['numpy._core.multiarray'] = numpy_core.multiarray
                sys.modules['numpy._core.umath'] = numpy_core.umath
                logger.info("Applied numpy compatibility layer for model loading")
            except Exception as e:
                logger.warning(f"Could not apply numpy compatibility layer: {e}")
        
        model_dir = "model_data"
        
        # Load the sklearn pipeline
        pipeline_path = os.path.join(model_dir, "best_model_pipeline.pkl")
        logger.info(f"Loading model pipeline from {pipeline_path}")
        model_pipeline = joblib.load(pipeline_path)
        logger.info("✅ Model pipeline loaded successfully")
        
        # Load label encoder
        encoder_path = os.path.join(model_dir, "label_encoder.pkl")
        logger.info(f"Loading label encoder from {encoder_path}")
        label_encoder = joblib.load(encoder_path)
        logger.info("✅ Label encoder loaded successfully")
        
        # Get categories from label encoder
        categories = label_encoder.classes_.tolist()
        logger.info(f"Categories: {categories}")
        
        model_info = {
            'model_type': 'sklearn_pipeline',
            'model_version': '1.0.0',
            'categories': categories,
            'n_categories': len(categories),
            'loaded_from': model_dir
        }
        
        load_time = (time.time() - load_start) * 1000
        
        # Log successful model load
        await audit_client.log_event(
            action="model_load",
            actor={"id": "system", "type": "system"},
            status="success",
            log_type="SYSTEM",
            metadata={
                "model_type": model_info["model_type"],
                "load_time_ms": load_time,
                "n_categories": len(categories)
            }
        )
        
        logger.info(f"Model loading completed in {load_time:.2f}ms")
        
    except Exception as e:
        logger.error(f"Failed to load model: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise RuntimeError(f"Cannot load model: {str(e)}")

# Kafka message handler
async def handle_report_message(message: Dict[str, Any], topic: str, partition: int, offset: int):
    """Handle incoming messages from Kafka"""
    logger.info(f"Received message from topic {topic} (partition {partition}, offset {offset})")
    
    try:
        # Create a request object from the message
        request = CategorizationRequest(
            report_id=message.get("id"),
            title=message.get("title"),
            description=message.get("description"),
            user_id=message.get("user_id", "system"), # Default to system if not present
            metadata={"source_topic": topic}
        )
        
        # Call the categorization logic
        await categorize_report(request)
        
    except Exception as e:
        logger.error(f"Error processing Kafka message: {e}")
        # Optionally, publish to a dead-letter queue

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown"""
    logger.info("🚀 Starting AI Categorization Service...")
    
    await load_model()
    
    # Initialize Kafka
    kafka_client = get_kafka_client()
    try:
        # Create required topics
        topics = [
            {"name": "categorization_events", "partitions": 2, "replication_factor": 1},
            {"name": "report", "partitions": 2, "replication_factor": 1},
            {"name": "notification_events", "partitions": 2, "replication_factor": 1}
        ]
        kafka_client.create_topics(topics)
        
        await kafka_client.start_producer()
        logger.info("Kafka producer initialized")
        
        # Start consumer for report events (topic 'report' from report-service)
        await kafka_client.start_consumer(
            topics=["report"],
            group_id="ai-categorization-group",
            handler=handle_report_message
        )
        
    except Exception as e:
        logger.warning(f"Kafka client failed to initialize: {e}")
    
    audit_client = get_audit_client()
    await audit_client.log_event(
        action="service_startup",
        actor={"id": "system", "type": "system"},
        status="success",
        log_type="SYSTEM",
        metadata={"service_version": "1.0.0"}
    )
    
    logger.info("✅ AI Categorization Service started successfully")
    
    yield
    
    # Cleanup
    logger.info("Shutting down AI Categorization Service...")
    await kafka_client.stop_producer()
    await kafka_client.stop_consumer()
    await audit_client.log_event(
        action="service_shutdown",
        actor={"id": "system", "type": "system"},
        status="success",
        log_type="SYSTEM"
    )
    logger.info("Service stopped")

# Initialize FastAPI app
app = FastAPI(
    title="AI Categorization Service",
    description="Microservice for AI-powered incident categorization",
    version="1.0.0",
    lifespan=lifespan
)

# Pydantic models
class CategorizationRequest(BaseModel):
    report_id: str = Field(..., description="Report ID")
    title: str = Field(..., description="Report title")
    description: Optional[str] = Field(None, description="Report description")
    user_id: str = Field(..., description="User ID")
    metadata: Optional[Dict[str, Any]] = None

class CategorizationResponse(BaseModel):
    report_id: str
    category: str
    confidence: float
    all_probabilities: Optional[Dict[str, float]] = None
    processing_time_ms: float

class HealthResponse(BaseModel):
    status: str
    service: str
    timestamp: str
    model_loaded: bool
    kafka_enabled: bool

class ModelInfoResponse(BaseModel):
    model_type: str
    model_version: str
    categories: list
    n_categories: int

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    kafka_client = get_kafka_client()
    models_loaded = model_pipeline is not None and label_encoder is not None
    return HealthResponse(
        status="healthy" if models_loaded else "unhealthy",
        service="ai-categorization-service",
        timestamp=datetime.utcnow().isoformat() + "Z",
        model_loaded=models_loaded,
        kafka_enabled=kafka_client.enabled and kafka_client.producer is not None
    )

@app.get("/model-info", response_model=ModelInfoResponse)
async def get_model_info():
    """Get information about the loaded model"""
    if not model_info:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    return ModelInfoResponse(**model_info)

@app.post("/categorize", response_model=CategorizationResponse)
async def categorize_report(request: CategorizationRequest):
    """
    Categorize an incident report
    """
    audit_client = get_audit_client()
    kafka_client = get_kafka_client()
    
    if model_pipeline is None or label_encoder is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        start_time = time.time()
        
        # Combine title and description
        text = request.title
        if request.description:
            text = f"{request.title}. {request.description}"
        
        logger.info(f"Categorizing text: '{text[:100]}...'")
        
        # Predict using pipeline
        prediction_encoded = model_pipeline.predict([text])[0]
        category = label_encoder.inverse_transform([prediction_encoded])[0]
        
        # Get prediction probabilities - REQUIRED
        if not hasattr(model_pipeline, 'predict_proba'):
            raise HTTPException(status_code=503, detail="Model does not support probability prediction")
        
        proba = model_pipeline.predict_proba([text])[0]
        confidence = float(np.max(proba))
        
        # Map probabilities to category names
        probabilities = {}
        for idx, prob in enumerate(proba):
            cat_name = label_encoder.inverse_transform([idx])[0]
            probabilities[cat_name] = round(float(prob), 4)
        
        processing_time = (time.time() - start_time) * 1000
        
        # Log the categorization
        await audit_client.log_event(
            action="categorize_report",
            actor={"id": request.user_id, "type": "user"},
            status="success",
            log_type="ACTION",
            target={"id": request.report_id, "type": "report"},
            metadata={
                "category": category,
                "confidence": confidence,
                "processing_time_ms": processing_time
            }
        )
        
        # Publish to Kafka
        await kafka_client.publish(
            topic="categorization_events",
            message={
                "event_type": "report_categorized",
                "report_id": request.report_id,
                "user_id": request.user_id,
                "category": str(category),
                "confidence": float(confidence),
                "timestamp": datetime.utcnow().isoformat()
            },
            key=request.report_id
        )
        
        return CategorizationResponse(
            report_id=request.report_id,
            category=category,
            confidence=round(confidence, 4),
            all_probabilities=probabilities,
            processing_time_ms=round(processing_time, 2)
        )
        
    except Exception as e:
        logger.error(f"Categorization error: {e}")
        await audit_client.log_event(
            action="categorize_report",
            actor={"id": request.user_id, "type": "user"},
            status="error",
            log_type="ERROR",
            target={"id": request.report_id, "type": "report"},
            metadata={"error": str(e)}
        )
        raise HTTPException(status_code=500, detail="Categorization failed")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
