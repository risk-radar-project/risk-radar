from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import pandas as pd
import joblib
import re
from scipy.sparse import hstack, csr_matrix
import logging
from contextlib import asynccontextmanager
import spacy
from sklearn.base import BaseEstimator, TransformerMixin
import time
from typing import Optional, Dict, Any
import numpy as np
from audit_client import get_audit_client

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Custom text preprocessor with enhanced cleaning
class EnhancedTextPreprocessor(BaseEstimator, TransformerMixin):
    def __init__(self):
        self.nlp = spacy.load('pl_core_news_sm', disable=['parser', 'ner'])
        
    def fit(self, X, y=None):
        return self
    
    def transform(self, X):
        return X.apply(self._preprocess_text)
    
    def _preprocess_text(self, text):
        if pd.isna(text):
            return ""
        
        text = str(text).lower()
        text = re.sub(r'\d+', ' NUMBER ', text)
        text = re.sub(r'[^\w\s]', ' ', text)
        text = re.sub(r'\s+', ' ', text).strip()
        
        doc = self.nlp(text)
        
        tokens = []
        for token in doc:
            if (not token.is_stop and 
                not token.is_punct and 
                token.is_alpha and 
                len(token.text) > 2 and
                token.pos_ in ['NOUN', 'ADJ', 'VERB', 'ADV']):
                tokens.append(token.lemma_)
        
        return ' '.join(tokens)

# Global variables
model = None
word_vectorizer = None
char_vectorizer = None
preprocessor = None
numerical_features = None
model_info = {}
audit_client = None

async def load_model():
    """Load model components on startup"""
    global model, word_vectorizer, char_vectorizer, preprocessor, numerical_features, model_info, audit_client
    
    load_start = time.time()
    
    try:
        audit_client = get_audit_client()
        
        model_paths = ["incident_classifier_clean.pkl"]
        bundle = None
        loaded_path = None
        
        for path in model_paths:
            try:
                logger.info(f"Attempting to load model from {path}")
                bundle = joblib.load(path)
                loaded_path = path
                logger.info(f"✅ Successfully loaded model from {path}")
                break
            except FileNotFoundError:
                logger.info(f"File {path} not found, trying next...")
                continue
            except Exception as e:
                logger.warning(f"Failed to load {path}: {str(e)}")
                continue
        
        if bundle is None:
            error_msg = "Could not load any model file"
            await audit_client.log_model_load(
                model_file="incident_classifier_clean.pkl",
                model_type="unknown",
                success=False,
                error=error_msg
            )
            raise RuntimeError(error_msg)
            
        logger.info(f"Available keys in model bundle: {list(bundle.keys())}")
        
        required_keys = ["model", "word_vectorizer", "char_vectorizer", "numerical_features"]
        missing_keys = [key for key in required_keys if key not in bundle]
        
        if missing_keys:
            error_msg = f"Missing required keys: {missing_keys}"
            await audit_client.log_model_load(
                model_file=loaded_path,
                model_type="unknown",
                success=False,
                error=error_msg
            )
            raise RuntimeError(error_msg)
        
        model = bundle["model"]
        word_vectorizer = bundle["word_vectorizer"]  
        char_vectorizer = bundle["char_vectorizer"]
        numerical_features = bundle["numerical_features"]
        
        model_info = {
            "model_type": type(model).__name__,
            "model_file": loaded_path,
            "numerical_features": numerical_features,
            "word_vectorizer_features": len(word_vectorizer.vocabulary_) if hasattr(word_vectorizer, 'vocabulary_') else 0,
            "char_vectorizer_features": len(char_vectorizer.vocabulary_) if hasattr(char_vectorizer, 'vocabulary_') else 0,
            "model_accuracy": bundle.get("accuracy", "Not available"),
            "training_date": bundle.get("training_date", "Not available"),
            "model_version": bundle.get("version", "1.0.0"),
            "categories": list(model.classes_) if hasattr(model, 'classes_') else []
        }
        
        logger.info("Creating new preprocessor instance...")
        preprocessor = EnhancedTextPreprocessor()
        
        load_time = (time.time() - load_start) * 1000
        
        # Log successful model load
        await audit_client.log_model_load(
            model_file=loaded_path,
            model_type=model_info["model_type"],
            success=True,
            load_time_ms=load_time
        )
        
        logger.info("🎯 Model loading completed successfully!")
        logger.info(f"   Model type: {type(model).__name__}")
        logger.info(f"   Loaded from: {loaded_path}")
        logger.info(f"   Load time: {load_time:.2f}ms")
        
    except Exception as e:
        logger.error(f"💥 Failed to load model: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise RuntimeError(f"Cannot load model: {str(e)}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Starting AI Categorization Service...")
    await load_model()
    logger.info("Service startup completed!")
    yield
    logger.info("Service shutting down...")

app = FastAPI(
    title="AI Categorization Service",
    description="Microservice for AI-powered incident categorization with audit logging",
    version="1.0.0",
    lifespan=lifespan
)

# Request/Response models
class IncidentRequest(BaseModel):
    title: str
    actor_id: Optional[str] = "system"
    actor_type: Optional[str] = "system"

class ModelMetrics(BaseModel):
    prediction_confidence: Optional[float] = None
    response_time_ms: float
    model_accuracy: Optional[str] = None
    preprocessing_time_ms: float
    vectorization_time_ms: float
    inference_time_ms: float

class ModelInfo(BaseModel):
    model_type: str
    model_version: str
    categories: list
    feature_count: Dict[str, Any]
    training_info: Dict[str, Any]

class IncidentResponse(BaseModel):
    category: str
    title: str
    metrics: ModelMetrics
    model_info: ModelInfo
    audit_logged: bool = False

def create_enhanced_features(df):
    """Create additional features from text"""
    df_features = df.copy()
    
    df_features['text_length'] = df_features['Opis'].str.len()
    df_features['word_count'] = df_features['Opis'].str.split().str.len()
    
    keywords = {
        'traffic': ['ruch', 'droga', 'ulica', 'auto', 'samochód', 'pojazd', 'kierowca'],
        'accident': ['wypadek', 'potrącenie', 'kolizja', 'karambol', 'uderzenie'],
        'infrastructure': ['chodnik', 'droga', 'oświetlenie', 'sygnalizacja', 'znak'],
        'damage': ['zniszczenie', 'uszkodzenie', 'awaria', 'zniszczony', 'uszkodzony'],
        'pedestrian': ['pieszy', 'piesi', 'przejście', 'pasy', 'chodnik'],
        'danger': ['niebezpieczny', 'zagrożenie', 'ryzyko', 'groźny', 'niebezpieczeństwo']
    }
    
    for category, words in keywords.items():
        df_features[f'has_{category}'] = df_features['Opis'].str.lower().str.contains('|'.join(words), na=False).astype(int)
    
    return df_features

def predict_category(title: str) -> tuple:
    """Predict category for given incident title with detailed timing"""
    try:
        start_time = time.time()
        
        preprocess_start = time.time()
        df_input = pd.DataFrame({"Opis": [title]})
        df_input = create_enhanced_features(df_input)
        df_input["Opis_cleaned"] = preprocessor.transform(df_input["Opis"])
        preprocess_time = (time.time() - preprocess_start) * 1000
        
        vectorize_start = time.time()
        word_feats = word_vectorizer.transform(df_input["Opis_cleaned"])
        char_feats = char_vectorizer.transform(df_input["Opis_cleaned"])
        X_text = hstack([word_feats, char_feats])
        X_final = hstack([X_text, csr_matrix(df_input[numerical_features].values)])
        vectorize_time = (time.time() - vectorize_start) * 1000
        
        inference_start = time.time()
        prediction = model.predict(X_final)[0]
        
        confidence = None
        if hasattr(model, 'predict_proba'):
            try:
                proba = model.predict_proba(X_final)[0]
                confidence = float(np.max(proba))
            except Exception as e:
                logger.warning(f"Could not get prediction probability: {str(e)}")
        
        inference_time = (time.time() - inference_start) * 1000
        total_time = (time.time() - start_time) * 1000
        
        return str(prediction), confidence, preprocess_time, vectorize_time, inference_time, total_time
        
    except Exception as e:
        logger.error(f"Error during prediction: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "ai-categorization"}

@app.post("/categorize", response_model=IncidentResponse)
async def categorize_incident(request: IncidentRequest):
    """Categorize incident based on title/description with audit logging"""
    if not request.title or not request.title.strip():
        raise HTTPException(status_code=400, detail="Title cannot be empty")
    
    audit_logged = False
    
    try:
        prediction, confidence, preprocess_time, vectorize_time, inference_time, total_time = predict_category(request.title)
        
        # Log to audit service
        audit_logged = await audit_client.log_prediction(
            title=request.title,
            predicted_category=prediction,
            confidence=confidence,
            processing_time_ms=total_time,
            actor_id=request.actor_id,
            actor_type=request.actor_type,
            success=True
        )
        
        metrics = ModelMetrics(
            prediction_confidence=confidence,
            response_time_ms=round(total_time, 2),
            model_accuracy=model_info.get("model_accuracy"),
            preprocessing_time_ms=round(preprocess_time, 2),
            vectorization_time_ms=round(vectorize_time, 2),
            inference_time_ms=round(inference_time, 2)
        )
        
        model_info_obj = ModelInfo(
            model_type=model_info.get("model_type", "Unknown"),
            model_version=model_info.get("model_version", "1.0.0"),
            categories=model_info.get("categories", []),
            feature_count={
                "word_features": model_info.get("word_vectorizer_features", 0),
                "char_features": model_info.get("char_vectorizer_features", 0),
                "numerical_features": len(numerical_features) if numerical_features else 0
            },
            training_info={
                "training_date": model_info.get("training_date", "Not available"),
                "model_file": model_info.get("model_file", "Unknown")
            }
        )
        
        return IncidentResponse(
            category=prediction,
            title=request.title,
            metrics=metrics,
            model_info=model_info_obj,
            audit_logged=audit_logged
        )
        
    except HTTPException:
        # Log error to audit
        await audit_client.log_error(
            action="categorize_incident",
            error_message="Categorization failed",
            error_details={"title": request.title},
            actor_id=request.actor_id
        )
        raise
    except Exception as e:
        # Log error to audit
        await audit_client.log_error(
            action="categorize_incident",
            error_message=str(e),
            error_details={"title": request.title},
            actor_id=request.actor_id
        )
        logger.error(f"Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/categories")
async def get_categories():
    """Get list of all available categories"""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    categories = model_info.get("categories", [])
    if not categories and hasattr(model, 'classes_'):
        categories = list(model.classes_)
    
    return {
        "categories": categories,
        "total_categories": len(categories),
        "model_type": model_info.get("model_type", "Unknown")
    }

@app.post("/batch-categorize")
async def batch_categorize_incidents(requests: list[IncidentRequest]):
    """Categorize multiple incidents at once with audit logging"""
    if not requests:
        raise HTTPException(status_code=400, detail="Request list cannot be empty")
    
    if len(requests) > 100:
        raise HTTPException(status_code=400, detail="Batch size cannot exceed 100 items")
    
    results = []
    total_start_time = time.time()
    successful = 0
    failed = 0
    
    for i, request in enumerate(requests):
        if not request.title or not request.title.strip():
            results.append({
                "index": i,
                "error": "Title cannot be empty",
                "title": request.title
            })
            failed += 1
            continue
        
        try:
            prediction, confidence, preprocess_time, vectorize_time, inference_time, total_time = predict_category(request.title)
            
            results.append({
                "index": i,
                "category": prediction,
                "title": request.title,
                "confidence": confidence,
                "processing_time_ms": round(total_time, 2)
            })
            successful += 1
        except Exception as e:
            results.append({
                "index": i,
                "error": str(e),
                "title": request.title
            })
            failed += 1
    
    batch_total_time = (time.time() - total_start_time) * 1000
    
    # Log batch operation to audit
    await audit_client.log_batch_prediction(
        total_items=len(requests),
        successful=successful,
        failed=failed,
        total_time_ms=batch_total_time,
        actor_id=requests[0].actor_id if requests else "system",
        actor_type=requests[0].actor_type if requests else "system"
    )
    
    return {
        "results": results,
        "batch_stats": {
            "total_items": len(requests),
            "successful": successful,
            "failed": failed,
            "total_processing_time_ms": round(batch_total_time, 2),
            "average_time_per_item_ms": round(batch_total_time / len(requests), 2) if requests else 0
        }
    }

@app.get("/statistics")
async def get_statistics():
    """Get model and service statistics"""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    categories = model_info.get("categories", [])
    if not categories and hasattr(model, 'classes_'):
        categories = list(model.classes_)
    
    stats = {
        "model_stats": {
            "model_type": model_info.get("model_type", "Unknown"),
            "model_version": model_info.get("model_version", "1.0.0"),
            "model_accuracy": model_info.get("model_accuracy", "Not available"),
            "training_date": model_info.get("training_date", "Not available"),
            "total_categories": len(categories)
        },
        "feature_stats": {
            "word_features": model_info.get("word_vectorizer_features", 0),
            "char_features": model_info.get("char_vectorizer_features", 0),
            "numerical_features": len(numerical_features) if numerical_features else 0,
            "total_features": (
                model_info.get("word_vectorizer_features", 0) + 
                model_info.get("char_vectorizer_features", 0) + 
                (len(numerical_features) if numerical_features else 0)
            )
        },
        "categories": categories,
        "service_info": {
            "service_name": "AI Categorization Service",
            "version": "1.0.0",
            "status": "operational",
            "audit_logging_enabled": audit_client.enabled if audit_client else False
        }
    }
    
    return stats

@app.get("/")
async def root():
    return {
        "service": "AI Categorization Service",
        "version": "1.0.0",
        "audit_logging": audit_client.enabled if audit_client else False,
        "endpoints": {
            "categorize": "POST /categorize - Categorize single incident",
            "batch_categorize": "POST /batch-categorize - Categorize multiple incidents",
            "categories": "GET /categories - List all available categories",
            "statistics": "GET /statistics - Get model and service statistics",
            "health": "GET /health - Health check"
        }
    }

if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.getenv("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)