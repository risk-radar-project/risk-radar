"""
Threat Analysis Microservice for RiskRadar
Analyzes local threats based on user location using AI
Uses Report Service API as the ONLY data source
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
import logging
from contextlib import asynccontextmanager
import os
from datetime import datetime
import json
import httpx
import google.generativeai as genai

from kafka_client import get_kafka_client
from audit_client import get_audit_client

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


# Pydantic models
class NearbyThreatRequest(BaseModel):
    """Request for analyzing real threats from database"""

    latitude: float = Field(..., description="User latitude coordinate")
    longitude: float = Field(..., description="User longitude coordinate")
    radius_km: float = Field(default=1.0, description="Search radius in kilometers")
    user_id: Optional[str] = Field(None, description="User ID for tracking")


class NearbyThreatResponse(BaseModel):
    """Response with AI-generated threat summary"""

    status: str
    location: Dict[str, float]
    radius_km: float
    reports_count: int
    danger_score: float
    danger_level: str
    ai_summary: str
    timestamp: str


class HealthResponse(BaseModel):
    status: str
    service: str
    timestamp: str
    kafka_enabled: bool


# Global variables
google_ai_model = None

# Report Service URL
REPORT_SERVICE_URL = os.getenv("REPORT_SERVICE_URL", "http://report-service:8080")

# Category name mapping (Polish)
CATEGORY_NAMES = {
    "VANDALISM": "Wandalizm",
    "INFRASTRUCTURE": "Uszkodzenie infrastruktury",
    "DANGEROUS_SITUATION": "Niebezpieczna sytuacja",
    "TRAFFIC_ACCIDENT": "Wypadek drogowy",
    "PARTICIPANT_BEHAVIOR": "Niebezpieczne zachowanie",
    "PARTICIPANT_HAZARD": "Zagrożenie dla uczestników",
    "OTHER": "Inne zagrożenie",
}


async def fetch_nearby_reports(
    latitude: float, longitude: float, radius_km: float
) -> List[Dict]:
    """Fetch real reports from Report Service within specified radius

    Raises:
        HTTPException: If Report Service is unavailable or returns error
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{REPORT_SERVICE_URL}/nearby",
                params={
                    "latitude": latitude,
                    "longitude": longitude,
                    "radiusKm": radius_km,
                },
            )
            if response.status_code == 200:
                data = response.json()
                return data.get("reports", [])
            else:
                logger.error(f"Report Service returned {response.status_code}")
                raise HTTPException(
                    status_code=503,
                    detail=f"Report Service niedostępny (status: {response.status_code})",
                )
    except httpx.RequestError as e:
        logger.error(f"Failed to connect to Report Service: {e}")
        raise HTTPException(
            status_code=503,
            detail="Nie można połączyć się z Report Service. Spróbuj ponownie później.",
        )


def prepare_real_reports_for_ai(reports: List[Dict]) -> str:
    """Convert real reports from database into structured text format for AI"""
    if not reports:
        return ""

    current_time = datetime.now()
    report_texts = []

    for i, report in enumerate(reports, 1):
        category = report.get("category", "OTHER")
        category_name = CATEGORY_NAMES.get(category, category)
        title = report.get("title", "Brak tytułu")
        description = report.get("description", "")[:100]  # Limit description length

        # Calculate time ago
        created_at = report.get("createdAt")
        if created_at:
            try:
                # Parse ISO format
                report_time = datetime.fromisoformat(
                    created_at.replace("Z", "+00:00").replace("+00:00", "")
                )
                days_ago = (current_time - report_time).days
                if days_ago == 0:
                    time_str = "dzisiaj"
                elif days_ago == 1:
                    time_str = "wczoraj"
                else:
                    time_str = f"{days_ago} dni temu"
            except:  # noqa: E722
                time_str = "niedawno"
        else:
            time_str = "niedawno"

        report_texts.append(f"{i}. [{category_name}] {title} - {time_str}")
        if description:
            report_texts.append(f"   Opis: {description}...")

    formatted_data = f"Lista {len(reports)} zgłoszeń w Twojej okolicy:\n"
    formatted_data += "\n".join(report_texts)
    return formatted_data


def analyze_real_threats_with_ai(reports_text: str, model, reports_count: int) -> Dict:
    """AI agent to analyze real threat reports and generate user-friendly summary

    Raises:
        HTTPException: If AI analysis fails
    """
    prompt = f"""Jesteś asystentem bezpieczeństwa w aplikacji RiskRadar. Użytkownik sprawdza bezpieczeństwo swojej okolicy.

WAŻNE: W okolicy użytkownika znajduje się DOKŁADNIE {reports_count} zgłoszeń.

Przeanalizuj poniższe PRAWDZIWE zgłoszenia z bazy danych:
{reports_text}

Twoim zadaniem jest:
1. Ocenić poziom zagrożenia w tej okolicy na podstawie KONKRETNYCH zgłoszeń
2. Napisać UNIKATOWE, spersonalizowane podsumowanie dla użytkownika (max 2-3 zdania)
3. Wymienić najważniejsze zagrożenia z listy i dać praktyczne rady
4. ZAWSZE używaj prawidłowej liczby zgłoszeń: {reports_count}

Twoja odpowiedź MUSI być poprawnym obiektem JSON:
{{
  "danger_score": <liczba 0-100>,
  "danger_level": <"Bardzo niski" | "Niski" | "Umiarkowany" | "Wysoki" | "Bardzo wysoki">,
  "summary": "<UNIKATOWE podsumowanie dopasowane do konkretnych zagrożeń - wspomnij o typach zgłoszeń z listy>"
}}

Zasady:
- Bądź konkretny - odnosisz się do RZECZYWISTYCH zgłoszeń z listy
- Nie używaj ogólników - napisz co dokładnie zgłoszono
- Jeśli zgłoszeń jest mało lub są stare, oceń ryzyko jako niskie
- ZAWSZE podawaj prawidłową liczbę zgłoszeń: {reports_count}
- Podsumowanie ma być zrozumiałe i pomocne dla użytkownika

JSON:"""

    logger.info("🤖 AI analizuje prawdziwe zgłoszenia...")

    try:
        response = model.generate_content(prompt)
        response_text = response.text.strip()

        json_start = response_text.find("{")
        json_end = response_text.rfind("}") + 1

        if json_start != -1 and json_end != 0:
            clean_json_str = response_text[json_start:json_end]
            analysis = json.loads(clean_json_str)

            if all(k in analysis for k in ["danger_score", "danger_level", "summary"]):
                logger.info("✓ Analiza AI zakończona sukcesem")
                return analysis
            else:
                raise ValueError("Brak wymaganych pól w odpowiedzi AI")
        else:
            raise ValueError("Nieprawidłowy format JSON w odpowiedzi AI")

    except Exception as e:
        logger.error(f"❌ Błąd AI: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Analiza AI niedostępna: {str(e)}. Spróbuj ponownie później.",
        )


# Lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown"""
    global google_ai_model

    logger.info("Starting Threat Analysis Microservice...")

    # Initialize Google AI
    api_key = os.getenv("GOOGLE_API_KEY")
    model_name = os.getenv("GOOGLE_AI_MODEL", "gemini-1.5-flash")

    if api_key:
        try:
            genai.configure(api_key=api_key)
            google_ai_model = genai.GenerativeModel(model_name)
            logger.info(f"✓ Google AI model initialized ({model_name})")
        except Exception as e:
            logger.error(f"Failed to initialize Google AI: {e}")
    else:
        logger.warning("GOOGLE_API_KEY not set - AI analysis will not be available")

    # Initialize Kafka
    kafka_client = get_kafka_client()
    try:
        # Create required topics
        topics = [
            {"name": "threat_analysis_events", "partitions": 2, "replication_factor": 1}
        ]
        kafka_client.create_topics(topics)

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
        metadata={"service_version": "2.0.0", "service_type": "threat_analysis"},
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
        log_type="SYSTEM",
    )
    logger.info("Threat Analysis Microservice stopped")


# Initialize FastAPI app
app = FastAPI(
    title="Threat Analysis Microservice",
    description="AI-powered local threat analysis for RiskRadar",
    version="2.0.0",
    lifespan=lifespan,
)


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    kafka_client = get_kafka_client()
    return HealthResponse(
        status="healthy",
        service="threat-analysis-service",
        timestamp=datetime.utcnow().isoformat() + "Z",
        kafka_enabled=kafka_client.enabled and kafka_client.producer is not None,
    )


@app.post("/api/v1/nearby-threats", response_model=NearbyThreatResponse)
async def analyze_nearby_threats(request: NearbyThreatRequest):
    global google_ai_model

    audit_client = get_audit_client()

    try:
        logger.info(
            f"🔍 Analyzing nearby threats at: ({request.latitude}, {request.longitude}), radius: {request.radius_km}km"
        )

        # Log the request
        await audit_client.log_event(
            action="nearby_threat_analysis",
            actor={"id": request.user_id or "anonymous", "type": "user"},
            status="success",
            log_type="ACTION",
            metadata={
                "location": {"lat": request.latitude, "lon": request.longitude},
                "radius_km": request.radius_km,
            },
        )

        # 1. Fetch real reports from Report Service
        nearby_reports = await fetch_nearby_reports(
            request.latitude, request.longitude, request.radius_km
        )

        logger.info(f"📊 Found {len(nearby_reports)} reports from database")

        # 2. If no reports, return safe status immediately (no AI call needed)
        if len(nearby_reports) == 0:
            safe_message = f"🌟 Świetnie! W promieniu {request.radius_km:.0f}km od Ciebie nie ma żadnych zgłoszeń. Okolica wydaje się bezpieczna."
            logger.info("✓ No reports found, returning safe status")
            return NearbyThreatResponse(
                status="success",
                location={"lat": request.latitude, "lon": request.longitude},
                radius_km=request.radius_km,
                reports_count=0,
                danger_score=0.0,
                danger_level="Bardzo niski",
                ai_summary=safe_message,
                timestamp=datetime.utcnow().isoformat(),
            )

        # 3. Prepare data for AI analysis
        formatted_reports = prepare_real_reports_for_ai(nearby_reports)
        reports_count = len(nearby_reports)
        logger.info(
            f"📝 Prepared {reports_count} reports for AI:\n{formatted_reports[:500]}..."
        )

        # 4. Analyze with AI (required - no fallback)
        if not google_ai_model:
            logger.error("❌ Google AI model not initialized")
            raise HTTPException(
                status_code=503,
                detail="Usługa AI niedostępna. Model nie został zainicjalizowany.",
            )

        ai_analysis = analyze_real_threats_with_ai(
            formatted_reports, google_ai_model, reports_count
        )

        # 5. Return response
        result = NearbyThreatResponse(
            status="success",
            location={"lat": request.latitude, "lon": request.longitude},
            radius_km=request.radius_km,
            reports_count=len(nearby_reports),
            danger_score=ai_analysis.get("danger_score", 0.0),
            danger_level=ai_analysis.get("danger_level", "Brak danych"),
            ai_summary=ai_analysis.get("summary", "Brak podsumowania"),
            timestamp=datetime.utcnow().isoformat(),
        )

        logger.info(
            f"✓ Nearby analysis complete: {result.danger_level} ({result.danger_score}/100)"
        )
        return result

    except HTTPException:
        # Re-raise HTTPException without wrapping
        raise
    except Exception as e:
        logger.error(f"Nearby threat analysis error: {e}")
        await audit_client.log_event(
            action="nearby_threat_analysis",
            actor={"id": request.user_id or "anonymous", "type": "user"},
            status="error",
            log_type="ERROR",
            metadata={"error": str(e)},
        )
        raise HTTPException(status_code=500, detail=f"Błąd analizy zagrożeń: {str(e)}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8080)
