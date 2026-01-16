import os
import time
import uuid
import random
import logging
import datetime
import bcrypt
import shutil
import secrets
import string
from typing import List, Dict, Any

from dotenv import load_dotenv 

import psycopg2
from psycopg2.extras import execute_batch, Json
from faker import Faker

# Load environment variables from .env file
load_dotenv()

import requests
import jwt

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('demo-seeder')

# Configuration
DB_URL = os.environ.get('DATABASE_URL')
DEMO_MODE = os.environ.get('DEMO_MODE', 'false').lower() == 'true'
MEDIA_SERVICE_URL = os.environ.get('MEDIA_SERVICE_URL', 'http://media-service:8080')
JWT_SECRET = os.environ.get('JWT_SECRET', 'aSV68OrraQ8m+mRxcmEZFcqjRoA4Hfk4fHVhtmKDeC9lhm2m95h9tRcietLUZs0vL19vX4nJZdflh/ju+Py+Kw==')
EMAIL_DOMAIN = os.environ.get('EMAIL_DOMAIN', 'riskradar.ovh')

def generate_secure_password(length: int = 32) -> str:
    """Generate a cryptographically secure random password."""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return ''.join(secrets.choice(alphabet) for _ in range(length))

# Generate random superadmin password (or use env variable if set)
SUPERADMIN_PASSWORD = os.environ.get('SUPERADMIN_PASSWORD') or generate_secure_password(32)

# Constants
KRAKOW_CENTER_LAT = 50.0647
KRAKOW_CENTER_LON = 19.9450

# Extended Hotspots for better distribution
HOTSPOTS = [
    # (Lat, Lon, Radius, Weight)
    ((50.0619, 19.9369), 0.005, 0.05),  # Rynek (Dense)
    ((50.0520, 19.9462), 0.005, 0.05),  # Kazimierz (Dense)
    ((50.0722, 20.0371), 0.015, 0.08),  # Nowa Huta (Wider)
    ((50.0833, 19.8967), 0.020, 0.08),  # Bronowice
    ((50.0261, 19.9079), 0.020, 0.08),  # Ruczaj
    ((50.0416, 19.9515), 0.010, 0.06),  # Podgorze
    ((50.0910, 19.9350), 0.015, 0.05),  # Pradnik Bialy
    ((50.0125, 19.9805), 0.020, 0.05),  # Biezanow
    ((50.0650, 19.9000), 0.015, 0.05),  # Krowodrza
    ((50.0300, 19.9500), 0.012, 0.05),  # Bonarka/Lagiewniki
]

REPORT_CATEGORIES = [
    ("VANDALISM", "Wandalizm"),
    ("INFRASTRUCTURE", "Infrastruktura drogowa/chodników"),
    ("DANGEROUS_SITUATION", "Niebezpieczne sytuacje"),
    ("TRAFFIC_ACCIDENT", "Wypadki drogowe"),
    ("PARTICIPANT_BEHAVIOR", "Zachowania kierowców/pieszych"),
    ("PARTICIPANT_HAZARD", "Zagrożenia dla pieszych/rowerzystów/kierowców"),
    ("WASTE_ILLEGAL_DUMPING", "Śmieci/nielegalne zaśmiecanie"),
    ("BIOLOGICAL_HAZARD", "Zagrożenia biologiczne"),
    ("OTHER", "Inne")
]

REPORT_STATUSES = ["PENDING"] * 30 + ["VERIFIED"] * 60 + ["REJECTED"] * 10 

AI_CONFIDENCE_LEVELS = ["HIGH", "MEDIUM", "LOW"]

# UUIDs for consistency
SUPERADMIN_UUID = "11111111-1111-1111-1111-111111111111"  # Real superadmin with full permissions

fake = Faker(['pl_PL'])

# Realistic report templates per category
REPORT_TEMPLATES = {
    "VANDALISM": [
        ("Graffiti na murze", "Na ścianie budynku przy ul. {street} pojawiło się duże graffiti. Szpeci okolicę i wymaga usunięcia."),
        ("Zniszczona ławka w parku", "Ławka w parku została celowo zniszczona - połamane deski i pogięte metalowe elementy."),
        ("Rozbita witryna sklepowa", "Ktoś rozbił szybę wystawową sklepu. Szkło leży na chodniku, niebezpieczeństwo dla przechodniów."),
        ("Zdewastowany przystanek", "Przystanek autobusowy został zdewastowany - rozbite szyby, pomazane ściany."),
        ("Uszkodzona tablica informacyjna", "Tablica z mapą okolicy została wyrwana z podłoża i zniszczona."),
        ("Podpalony kosz na śmieci", "Ktoś podpalił kosz na śmieci, jest spalony i wymaga wymiany."),
        ("Zniszczony plac zabaw", "Huśtawka na placu zabaw ma przecięte łańcuchy, zjeżdżalnia porysowana."),
    ],
    "INFRASTRUCTURE": [
        ("Dziura w jezdni", "Duża dziura w asfalcie na ul. {street}. Zagraża bezpieczeństwu kierowców."),
        ("Uszkodzony chodnik", "Chodnik ma pęknięte płyty i wystające krawędzie - łatwo się potknąć."),
        ("Niedziałająca latarnia", "Latarnia uliczna nie świeci od kilku dni. Okolica jest bardzo ciemna wieczorami."),
        ("Zepsuta sygnalizacja świetlna", "Sygnalizacja świetlna na skrzyżowaniu mruga na żółto, nie działa prawidłowo."),
        ("Uszkodzona barierka", "Barierka ochronna przy drodze jest wygięta i nie spełnia swojej funkcji."),
        ("Zapadnięty studzienka", "Pokrywa studzienki jest poniżej poziomu jezdni, powoduje hałas przy przejeżdżaniu."),
        ("Zarośnięty chodnik", "Chodnik jest całkowicie zarośnięty krzakami, trzeba schodzić na jezdnię."),
    ],
    "DANGEROUS_SITUATION": [
        ("Wiszące kable elektryczne", "Kable elektryczne zwisają nisko nad chodnikiem przy ul. {street}. Bardzo niebezpieczne!"),
        ("Niestabilne rusztowanie", "Rusztowanie przy budowie wygląda na niestabilne, brak zabezpieczeń."),
        ("Oblodzone schody", "Schody prowadzące do przejścia podziemnego są oblodzone i bardzo śliskie."),
        ("Brak oświetlenia w tunelu", "W tunelu dla pieszych nie działają lampy, jest całkowicie ciemno."),
        ("Dzikie psy w okolicy", "W okolicy parku grasuje sfora dzikich psów, zachowują się agresywnie."),
        ("Wyciek gazu?", "Czuć silny zapach gazu w okolicy ul. {street}. Proszę o pilną kontrolę."),
        ("Otwarta studzienka bez pokrywy", "Studzienka kanalizacyjna nie ma pokrywy! Ktoś może wpaść."),
    ],
    "TRAFFIC_ACCIDENT": [
        ("Kolizja dwóch samochodów", "Na skrzyżowaniu doszło do kolizji. Oba pojazdy stoją na środku drogi."),
        ("Potrącenie rowerzysty", "Rowerzysta został potrącony przez samochód. Na miejscu są służby ratunkowe."),
        ("Samochód wjechał w słup", "Kierowca stracił panowanie i uderzył w latarnię. Słup jest uszkodzony."),
        ("Wypadek na przejściu dla pieszych", "Pieszy został potrącony na przejściu. Karetka jest w drodze."),
        ("Motocykl przewrócił się na zakręcie", "Motocyklista przewrócił się na zakręcie, leży na jezdni."),
        ("Zderzenie z tramwajem", "Samochód osobowy zderzył się z tramwajem. Ruch tramwajowy wstrzymany."),
    ],
    "PARTICIPANT_BEHAVIOR": [
        ("Agresywny kierowca", "Kierowca auta {car} zachowuje się bardzo agresywnie - wyprzedza na podwójnej ciągłej."),
        ("Pirat drogowy", "Kierowca przekracza znacznie prędkość w terenie zabudowanym."),
        ("Blokowanie przejazdu", "Kierowca celowo blokuje przejazd innym pojazdom."),
        ("Jazda pod prąd", "Widziałem samochód jadący pod prąd ulicą jednokierunkową."),
        ("Niebezpieczne wyprzedzanie", "Kierowca dostawczaka wyprzedza w miejscu niedozwolonym."),
        ("Używanie telefonu za kierownicą", "Kierowca autobusu miejskiego używa telefonu podczas jazdy."),
    ],
    "PARTICIPANT_HAZARD": [
        ("Niewidoczny pieszy", "Osoba w ciemnym ubraniu przechodzi przez ruchliwą ulicę poza przejściem."),
        ("Rowerzysta na chodniku", "Rowerzysta jedzie po chodniku z dużą prędkością, zagraża pieszym."),
        ("Hulajnoga na jezdni", "Osoba na hulajnodze elektrycznej jedzie środkiem jezdni."),
        ("Dzieci bawiące się przy drodze", "Grupa dzieci bawi się piłką tuż przy ruchliwej ulicy."),
        ("Pijany pieszy na drodze", "Osoba nietrzeźwa chodzi po jezdni, ignorując ruch samochodów."),
        ("Brak kasku na motorze", "Kierowca skutera jedzie bez kasku ochronnego."),
    ],
    "WASTE_ILLEGAL_DUMPING": [
        ("Nielegalne wysypisko śmieci", "Ktoś wyrzucił stertę śmieci w lesie przy ul. {street}. Widać meble i opony."),
        ("Przepełnione kontenery", "Kontenery na śmieci są przepełnione, odpady leżą dookoła."),
        ("Porzucona lodówka", "Przy drodze porzucono starą lodówkę. Stoi tam od tygodnia."),
        ("Śmieci w rzece", "W rzece pływają plastikowe butelki i torby. Ktoś wyrzuca tu odpady."),
        ("Wyrzucone gruz budowlany", "Na działce porzucono gruz i odpady budowlane."),
        ("Palenie śmieci", "Ktoś pali śmieci na podwórku, dym unosi się nad okolicą."),
    ],
    "BIOLOGICAL_HAZARD": [
        ("Martwy ptak", "Na chodniku leży martwy gołąb. Może być chory, proszę o usunięcie."),
        ("Gniazdo os przy wejściu", "Przy wejściu do budynku znajduje się duże gniazdo os. Niebezpieczne dla mieszkańców."),
        ("Szczury w śmietniku", "W okolicy śmietnika widziano dużo szczurów. Wymaga deratyzacji."),
        ("Kleszcze w parku", "W parku przy ul. {street} jest dużo kleszczy. Potrzebne opryski."),
        ("Barszcz Sosnowskiego", "Przy ścieżce rowerowej rośnie barszcz Sosnowskiego - roślina trująca!"),
        ("Zanieczyszczona woda w stawie", "Woda w stawie miejskim ma dziwny kolor i nieprzyjemny zapach."),
    ],
    "OTHER": [
        ("Hałas z budowy", "Prace budowlane prowadzone są w nocy, uniemożliwiając sen mieszkańcom."),
        ("Nieprawidłowe parkowanie", "Samochody regularnie parkują na trawniku przy ul. {street}."),
        ("Brak ławek w parku", "W nowym parku brakuje ławek do siedzenia."),
        ("Nieczytelny rozkład jazdy", "Rozkład jazdy na przystanku jest wyblakły i nieczytelny."),
        ("Awaria fontanny", "Fontanna miejska nie działa od miesiąca."),
        ("Zgubiony pies", "W okolicy biega zagubiony pies z obrożą. Wygląda na przyjaznego."),
    ]
}

KRAKOW_STREETS = [
    "Floriańska", "Grodzka", "Szewska", "Długa", "Starowiślna", "Dietla", "Karmelicka", 
    "Krakowska", "Kalwaryjska", "Wielicka", "Wadowicka", "Lea", "Pawia", "Lubicz",
    "Mogilska", "Bieńczycka", "Czyżyny", "Podgórska", "Limanowskiego", "Konopnickiej"
]

CAR_DESCRIPTIONS = [
    "srebrnego Volkswagena", "białego BMW", "czarnego Audi", "czerwonej Toyoty",
    "granatowego Forda", "szarej Skody", "zielonego Opla", "niebieskiego Mercedesa"
]

def get_db_connection():
    """Create a database connection with retries"""
    max_retries = 30
    for i in range(max_retries):
        try:
            conn = psycopg2.connect(DB_URL)
            conn.autocommit = True
            return conn
        except psycopg2.OperationalError as e:
            logger.warning(f"Database not ready ({i+1}/{max_retries}), retrying in 2 seconds... Error: {e}")
            time.sleep(2)
    raise Exception("Could not connect to database after many retries")

def wait_for_tables(conn):
    """Wait until required tables exist (created by other services)"""
    required_tables = ["users", "roles", "permissions", "user_roles", "report", "media_assets", "audit_logs"]
    logger.info("Waiting for tables to be created by services...")
    
    with conn.cursor() as cur:
        for _ in range(60): # Wait up to 2 minutes
            cur.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
            """)
            existing_tables = {row[0] for row in cur.fetchall()}
            
            missing = [t for t in required_tables if t not in existing_tables]
            
            # Note: "report" table in Hibernate might be named "report" or "reports" depending on config.
            # Checking if "report" exists.
            if "report" not in existing_tables: 
                 # Double check if maybe "reports" exists
                 if "reports" in existing_tables:
                     # adjust required tables locally for check if renamed
                     if "report" in missing: missing.remove("report")
            
            if not missing:
                logger.info("✅ All core tables found!")
                return
            
            logger.info(f"Waiting for tables: {missing}... Sleep 2s")
            time.sleep(2)
            
    logger.warning("⚠️ Timeout waiting for tables! Script will try to proceed but INSERTs might fail.")

def generate_hashed_password(plain_password):
    return bcrypt.hashpw(plain_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def generate_admin_jwt(user_id, email, username):
    """Generate a JWT token for the admin user to talk to media service"""
    payload = {
        "sub": user_id,
        "email": email,
        "username": username,
        "role": "admin",
        "iss": "demo-seeder",
        "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=30)
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    return token

def upload_media_file(file_path, token):
    """Upload a file to media service and return the ID, or None if failed"""
    if not os.path.exists(file_path):
        logger.warning(f"Media file not found: {file_path}")
        return None

    try:
        # Depending on if we go through Gateway or Direct
        # If Direct (localhost:8084 or media-service:8080), use /media
        # If Gateway (localhost:8080), use /api/media
        
        # We assume Direct connection for seeding speed and simplicity
        url = f"{MEDIA_SERVICE_URL}/media"
        
        # Superadmin User Details
        headers = {
            "Authorization": f"Bearer {token}",
            "X-User-ID": SUPERADMIN_UUID,
            "X-User-Role": "admin",
            "X-User-Email": "superadmin@riskradar.local",
            "X-Correlation-ID": f"seeder-{uuid.uuid4()}"
        }
        
        with open(file_path, 'rb') as f:
            files = {'file': ('image.jpg', f, 'image/jpeg')}
            # Set visibility to public so everyone can see the image
            data = {'visibility': 'public'}
            response = requests.post(url, headers=headers, files=files, data=data) 
        
        if response.status_code == 201:
            data = response.json()
            return data.get('id')
        else:
            logger.error(f"Media upload failed: {response.status_code} - {response.text}")
            return None
    except Exception as e:
        logger.error(f"Media upload exception: {e}")
        return None

def generate_location_in_krakow():
    """
    Generate a random location around Krakow with realistic distribution.
    Mix of hotspots and general city area.
    """
    r = random.random()
    
    # Increase general scatter probability (from implicit 50% to higher if weights don't sum to 1.0)
    # Let's verify weights in HOTSPOTS.
    # Rynek: 0.15, Kazimierz: 0.12, Nowa Huta: 0.10, Bronowice: 0.08, Pradnik: 0.05, Biezanow: 0.05, Krowodrza: 0.05, Bonarka: 0.05
    # Sum = 0.65. So 35% is random scatter.
    
    cumulative_weight = 0
    # HOTSPOTS: Use gauss for center-bias but with larger radius, OR uniform for spread.
    # User complained about "400 on Rynek". 
    # Current code used `random.uniform(-radius, radius)` on a box? 
    # Wait, the previous code snippet showed:
    # `lat = center[0] + random.uniform(-radius, radius)`
    # Uniform box is actually better for spread than gauss if radius is large enough.
    # But Rynek radius is 0.008 (~800m). That's small.
    # Let's increase radius or add noise.
    
    selected_hotspot = None
    
    for center, h_radius, weight in HOTSPOTS:
        cumulative_weight += weight
        if r < cumulative_weight:
            selected_hotspot = (center, h_radius)
            break
            
    if selected_hotspot:
        center, h_radius = selected_hotspot
        # Use Gaussian with larger sigma for more natural fade-out, 
        # but clamp it or just use a wider Uniform.
        # Let's use two layers: Inner core (dense) and Outer ring (spread)
        
        if random.random() < 0.7:
             # Inner radius (dense core)
             lat_offset = random.uniform(-h_radius, h_radius)
             lon_offset = random.uniform(-h_radius, h_radius)
        else:
             # Outer ring (scatter around the district) - 3x radius
             lat_offset = random.uniform(-h_radius * 3, h_radius * 3)
             lon_offset = random.uniform(-h_radius * 3, h_radius * 3)

        return center[0] + lat_offset, center[1] + lon_offset
            
    # Remaining probability -> General City Spread (Box approx ~15km)
    # 50.15 (North) to 49.97 (South)
    # 19.80 (West) to 20.10 (East)
    # Uniform distribution for less density in center
    lat = random.uniform(49.97, 50.15)
    lon = random.uniform(19.80, 20.10)
    
    return lat, lon

def wait_for_roles(conn):
    """Wait for authz-service to populate roles and permissions"""
    logger.info("Waiting for authz-service to initialize roles (migration check)...")
    cur = conn.cursor()
    timeout = 60 # seconds
    start = time.time()
    
    while time.time() - start < timeout:
        cur.execute("SELECT count(*) FROM roles WHERE name = 'admin'")
        count = cur.fetchone()[0]
        if count > 0:
            cur.execute("SELECT count(*) FROM permissions")
            p_count = cur.fetchone()[0]
            if p_count > 5: # Arbitrary check to ensure permissions are seeded
                logger.info("✅ Roles and Permissions detected.")
                return
        
        logger.info("⏳ Waiting for Roles/Permissions to appear in DB...")
        time.sleep(2)
    
    logger.error("❌ Timed out waiting for authz-service to seed roles.")
    raise Exception("Authz service did not seed roles in time. Is it running?")

def seed_data():
    conn = get_db_connection()
    wait_for_tables(conn)
    wait_for_roles(conn)
    cur = conn.cursor()


    logger.info("🚀 Starting Demo Data Seeding...")
    logger.info(f"DEMO_MODE: {DEMO_MODE}")
    
    if not DEMO_MODE:
        logger.info("❌ DEMO_MODE is disabled. Skipping seeding.")
        return

    # 1. USERS & ROLES
    # ----------------
    logger.info("Seeding Users & Roles...")
    
    logger.info("="*60)
    logger.info("🔐 SUPERADMIN CREDENTIALS:")
    logger.info(f"   username='superadmin' password='{SUPERADMIN_PASSWORD}'")
    logger.info("="*60)
    logger.info("📢 TEST ACCOUNTS:")
    logger.info("   ADMIN:      username='admin' password='admin'")
    logger.info("   MODERATOR:  username='moderator' password='moderator'")
    logger.info("   VOLUNTEER:  username='wolontariusz' password='wolontariusz'")
    logger.info("   USER:       username='uzytkownik' password='uzytkownik'")
    logger.info("="*60)
    
    users = [
        # (uuid, email, username, password_hash, role_name)
        (SUPERADMIN_UUID, f"superadmin@{EMAIL_DOMAIN}", "superadmin", generate_hashed_password(SUPERADMIN_PASSWORD), "admin"),
        (str(uuid.uuid4()), f"admin@{EMAIL_DOMAIN}", "admin", generate_hashed_password("admin"), "admin"),
        (str(uuid.uuid4()), f"moderator@{EMAIL_DOMAIN}", "moderator", generate_hashed_password("moderator"), "moderator"),
        (str(uuid.uuid4()), f"wolontariusz@{EMAIL_DOMAIN}", "wolontariusz", generate_hashed_password("wolontariusz"), "volunteer"),
        (str(uuid.uuid4()), f"uzytkownik@{EMAIL_DOMAIN}", "uzytkownik", generate_hashed_password("uzytkownik"), "user")
    ]
    
    user_map = {} # username -> uuid

    # Upsert users
    for uid, email, username, pwd, role_name in users:
        # Check if user exists (by ID) to avoid conflict, or upsert
        cur.execute("""
            INSERT INTO users (id, email, username, password, is_banned, created_at)
            VALUES (%s, %s, %s, %s, false, NOW())
            ON CONFLICT (id) DO UPDATE 
            SET username = EXCLUDED.username, 
                password = EXCLUDED.password,
                email = EXCLUDED.email;
        """, (uid, email, username, pwd))
        user_map[username] = uid
        
        # Assign Role (Assuming roles table already populated by authz-service migration)
        # We need to find role_id by name
        cur.execute("SELECT id FROM roles WHERE name = %s", (role_name,))
        res = cur.fetchone()
        if res:
            role_id = res[0]
            cur.execute("""
                INSERT INTO user_roles (user_id, role_id, assigned_at)
                VALUES (%s, %s, NOW())
                ON CONFLICT (user_id, role_id) DO NOTHING;
            """, (uid, role_id))
        else:
            logger.warning(f"Role '{role_name}' not found for user {username}")

    # 2. MEDIA ASSETS
    # ---------------
    logger.info("Seeding Media Assets via Media Service API...")
    
    # We will upload images using the Superadmin user token (full permissions)
    admin_token = generate_admin_jwt(SUPERADMIN_UUID, "superadmin@riskradar.local", "superadmin")
    
    category_media_map = {} # category_name -> media_uuid
    
    for cat_code, cat_name in REPORT_CATEGORIES:
        filename = f"{cat_code.lower()}.jpg"
        source_path = os.path.join("media", filename)
        
        # Upload via API
        media_id = upload_media_file(source_path, admin_token)
        
        if media_id:
            category_media_map[cat_code] = media_id
            logger.info(f"Uploaded media for {cat_code}: {media_id}")
        else:
            logger.warning(f"Failed to upload media for {cat_code}")

    # 3. REPORTS
    # ----------
    logger.info("Generating 2500 Reports (aiming for ~1500 Approved/Verified)...")
    
    reports_data = []
    report_images_data = []
    
    # Use realistic date range up to today (January 14, 2026)
    start_date = datetime.date(2025, 10, 1)
    end_date = datetime.date.today()  # Use current date, not future dates
    
    demo_user_ids = list(user_map.values())

    for i in range(2500):
        report_id = str(uuid.uuid4())
        
        # Distribute randomly among demo users
        owner_id = random.choice(demo_user_ids)
        
        cat_code, cat_name = random.choice(REPORT_CATEGORIES)
        status = random.choice(REPORT_STATUSES)
        
        lat, lon = generate_location_in_krakow()
        
        # Get realistic title and description from templates
        templates = REPORT_TEMPLATES.get(cat_code, REPORT_TEMPLATES["OTHER"])
        template_title, template_desc = random.choice(templates)
        
        # Fill in placeholders
        street = random.choice(KRAKOW_STREETS)
        car = random.choice(CAR_DESCRIPTIONS)
        title = template_title
        desc = template_desc.format(street=street, car=car)
        
        # Timestamp
        created_at = fake.date_time_between(start_date=start_date, end_date=end_date)
        
        # AI Fields
        ai_is_fake = False
        ai_fake_prob = None
        ai_conf = None
        ai_verified_at = None
        
        if random.random() < 0.10: # 10% chance for AI flag
            ai_is_fake = True
            ai_fake_prob = random.uniform(0.6, 0.95)
            ai_conf = random.choice(AI_CONFIDENCE_LEVELS)
            # Verify time 1-7 days after creation
            ai_verified_at = created_at + datetime.timedelta(days=random.randint(1, 7))
        
        reports_data.append((
            report_id, lat, lon, title, desc, owner_id, cat_code, status, 
            created_at, ai_is_fake, ai_fake_prob, ai_conf, ai_verified_at
        ))
        
        # Link media image if category has one
        if cat_code in category_media_map:
            report_images_data.append((report_id, category_media_map[cat_code]))

    # Batch Insert Reports
    # Note: 'report' table name might be singular in JPA default naming strategy.
    insert_query = """
        INSERT INTO report (
            id, latitude, longitude, title, description, user_id, category, status, 
            created_at, ai_is_fake, ai_fake_probability, ai_confidence, ai_verified_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO NOTHING;
    """
    execute_batch(cur, insert_query, reports_data)
    
    # Batch Insert Report Images (ElementCollection)
    # Using 'report_image_ids' as default JPA table name for @ElementCollection List<UUID> imageIds
    insert_imgs_query = """
        INSERT INTO report_image_ids (report_id, image_ids) 
        VALUES (%s, %s)
        ON CONFLICT DO NOTHING;
    """
    execute_batch(cur, insert_imgs_query, report_images_data)

    # 4. AUDIT LOGS
    # -------------
    logger.info("Generating Audit Logs...")
    audit_entries = []
    
    actions = [
        ("USER_LOGIN_SUCCESS", "SECURITY"), 
        ("USER_LOGIN_FAILED", "SECURITY"),
        ("REPORT_CREATE", "ACTION"),
        ("REPORT_STATUS_CHANGE", "ACTION"),
        ("USER_BAN", "SECURITY"),
        ("MEDIA_UPLOAD", "ACTION")
    ]
    
    for _ in range(200):
        action, log_type = random.choice(actions)
        actor_id = random.choice(demo_user_ids)
        ts = fake.date_time_between(start_date=start_date, end_date=end_date)
        
        audit_entries.append((
            str(uuid.uuid4()), ts, "demo-seeder", action, 
            Json({"id": actor_id, "username": "demo"}), 
            Json({"target": "system"}), 
            "success", str(uuid.uuid4()), log_type
        ))

    execute_batch(cur, """
        INSERT INTO audit_logs (
            id, timestamp, service, action, actor, target, status, operation_id, log_type
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO NOTHING;
    """, audit_entries)
    
    # 5. NOTIFICATIONS
    # ----------------
    logger.info("Generating Notifications...")
    # NOTE: Schema for notifications_inbox: 
    # id, user_id, event_id, event_type, title, body, metadata, is_read, ...
    # IMPORTANT: event_type must match notification-service templates (see validation/schemas.ts)
    
    notif_data = []
    # These event_types match notification-service's template-definitions.ts
    notif_templates = [
        # Report status changes (REPORT_STATUS_CHANGED)
        ("REPORT_STATUS_CHANGED", "Zmiana statusu zgłoszenia", "Status Twojego zgłoszenia 'Dziura w jezdni przy ul. Dietla' został zmieniony na: VERIFIED"),
        ("REPORT_STATUS_CHANGED", "Zgłoszenie zweryfikowane", "Status Twojego zgłoszenia 'Wandalizm na Plantach' został zmieniony na: VERIFIED"),
        ("REPORT_STATUS_CHANGED", "Zgłoszenie odrzucone", "Status Twojego zgłoszenia 'Uszkodzona latarnia' został zmieniony na: REJECTED"),
        ("REPORT_STATUS_CHANGED", "Zgłoszenie w trakcie realizacji", "Status Twojego zgłoszenia 'Nielegalne wysypisko śmieci' został zmieniony na: IN_PROGRESS"),
        
        # AI verification (REPORT_AI_VERIFIED)
        ("REPORT_AI_VERIFIED", "Raport zweryfikowany przez AI", "Twój raport dotyczący uszkodzonej infrastruktury został automatycznie zweryfikowany przez system AI."),
        ("REPORT_AI_VERIFIED", "Automatyczna weryfikacja zakończona", "System AI zakończył weryfikację Twojego zgłoszenia. Raport został oznaczony jako wiarygodny."),
        
        # AI flagged reports (REPORT_AI_FLAGGED)
        ("REPORT_AI_FLAGGED", "Raport oznaczony przez AI", "Twój raport został oznaczony jako wymagający dodatkowej weryfikacji przez moderatora."),
        ("REPORT_AI_FLAGGED", "Zgłoszenie wymaga uwagi", "System AI wykrył potencjalne nieścisłości. Moderator sprawdzi zgłoszenie."),
        
        # Fake report detected (FAKE_REPORT_DETECTED)
        ("FAKE_REPORT_DETECTED", "Wykryto podejrzany raport", "Twój raport został oznaczony jako potencjalnie nieprawdziwy. Skontaktuj się z moderatorem."),
        
        # Media operations (MEDIA_APPROVED, MEDIA_REJECTED, MEDIA_FLAGGED_NSFW)
        ("MEDIA_APPROVED", "Plik zatwierdzony", "Twoje zdjęcie dołączone do zgłoszenia zostało zatwierdzone i jest teraz widoczne."),
        ("MEDIA_REJECTED", "Plik odrzucony", "Twoje zdjęcie zostało odrzucone. Powód: Niewyraźne zdjęcie, proszę dodać lepszej jakości."),
        ("MEDIA_FLAGGED_NSFW", "Plik oznaczony jako wrażliwy", "Twoje zdjęcie zostało oznaczone jako zawierające treści wymagające weryfikacji."),
        
        # Role changes (ROLE_ASSIGNED, ROLE_REVOKED)
        ("ROLE_ASSIGNED", "Nowa rola przypisana", "Gratulacje! Zostałeś awansowany na wolontariusza. Możesz teraz weryfikować zgłoszenia."),
        ("ROLE_REVOKED", "Rola cofnięta", "Twoja rola moderatora została tymczasowo zawieszona. Skontaktuj się z administratorem."),
        
        # User account (USER_REGISTERED, USER_BANNED, USER_UNBANNED)
        ("USER_REGISTERED", "Witaj w serwisie!", "Twoje konto w Risk Radar zostało pomyślnie utworzone. Zacznij zgłaszać zagrożenia!"),
        ("USER_UNBANNED", "Konto odblokowane", "Twoje konto zostało odblokowane. Możesz ponownie korzystać z systemu Risk Radar."),
        
        # Report created (REPORT_CREATED) 
        ("REPORT_CREATED", "Zgłoszenie utworzone", "Twoje zgłoszenie 'Uszkodzona nawierzchnia przy Rynku' zostało przyjęte do weryfikacji."),
        ("REPORT_CREATED", "Nowe zgłoszenie zarejestrowane", "Dziękujemy za zgłoszenie! Twój raport został przekazany do weryfikacji przez AI."),
        
        # Security alerts (AUDIT_SECURITY_EVENT_DETECTED)
        ("AUDIT_SECURITY_EVENT_DETECTED", "Alert bezpieczeństwa", "Wykryto logowanie z nowego urządzenia. Jeśli to nie Ty, zmień hasło."),
    ]
    
    # Welcome demo notification for each user (unread)
    WELCOME_DEMO_NOTIFICATION = (
        "USER_REGISTERED",
        "🎉 Witaj w trybie demo!",
        "To jest konto demonstracyjne systemu Risk Radar. Wszystkie funkcje działają w trybie demo - możesz swobodnie testować zgłaszanie zdarzeń, przeglądanie mapy i inne opcje. Dane są resetowane okresowo."
    )
    
    for uid in demo_user_ids:
        # First add the welcome demo notification (always unread, newest)
        notif_data.append((
            str(uuid.uuid4()), uid, str(uuid.uuid4()), 
            WELCOME_DEMO_NOTIFICATION[0], WELCOME_DEMO_NOTIFICATION[1], WELCOME_DEMO_NOTIFICATION[2], 
            Json({"demo": True}), False, datetime.datetime.now()
        ))
        
        # Generate 5 read notifications for each user
        for i in range(5):
            evt_type, title, body = random.choice(notif_templates)
            ts = fake.date_time_between(start_date=start_date, end_date=end_date)
            
            notif_data.append((
                str(uuid.uuid4()), uid, str(uuid.uuid4()), evt_type, title, body, 
                Json({}), True, ts
            ))

    execute_batch(cur, """
        INSERT INTO notifications_inbox (
            id, user_id, event_id, event_type, title, body, metadata, is_read, created_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO NOTHING;
    """, notif_data)

    logger.info("✅ Demo Data Seeding Completed!")
    conn.close()

if __name__ == "__main__":
    # Optional: clean_database() # Uncomment to force clean before seed
    seed_data()
