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
        
        # Basic text cleaning
        text = str(text).lower()
        text = re.sub(r'\d+', ' NUMBER ', text)  # Replace numbers with token
        text = re.sub(r'[^\w\s]', ' ', text)    # Remove special chars
        text = re.sub(r'\s+', ' ', text).strip() # Normalize whitespace
        
        # SpaCy processing
        doc = self.nlp(text)
        
        # Enhanced token filtering
        tokens = []
        for token in doc:
            if (not token.is_stop and 
                not token.is_punct and 
                token.is_alpha and 
                len(token.text) > 2 and  # Filter very short words
                token.pos_ in ['NOUN', 'ADJ', 'VERB', 'ADV']):  # Keep meaningful POS tags
                tokens.append(token.lemma_)
        
        return ' '.join(tokens)

# Global variables for model components
model = None
word_vectorizer = None
char_vectorizer = None
preprocessor = None
numerical_features = None
model_info = {}

async def load_model():
    """Load model components on startup"""
    global model, word_vectorizer, char_vectorizer, preprocessor, numerical_features, model_info
    
    try:
        # Try both clean and original model files
        model_paths = ["incident_classifier_clean.pkl", "incident_classifier_clean.pkl"]
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
            raise RuntimeError("Could not load any model file from: " + str(model_paths))
            
        # Log available keys for debugging
        logger.info(f"Available keys in model bundle: {list(bundle.keys())}")
        
        # Check for required keys
        required_keys = ["model", "word_vectorizer", "char_vectorizer", "numerical_features"]
        missing_keys = [key for key in required_keys if key not in bundle]
        
        if missing_keys:
            raise RuntimeError(f"Missing required keys in model bundle: {missing_keys}")
        
        # Load components
        model = bundle["model"]
        word_vectorizer = bundle["word_vectorizer"]  
        char_vectorizer = bundle["char_vectorizer"]
        numerical_features = bundle["numerical_features"]
        
        # Store model information
        model_info = {
            "model_type": type(model).__name__,
            "model_file": loaded_path,
            "numerical_features": numerical_features,
            "word_vectorizer_features": getattr(word_vectorizer, 'vocabulary_', {}) and len(word_vectorizer.vocabulary_),
            "char_vectorizer_features": getattr(char_vectorizer, 'vocabulary_', {}) and len(char_vectorizer.vocabulary_),
            "model_accuracy": bundle.get("accuracy", "Not available"),
            "training_date": bundle.get("training_date", "Not available"),
            "model_version": bundle.get("version", "1.0.0"),
            "categories": list(getattr(model, 'classes_', [])) if hasattr(model, 'classes_') else "Not available"
        }
        
        # Always create a fresh preprocessor instance
        logger.info("Creating new preprocessor instance...")
        preprocessor = EnhancedTextPreprocessor()
        
        logger.info("🎯 Model loading completed successfully!")
        logger.info(f"   Model type: {type(model).__name__}")
        logger.info(f"   Numerical features: {numerical_features}")
        logger.info(f"   Loaded from: {loaded_path}")
        logger.info(f"   Model accuracy: {model_info.get('model_accuracy', 'N/A')}")
        
    except Exception as e:
        logger.error(f"💥 Failed to load model: {str(e)}")
        if bundle is not None:
            logger.error(f"Available bundle keys were: {list(bundle.keys())}")
        import traceback
        logger.error(traceback.format_exc())
        raise RuntimeError(f"Cannot load model: {str(e)}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("🚀 Starting AI Categorization Service...")
    await load_model()
    logger.info("Service startup completed!")
    yield
    # Shutdown
    logger.info("Service shutting down...")

app = FastAPI(
    title="AI Categorization Service",
    description="Microservice for AI-powered incident categorization",
    version="1.0.0",
    lifespan=lifespan
)

# Request/Response models
class IncidentRequest(BaseModel):
    title: str

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

def create_enhanced_features(df):
    """Create additional features from text"""
    df_features = df.copy()
    
    # Text length features
    df_features['text_length'] = df_features['Opis'].str.len()
    df_features['word_count'] = df_features['Opis'].str.split().str.len()
    
    # Keyword presence features
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
        
        # Timing for preprocessing
        preprocess_start = time.time()
        df_input = pd.DataFrame({"Opis": [title]})
        df_input = create_enhanced_features(df_input)
        df_input["Opis_cleaned"] = preprocessor.transform(df_input["Opis"])
        preprocess_time = (time.time() - preprocess_start) * 1000
        
        # Timing for vectorization
        vectorize_start = time.time()
        word_feats = word_vectorizer.transform(df_input["Opis_cleaned"])
        char_feats = char_vectorizer.transform(df_input["Opis_cleaned"])
        X_text = hstack([word_feats, char_feats])
        X_final = hstack([X_text, csr_matrix(df_input[numerical_features].values)])
        vectorize_time = (time.time() - vectorize_start) * 1000
        
        # Timing for inference
        inference_start = time.time()
        prediction = model.predict(X_final)[0]
        
        # Get prediction confidence if available
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
    """Categorize incident based on title/description with detailed metrics"""
    if not request.title or not request.title.strip():
        raise HTTPException(status_code=400, detail="Title cannot be empty")
    
    try:
        prediction, confidence, preprocess_time, vectorize_time, inference_time, total_time = predict_category(request.title)
        
        # Create metrics object
        metrics = ModelMetrics(
            prediction_confidence=confidence,
            response_time_ms=round(total_time, 2),
            model_accuracy=model_info.get("model_accuracy"),
            preprocessing_time_ms=round(preprocess_time, 2),
            vectorization_time_ms=round(vectorize_time, 2),
            inference_time_ms=round(inference_time, 2)
        )
        
        # Create model info object
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
            model_info=model_info_obj
        )
        
    except HTTPException:
        raise
    except Exception as e:
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

@app.get("/categories/{category}")
async def get_category_info(category: str):
    """Get information about a specific category"""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    categories = model_info.get("categories", [])
    if not categories and hasattr(model, 'classes_'):
        categories = list(model.classes_)
    
    if category not in categories:
        raise HTTPException(
            status_code=404, 
            detail=f"Category '{category}' not found. Available categories: {categories}"
        )
    
    # Define category descriptions and keywords
    category_descriptions = {
        "traffic": {
            "description": "Traffic-related incidents including accidents, collisions, and traffic flow problems",
            "keywords": ["ruch", "droga", "ulica", "auto", "samochód", "pojazd", "kierowca"],
            "examples": ["Kolizja dwóch pojazdów", "Korek na głównej ulicy", "Awaria pojazdu na drodze"]
        },
        "accident": {
            "description": "Accidents including collisions, crashes, and pedestrian incidents",
            "keywords": ["wypadek", "potrącenie", "kolizja", "karambol", "uderzenie"],
            "examples": ["Wypadek drogowy", "Potrącenie pieszego", "Karambol na autostradzie"]
        },
        "infrastructure": {
            "description": "Infrastructure problems including roads, lighting, and signaling issues",
            "keywords": ["chodnik", "droga", "oświetlenie", "sygnalizacja", "znak"],
            "examples": ["Uszkodzone oświetlenie", "Awaria sygnalizacji", "Dziura w chodniku"]
        },
        "damage": {
            "description": "Property damage and destruction incidents",
            "keywords": ["zniszczenie", "uszkodzenie", "awaria", "zniszczony", "uszkodzony"],
            "examples": ["Uszkodzony znak drogowy", "Zniszczona barierka", "Awaria ogrodzenia"]
        },
        "pedestrian": {
            "description": "Pedestrian-related incidents and sidewalk issues",
            "keywords": ["pieszy", "piesi", "przejście", "pasy", "chodnik"],
            "examples": ["Problem z przejściem dla pieszych", "Zablokowany chodnik", "Niebezpieczne przejście"]
        },
        "danger": {
            "description": "Dangerous situations and safety hazards",
            "keywords": ["niebezpieczny", "zagrożenie", "ryzyko", "groźny", "niebezpieczeństwo"],
            "examples": ["Niebezpieczna dziura", "Zagrożenie dla pieszych", "Ryzykowne skrzyżowanie"]
        }
    }
    
    category_info = category_descriptions.get(category, {
        "description": f"Category: {category}",
        "keywords": [],
        "examples": []
    })
    
    return {
        "category": category,
        "description": category_info["description"],
        "keywords": category_info["keywords"],
        "examples": category_info["examples"],
        "total_categories": len(categories)
    }

@app.post("/batch-categorize")
async def batch_categorize_incidents(requests: list[IncidentRequest]):
    """Categorize multiple incidents at once"""
    if not requests:
        raise HTTPException(status_code=400, detail="Request list cannot be empty")
    
    if len(requests) > 100:  # Limit batch size
        raise HTTPException(status_code=400, detail="Batch size cannot exceed 100 items")
    
    results = []
    total_start_time = time.time()
    
    for i, request in enumerate(requests):
        if not request.title or not request.title.strip():
            results.append({
                "index": i,
                "error": "Title cannot be empty",
                "title": request.title
            })
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
        except Exception as e:
            results.append({
                "index": i,
                "error": str(e),
                "title": request.title
            })
    
    batch_total_time = (time.time() - total_start_time) * 1000
    
    return {
        "results": results,
        "batch_stats": {
            "total_items": len(requests),
            "successful": len([r for r in results if "category" in r]),
            "failed": len([r for r in results if "error" in r]),
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
    
    # Basic statistics
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
            "status": "operational"
        }
    }
    
    return stats

@app.post("/validate")
async def validate_input(request: IncidentRequest):
    """Validate input text and provide preprocessing preview"""
    if not request.title or not request.title.strip():
        raise HTTPException(status_code=400, detail="Title cannot be empty")
    
    try:
        # Apply preprocessing
        df_input = pd.DataFrame({"Opis": [request.title]})
        df_input = create_enhanced_features(df_input)
        cleaned_text = preprocessor.transform(df_input["Opis"])[0]
        
        # Extract features
        features = {}
        for col in df_input.columns:
            if col.startswith('has_') or col in ['text_length', 'word_count']:
                features[col] = df_input[col].iloc[0]
        
        return {
            "original_text": request.title,
            "cleaned_text": cleaned_text,
            "text_length": len(request.title),
            "cleaned_length": len(cleaned_text),
            "word_count": len(request.title.split()) if request.title else 0,
            "cleaned_word_count": len(cleaned_text.split()) if cleaned_text else 0,
            "detected_features": features,
            "is_valid": bool(cleaned_text.strip())
        }
    except Exception as e:
        logger.error(f"Error during validation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Validation error: {str(e)}")

@app.get("/model-info")
async def get_model_info():
    """Get detailed model information"""
    return {
        "model_info": model_info,
        "status": "loaded" if model is not None else "not_loaded"
    }

@app.get("/")
async def root():
    return {
        "service": "AI Categorization Service",
        "version": "1.0.0",
        "endpoints": {
            "categorize": "POST /categorize - Categorize single incident",
            "batch_categorize": "POST /batch-categorize - Categorize multiple incidents",
            "categories": "GET /categories - List all available categories",
            "category_info": "GET /categories/{category} - Get info about specific category",
            "statistics": "GET /statistics - Get model and service statistics",
            "validate": "POST /validate - Validate and preview text preprocessing",
            "model_info": "GET /model-info - Get detailed model information",
            "health": "GET /health - Health check"
        }
    }

if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.getenv("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)