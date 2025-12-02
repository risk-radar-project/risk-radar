"""
Threat Analysis Microservice for RiskRadar
Analyzes local threats based on user location using AI
"""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import logging
from contextlib import asynccontextmanager
import os
from datetime import datetime, timedelta
import numpy as np
import math
import json
import google.generativeai as genai

from kafka_client import get_kafka_client
from audit_client import get_audit_client

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Pydantic models
class ThreatAnalysisRequest(BaseModel):
    latitude: float = Field(..., description="User latitude coordinate")
    longitude: float = Field(..., description="User longitude coordinate")
    radius_km: float = Field(default=2.0, description="Search radius in kilometers")
    user_id: Optional[str] = Field(None, description="User ID for tracking")

class ThreatAnalysisResponse(BaseModel):
    status: str
    location: Dict[str, float]
    radius_km: float
    reports_count: int
    danger_score: float
    danger_level: str
    ai_summary: str
    method: str
    model: str
    timestamp: str

class HealthResponse(BaseModel):
    status: str
    service: str
    timestamp: str
    kafka_enabled: bool
# Global variables
google_ai_model = None
reports_db = None

# Threat types (Polish)
THREAT_TYPES = [
    "kradzież roweru", "włamanie do samochodu", "pobicie", 
    "kradzież portfela", "wandalizm", "napad", "przemoc domowa",
    "oszustwo", "groźby", "kradzież sklepowa"
]

def generate_sample_reports(num_reports: int = 50) -> np.ndarray:
    """Generate sample threat reports in Krakow area"""
    base_lat, base_lon = 50.0647, 19.9450
    reports = []
    current_time = datetime.now()
    
    for i in range(num_reports):
        lat_offset = np.random.uniform(-0.05, 0.05)
        lon_offset = np.random.uniform(-0.05, 0.05)
        
        report = [
            i,
            base_lat + lat_offset,
            base_lon + lon_offset,
            np.random.choice(len(THREAT_TYPES)),
            (current_time - timedelta(days=np.random.randint(0, 30))).timestamp()
        ]
        reports.append(report)
    
    return np.array(reports)

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two GPS points using Haversine formula"""
    R = 6371
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = (math.sin(delta_lat / 2) ** 2 + 
         math.cos(lat1_rad) * math.cos(lat2_rad) * 
         math.sin(delta_lon / 2) ** 2)
    c = 2 * math.asin(math.sqrt(a))
    
    return R * c

def get_nearby_reports(reports: np.ndarray, user_lat: float, user_lon: float, 
                       radius_km: float = 2.0) -> np.ndarray:
    """Get all reports within radius from user location"""
    nearby = []
    for report in reports:
        report_lat, report_lon = report[1], report[2]
        distance = calculate_distance(user_lat, user_lon, report_lat, report_lon)
        if distance <= radius_km:
            nearby.append(report)
    return np.array(nearby) if nearby else np.array([])

def prepare_reports_for_ai(reports: np.ndarray) -> str:
    """Convert raw report data into structured text format for AI"""
    current_time = datetime.now().timestamp()
    report_texts = []
    
    for i, report in enumerate(reports, 1):
        threat_type = THREAT_TYPES[int(report[3])]
        timestamp = report[4]
        days_ago = int((current_time - timestamp) / (24 * 3600))
        
        if days_ago == 0:
            time_str = "dzisiaj"
        elif days_ago == 1:
            time_str = "wczoraj"
        else:
            time_str = f"{days_ago} dni temu"
        
        report_texts.append(f"{i}. {threat_type} - {time_str}")
    
    formatted_data = f"Lista {len(reports)} zgłoszeń w okolicy:\n"
    formatted_data += "\n".join(report_texts)
    return formatted_data

def analyze_threats_with_ai(reports_text: str, model) -> Dict:
    """AI agent to analyze threat reports and return structured analysis"""
    prompt = f"""Jesteś agentem AI specjalizującym się w analizie bezpieczeństwa publicznego. Twoim zadaniem jest ocena zagrożenia na podstawie listy incydentów i zwrócenie odpowiedzi w formacie JSON.

Przeanalizuj poniższe zgłoszenia:
{reports_text}

Twoja odpowiedź MUSI być poprawnym obiektem JSON z następującymi kluczami:
- "danger_score": liczba od 0 do 100 (0=bardzo bezpiecznie, 100=skrajnie niebezpiecznie).
- "danger_level": jeden z ["Bardzo niski", "Niski", "Umiarkowany", "Wysoki", "Bardzo wysoki"].
- "summary": krótkie, 2-3 zdaniowe podsumowanie sytuacji po polsku, zawierające kluczowe zagrożenia i zalecenia.

Przykład odpowiedzi JSON:
{{
  "danger_score": 65,
  "danger_level": "Wysoki",
  "summary": "W okolicy odnotowano wzmożoną aktywność związaną z włamaniami do samochodów i kradzieżami. Zaleca się parkowanie w oświetlonych miejscach i niepozostawianie cennych przedmiotów w pojazdach."
}}

Odpowiedz TYLKO I WYŁĄCZNIE poprawnym obiektem JSON.

JSON:"""

    try:
        logger.info("🤖 Agent AI analizuje dane...")
        response = model.generate_content(prompt)
        response_text = response.text.strip()
        
        json_start = response_text.find('{')
        json_end = response_text.rfind('}') + 1
        
        if json_start != -1 and json_end != 0:
            clean_json_str = response_text[json_start:json_end]
            analysis = json.loads(clean_json_str)
            
            if all(k in analysis for k in ["danger_score", "danger_level", "summary"]):
                logger.info("✓ Analiza AI zakończona sukcesem")
                return analysis
            else:
                raise ValueError("Missing required keys in JSON response")
        else:
            raise ValueError("No valid JSON object found in response")
    except Exception as e:
        logger.warning(f"⚠ Błąd agenta AI: {e}. Używam analizy awaryjnej")
        report_count = reports_text.count("\n")
        score = min(report_count * 5, 75)
        return {
            "danger_score": score,
            "danger_level": "Umiarkowany" if score > 40 else "Niski",
            "summary": f"W okolicy odnotowano {report_count} zgłoszeń. Zalecana jest ogólna ostrożność."
        }

# Lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown"""
    global google_ai_model, reports_db
    
    logger.info("🚀 Starting Threat Analysis Microservice...")
    
    # Initialize Google AI
    api_key = os.getenv("GOOGLE_API_KEY", "AIzaSyCv9EswwXxuQ0LDNxA3etKIsXmmdc9t0CA")
    if api_key:
        try:
            genai.configure(api_key=api_key)
            google_ai_model = genai.GenerativeModel("gemini-1.5-flash")
            logger.info("✓ Google AI model initialized")
        except Exception as e:
            logger.error(f"Failed to initialize Google AI: {e}")
    else:
        logger.warning("GOOGLE_API_KEY not set")
    
    # Generate sample reports database
    reports_db = generate_sample_reports(50)
    logger.info(f"✓ Generated {len(reports_db)} sample threat reports")
    
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
        metadata={"service_version": "2.0.0", "service_type": "threat_analysis"}
    )
    
    logger.info("✅ Threat Analysis Microservice started successfully")
    
    yield
    
    # Cleanup
    logger.info("Shutting down Threat Analysis Microservice...")
    await kafka_client.stop_producer()
    await audit_client.log_event(
        action="service_shutdown",
        actor={"id": "system", "type": "system"},
        status="success",
        log_type="SYSTEM"
    )
    logger.info("Threat Analysis Microservice stopped")

# Initialize FastAPI app
app = FastAPI(
    title="Threat Analysis Microservice",
    description="AI-powered local threat analysis for RiskRadar",
    version="2.0.0",
    lifespan=lifespan
)

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    kafka_client = get_kafka_client()
    return HealthResponse(
        status="healthy",
        service="threat-analysis-service",
        timestamp=datetime.utcnow().isoformat() + "Z",
        kafka_enabled=kafka_client.enabled and kafka_client.producer is not None
    )

@app.post("/api/v1/analyze", response_model=ThreatAnalysisResponse)
async def analyze_location(request: ThreatAnalysisRequest):
    """
    Analyze local threats based on GPS coordinates
    
    This endpoint:
    1. Finds nearby threat reports within specified radius
    2. Uses AI to analyze danger level and generate summary
    3. Publishes results to Kafka for further processing
    """
    global google_ai_model, reports_db
    
    audit_client = get_audit_client()
    kafka_client = get_kafka_client()
    
    try:
        logger.info(f"🔍 Analyzing location: ({request.latitude}, {request.longitude})")
        
        # Log the request
        await audit_client.log_event(
            action="threat_analysis_request",
            actor={"id": request.user_id or "anonymous", "type": "user"},
            status="success",
            log_type="ACTION",
            metadata={
                "location": {"lat": request.latitude, "lon": request.longitude},
                "radius_km": request.radius_km
            }
        )
        
        # Get nearby reports
        nearby_reports = get_nearby_reports(
            reports_db, 
            request.latitude, 
            request.longitude, 
            request.radius_km
        )
        
        # If no reports, return safe status
        if len(nearby_reports) == 0:
            result = ThreatAnalysisResponse(
                status="success",
                location={"lat": request.latitude, "lon": request.longitude},
                radius_km=request.radius_km,
                reports_count=0,
                danger_score=0.0,
                danger_level="Bardzo niski",
                ai_summary="Brak zgłoszeń w tej okolicy. Obszar wydaje się bezpieczny.",
                method="ai_agent",
                model="none",
                timestamp=datetime.utcnow().isoformat()
            )
        else:
            logger.info(f"✓ Found {len(nearby_reports)} reports nearby")
            
            # Prepare data for AI
            formatted_reports = prepare_reports_for_ai(nearby_reports)
            
            # Analyze with AI
            if google_ai_model:
                ai_analysis = analyze_threats_with_ai(formatted_reports, google_ai_model)
                model_name = google_ai_model.model_name
            else:
                # Fallback if AI not available
                ai_analysis = {
                    "danger_score": min(len(nearby_reports) * 5, 75),
                    "danger_level": "Umiarkowany",
                    "summary": f"W okolicy znaleziono {len(nearby_reports)} zgłoszeń. Zalecana ostrożność."
                }
                model_name = "fallback"
            
            result = ThreatAnalysisResponse(
                status="success",
                location={"lat": request.latitude, "lon": request.longitude},
                radius_km=request.radius_km,
                reports_count=len(nearby_reports),
                danger_score=ai_analysis.get("danger_score", 0.0),
                danger_level=ai_analysis.get("danger_level", "Brak danych"),
                ai_summary=ai_analysis.get("summary", "Brak podsumowania"),
                method="ai_agent",
                model=model_name,
                timestamp=datetime.utcnow().isoformat()
            )
        
        # Publish to Kafka
        await kafka_client.publish(
            topic="threat_analysis_events",
            message={
                "event_type": "threat_analysis_completed",
                "user_id": request.user_id or "anonymous",
                "location": {"lat": request.latitude, "lon": request.longitude},
                "radius_km": request.radius_km,
                "reports_count": result.reports_count,
                "danger_score": result.danger_score,
                "danger_level": result.danger_level,
                "timestamp": result.timestamp
            },
            key=request.user_id or "anonymous"
        )
        
        # Publish notification if danger level is high
        if result.danger_score >= 60:
            await kafka_client.publish(
                topic="notification_events",
                message={
                    "type": "high_threat_alert",
                    "user_id": request.user_id or "anonymous",
                    "danger_level": result.danger_level,
                    "danger_score": result.danger_score,
                    "location": {"lat": request.latitude, "lon": request.longitude},
                    "summary": result.ai_summary,
                    "timestamp": result.timestamp
                },
                key=request.user_id or "anonymous"
            )
        
        logger.info(f"✓ Analysis complete: {result.danger_level} ({result.danger_score}/100)")
        return result
        
    except Exception as e:
        logger.error(f"Threat analysis error: {e}")
        await audit_client.log_event(
            action="threat_analysis_request",
            actor={"id": request.user_id or "anonymous", "type": "user"},
            status="error",
            log_type="ERROR",
            metadata={"error": str(e)}
        )
        raise HTTPException(status_code=500, detail=f"Threat analysis failed: {str(e)}")

@app.get("/api/v1/stats")
async def get_statistics():
    """Get overall threat statistics"""
    global reports_db
    
    return {
        "total_reports": len(reports_db) if reports_db is not None else 0,
        "time_range_days": 30,
        "threat_types": THREAT_TYPES,
        "coverage_area": "Krakow, Poland",
        "last_updated": datetime.utcnow().isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
