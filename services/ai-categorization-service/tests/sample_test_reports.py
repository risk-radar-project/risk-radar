"""
Sample Test Reports for Integration Testing
These reports can be used to test the full integration flow:
report-service -> Kafka -> AI services -> notification-service
"""
import json
import uuid
from datetime import datetime
from typing import List, Dict, Any

# =============================================================================
# SAMPLE REPORTS - Various categories for AI Categorization testing
# =============================================================================

SAMPLE_REPORTS: List[Dict[str, Any]] = [
    # 1. Infrastruktura drogowa - powinno być skategoryzowane poprawnie
    {
        "id": str(uuid.uuid4()),
        "title": "Duża dziura w jezdni na ul. Głównej",
        "description": "Na wysokości numeru 45 znajduje się duża dziura w asfalcie o średnicy około 50cm. Stanowi zagrożenie dla kierowców, szczególnie w nocy gdy jest słabo widoczna. Kilka samochodów już uszkodziło opony.",
        "user_id": "user-001",
        "latitude": 52.2297,
        "longitude": 21.0122,
        "expected_category": "Infrastruktura drogowa / chodników",
        "expected_fake": False
    },
    
    # 2. Śmieci / zaśmiecanie
    {
        "id": str(uuid.uuid4()),
        "title": "Nielegalne wysypisko śmieci w lesie",
        "description": "W lesie przy ul. Leśnej ktoś wyrzucił dużą ilość odpadów budowlanych i starych mebli. Są tam także worki z nieznaną zawartością. Miejsce znajduje się około 200m od głównej drogi.",
        "user_id": "user-002",
        "latitude": 52.1850,
        "longitude": 20.9800,
        "expected_category": "Śmieci / nielegalne zaśmiecanie / wysypiska",
        "expected_fake": False
    },
    
    # 3. Oświetlenie
    {
        "id": str(uuid.uuid4()),
        "title": "Nie działa latarnia uliczna",
        "description": "Lampa uliczna przy przejściu dla pieszych na skrzyżowaniu ul. Szkolnej i Parkowej nie świeci od tygodnia. Jest to jedyne oświetlenie w tym miejscu i stanowi zagrożenie dla pieszych.",
        "user_id": "user-003",
        "latitude": 52.2100,
        "longitude": 21.0300,
        "expected_category": "Infrastruktura drogowa / chodników",
        "expected_fake": False
    },
    
    # 4. Zieleń miejska
    {
        "id": str(uuid.uuid4()),
        "title": "Przewrócone drzewo blokuje chodnik",
        "description": "Po wczorajszej burzy duże drzewo przewróciło się na chodnik przy ul. Lipowej 12. Całkowicie blokuje przejście, piesi muszą chodzić jezdnią. Gałęzie sięgają też na drogę.",
        "user_id": "user-004",
        "latitude": 52.2400,
        "longitude": 21.0500,
        "expected_category": "Zieleń miejska / drzewa",
        "expected_fake": False
    },
    
    # 5. Wandalizm
    {
        "id": str(uuid.uuid4()),
        "title": "Zniszczona wiata przystankowa",
        "description": "Ktoś rozbił szybę w wiacie przystankowej na przystanku Centrum. Wszędzie leżą odłamki szkła, ławka jest też pomalowana sprayem. Przystanek wymaga pilnej naprawy.",
        "user_id": "user-005",
        "latitude": 52.2297,
        "longitude": 21.0122,
        "expected_category": "Wandalizm / graffiti",
        "expected_fake": False
    },
]

# =============================================================================
# POTENTIALLY FAKE REPORTS - For AI Verification testing
# =============================================================================

POTENTIALLY_FAKE_REPORTS: List[Dict[str, Any]] = [
    # 1. Bardzo krótki, mało szczegółowy
    {
        "id": str(uuid.uuid4()),
        "title": "Problem",
        "description": "Jest problem.",
        "user_id": "user-fake-001",
        "latitude": 52.0000,
        "longitude": 21.0000,
        "expected_category": "Inne",
        "expected_fake": True,
        "fake_reason": "Zbyt krótki i niekonkretny opis"
    },
    
    # 2. Niespójny/nonsensowny
    {
        "id": str(uuid.uuid4()),
        "title": "Latające słonie na drodze",
        "description": "Widziałem jak słonie latały nad drogą i rzucały kokosami w samochody. To było wczoraj o 3 w nocy przy pełni księżyca. Proszę o interwencję.",
        "user_id": "user-fake-002",
        "latitude": 52.5000,
        "longitude": 21.5000,
        "expected_category": "Inne",
        "expected_fake": True,
        "fake_reason": "Nierealistyczny, nonsensowny opis"
    },
    
    # 3. Spam/reklama
    {
        "id": str(uuid.uuid4()),
        "title": "NAJLEPSZE CENY! KLIKNIJ TUTAJ!",
        "description": "Sprawdź naszą ofertę na www.spam-link.com! Najniższe ceny w mieście! Zadzwoń teraz 123-456-789! Promocja tylko dziś!",
        "user_id": "user-fake-003",
        "latitude": 52.1000,
        "longitude": 20.9000,
        "expected_category": "Inne",
        "expected_fake": True,
        "fake_reason": "Spam/reklama"
    },
]

# =============================================================================
# DUPLICATE REPORTS - For duplicate detection testing
# =============================================================================

DUPLICATE_REPORT_PAIRS: List[Dict[str, Any]] = [
    {
        "original": {
            "id": "original-001",
            "title": "Dziura w drodze na Marszałkowskiej",
            "description": "Duża dziura w jezdni na ul. Marszałkowskiej przy numerze 100. Wymiary około 40x30 cm, głębokość 10 cm.",
            "user_id": "user-dup-001"
        },
        "duplicate": {
            "id": "duplicate-001",
            "title": "Uszkodzenie nawierzchni ul. Marszałkowska",
            "description": "Na Marszałkowskiej koło setki jest spora dziura w asfalcie. Ma jakieś 40 cm szerokości. Trzeba uważać jadąc.",
            "user_id": "user-dup-002"
        },
        "expected_similarity": 0.85
    },
    {
        "original": {
            "id": "original-002",
            "title": "Nie świeci lampa na Puławskiej",
            "description": "Latarnia uliczna przy ul. Puławskiej 50 nie działa od 3 dni. Ciemno w nocy.",
            "user_id": "user-dup-003"
        },
        "duplicate": {
            "id": "duplicate-002",
            "title": "Awaria oświetlenia Puławska",
            "description": "Lampa uliczna na Puławskiej 50 jest zepsuta. Nie świeci już kilka dni.",
            "user_id": "user-dup-004"
        },
        "expected_similarity": 0.90
    }
]

# =============================================================================
# KAFKA MESSAGE FORMAT - As sent by report-service
# =============================================================================

def create_kafka_message(report: Dict[str, Any]) -> Dict[str, str]:
    """
    Create Kafka message in the format sent by report-service
    (matches ReportService.java reportToPayload method)
    """
    return {
        "id": report["id"],
        "title": report["title"],
        "description": report["description"]
    }

def create_full_report_payload(report: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create full report payload with all fields
    """
    return {
        "id": report["id"],
        "title": report["title"],
        "description": report["description"],
        "user_id": report.get("user_id", "anonymous"),
        "latitude": report.get("latitude", 0.0),
        "longitude": report.get("longitude", 0.0),
        "created_at": datetime.utcnow().isoformat() + "Z",
        "status": "PENDING"
    }

# =============================================================================
# EXPECTED NOTIFICATION EVENTS - After AI processing
# =============================================================================

def create_expected_categorization_notification(report: Dict[str, Any], category: str, confidence: float) -> Dict[str, Any]:
    """
    Create expected notification event from ai-categorization-service
    """
    return {
        "eventId": str(uuid.uuid4()),  # Will be different in actual run
        "eventType": "REPORT_CATEGORIZED",
        "userId": report.get("user_id", "system"),
        "source": "ai-categorization-service",
        "payload": {
            "reportId": report["id"],
            "category": category,
            "confidence": confidence
        }
    }

def create_expected_fake_detection_notification(report: Dict[str, Any], fake_probability: float) -> Dict[str, Any]:
    """
    Create expected notification event from ai-verification-service
    (only sent when fake is detected)
    """
    return {
        "eventId": str(uuid.uuid4()),
        "eventType": "FAKE_REPORT_DETECTED",
        "userId": report.get("user_id", "system"),
        "source": "ai-verification-duplication-service",
        "payload": {
            "reportId": report["id"],
            "fake_probability": fake_probability,
            "confidence": "high" if fake_probability > 0.8 else "medium" if fake_probability > 0.65 else "low"
        }
    }

# =============================================================================
# TEST SCENARIOS
# =============================================================================

TEST_SCENARIOS = [
    {
        "name": "Happy Path - Valid Infrastructure Report",
        "description": "Test valid report about road infrastructure",
        "input": SAMPLE_REPORTS[0],
        "expected_flow": [
            "report-service publishes to 'report' topic",
            "ai-categorization-service receives and categorizes",
            "ai-categorization-service publishes to 'categorization_events'",
            "ai-categorization-service publishes to 'notification_events'",
            "ai-verification-service receives and verifies",
            "ai-verification-service publishes to 'verification_events'",
            "notification-service receives and creates in-app notification"
        ]
    },
    {
        "name": "Fake Report Detection",
        "description": "Test detection of obviously fake report",
        "input": POTENTIALLY_FAKE_REPORTS[1],  # Flying elephants
        "expected_flow": [
            "report-service publishes to 'report' topic",
            "ai-categorization-service categorizes as 'Inne'",
            "ai-verification-service detects as FAKE",
            "ai-verification-service publishes FAKE_REPORT_DETECTED to 'notification_events'",
            "notification-service sends warning notification"
        ]
    },
    {
        "name": "Duplicate Detection",
        "description": "Test detection of duplicate reports",
        "input": DUPLICATE_REPORT_PAIRS[0],
        "expected_flow": [
            "Original report processed normally",
            "Duplicate report detected with high similarity",
            "System flags potential duplicate"
        ]
    }
]

# =============================================================================
# UTILITY FUNCTIONS FOR TESTING
# =============================================================================

def get_all_test_reports() -> List[Dict[str, Any]]:
    """Get all sample reports for testing"""
    return SAMPLE_REPORTS + POTENTIALLY_FAKE_REPORTS

def get_kafka_test_messages() -> List[Dict[str, str]]:
    """Get all reports as Kafka messages"""
    return [create_kafka_message(r) for r in get_all_test_reports()]

def print_test_report(report: Dict[str, Any]):
    """Pretty print a test report"""
    print(f"\n{'='*60}")
    print(f"📝 Report ID: {report['id']}")
    print(f"📌 Title: {report['title']}")
    print(f"📄 Description: {report['description'][:100]}...")
    print(f"👤 User: {report.get('user_id', 'N/A')}")
    print(f"🏷️ Expected Category: {report.get('expected_category', 'N/A')}")
    print(f"🚨 Expected Fake: {report.get('expected_fake', False)}")
    if report.get('fake_reason'):
        print(f"❓ Fake Reason: {report['fake_reason']}")
    print(f"{'='*60}")

def export_to_json(filename: str = "test_reports.json"):
    """Export all test data to JSON file"""
    data = {
        "sample_reports": SAMPLE_REPORTS,
        "potentially_fake_reports": POTENTIALLY_FAKE_REPORTS,
        "duplicate_report_pairs": DUPLICATE_REPORT_PAIRS,
        "test_scenarios": TEST_SCENARIOS
    }
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"✅ Exported test data to {filename}")


if __name__ == "__main__":
    print("🧪 SAMPLE TEST REPORTS FOR INTEGRATION TESTING")
    print("=" * 60)
    
    print("\n📦 VALID REPORTS (for categorization):")
    for report in SAMPLE_REPORTS:
        print_test_report(report)
    
    print("\n🚨 POTENTIALLY FAKE REPORTS (for verification):")
    for report in POTENTIALLY_FAKE_REPORTS:
        print_test_report(report)
    
    print("\n🔄 DUPLICATE REPORT PAIRS:")
    for pair in DUPLICATE_REPORT_PAIRS:
        print(f"\n  Original: {pair['original']['title']}")
        print(f"  Duplicate: {pair['duplicate']['title']}")
        print(f"  Expected Similarity: {pair['expected_similarity']}")
    
    # Export to JSON
    export_to_json()
