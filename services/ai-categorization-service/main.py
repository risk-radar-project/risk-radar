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

async def load_model():
    """Load model components on startup"""
    global model, word_vectorizer, char_vectorizer, preprocessor, numerical_features
    
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
        
        # Always create a fresh preprocessor instance
        logger.info("Creating new preprocessor instance...")
        preprocessor = EnhancedTextPreprocessor()
        
        logger.info(" Model loading completed successfully!")
        logger.info(f"   Model type: {type(model).__name__}")
        logger.info(f"   Numerical features: {numerical_features}")
        logger.info(f"   Loaded from: {loaded_path}")
        
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
    logger.info(" Starting AI Categorization Service...")
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

class IncidentResponse(BaseModel):
    category: str
    title: str

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

def predict_category(title: str) -> str:
    """Predict category for given incident title"""
    try:
        # Wrap input into DataFrame
        df_input = pd.DataFrame({"Opis": [title]})
        
        # Apply preprocessing + feature engineering
        df_input = create_enhanced_features(df_input)
        df_input["Opis_cleaned"] = preprocessor.transform(df_input["Opis"])
        
        # Vectorize text
        word_feats = word_vectorizer.transform(df_input["Opis_cleaned"])
        char_feats = char_vectorizer.transform(df_input["Opis_cleaned"])
        X_text = hstack([word_feats, char_feats])
        
        # Add numerical features
        X_final = hstack([X_text, csr_matrix(df_input[numerical_features].values)])
        
        # Predict
        prediction = model.predict(X_final)[0]
        return str(prediction)
        
    except Exception as e:
        logger.error(f"Error during prediction: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "ai-categorization"}

@app.post("/categorize", response_model=IncidentResponse)
async def categorize_incident(request: IncidentRequest):
    """Categorize incident based on title/description"""
    if not request.title or not request.title.strip():
        raise HTTPException(status_code=400, detail="Title cannot be empty")
    
    try:
        category = predict_category(request.title)
        return IncidentResponse(category=category, title=request.title)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/")
async def root():
    return {
        "service": "AI Categorization Service",
        "version": "1.0.0",
        "endpoints": {
            "categorize": "POST /categorize",
            "health": "GET /health"
        }
    }

if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.getenv("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)