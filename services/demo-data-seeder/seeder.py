import os
import time
import uuid
import random
import logging
import datetime
import bcrypt
import shutil
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
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')
MEDIA_SERVICE_URL = os.environ.get('MEDIA_SERVICE_URL', 'http://media-service:8080')
JWT_SECRET = os.environ.get('JWT_SECRET', 'aSV68OrraQ8m+mRxcmEZFcqjRoA4Hfk4fHVhtmKDeC9lhm2m95h9tRcietLUZs0vL19vX4nJZdflh/ju+Py+Kw==')

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
ADMIN_UUID = "11111111-1111-1111-1111-111111111111"

fake = Faker(['pl_PL'])

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
        
        # Admin User Details
        headers = {
            "Authorization": f"Bearer {token}",
            "X-User-ID": ADMIN_UUID,
            "X-User-Role": "admin",
            "X-User-Email": "admin@riskradar.local",
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

def ensure_roles(conn):
    """Ensure basic roles and permissions exist if they were wiped"""
    logger.info("Verifying/Restoring Roles and Permissions...")
    cur = conn.cursor()
    
    # 1. Insert Roles
    roles = ["admin", "moderator", "volunteer", "user"]
    for r in roles:
        cur.execute("INSERT INTO roles (name) VALUES (%s) ON CONFLICT (name) DO NOTHING", (r,))
    
    # 2. Insert Basic Permissions (Simplified)
    # This is a fallback. Ideally authz-service handles this complexity.
    # We will just recreate basic ones needed for demo interactions.
    
    permissions = [
        # Resource, Action, Name
        ("system", "*", "*:*"), 
        ("reports", "create", "reports:create"),
        ("reports", "read", "reports:read"),
        ("media", "update", "media:update"),
        ("media", "read-all", "media:read-all"),
        ("media", "upload", "media:upload") # If exists
    ]
    
    for res, act, name in permissions:
        cur.execute("""
            INSERT INTO permissions (name, resource, action) 
            VALUES (%s, %s, %s) 
            ON CONFLICT (name) DO NOTHING
        """, (name, res, act))

    # 3. Link Admin to *:*
    cur.execute("SELECT id FROM roles WHERE name = 'admin'")
    admin_role_id = cur.fetchone()[0]
    
    cur.execute("SELECT id FROM permissions WHERE name = '*:*'")
    perm_id = cur.fetchone()[0]
    
    cur.execute("""
        INSERT INTO role_permissions (role_id, permission_id) 
        VALUES (%s, %s)
        ON CONFLICT (role_id, permission_id) DO NOTHING
    """, (admin_role_id, perm_id))
    
    # 4. Link User to reports:create/read
    cur.execute("SELECT id FROM roles WHERE name = 'user'")
    user_role_id = cur.fetchone()[0]
    
    cur.execute("SELECT id FROM permissions WHERE name IN ('reports:create', 'reports:read')")
    for row in cur.fetchall():
        cur.execute("""
            INSERT INTO role_permissions (role_id, permission_id) 
            VALUES (%s, %s)
            ON CONFLICT (role_id, permission_id) DO NOTHING
        """, (user_role_id, row[0]))

    logger.info("Roles and Permissions ensured.")

def seed_data():
    conn = get_db_connection()
    wait_for_tables(conn)
    ensure_roles(conn) # New Step
    cur = conn.cursor()


    logger.info("🚀 Starting Demo Data Seeding...")
    logger.info(f"DEMO_MODE: {DEMO_MODE}")
    
    if not DEMO_MODE:
        logger.info("❌ DEMO_MODE is disabled. Skipping seeding.")
        return

    # 1. USERS & ROLES
    # ----------------
    logger.info("Seeding Users & Roles...")
    
    hashed_password = generate_hashed_password("admin123") # Default password for non-admin demo users
    hashed_admin_password = generate_hashed_password(ADMIN_PASSWORD)

    users = [
        # (uuid, email, username, password_hash, role_name)
        # Note: We create BOTH 'admin' and 'superadmin' to be safe with login variations
        (ADMIN_UUID, "admin@riskradar.local", "admin", hashed_admin_password, "admin"), 
        (str(uuid.uuid4()), "superadmin@riskradar.local", "superadmin", hashed_admin_password, "admin"),
        (str(uuid.uuid4()), "moderator@demo.pl", "moderator", hashed_password, "moderator"),
        (str(uuid.uuid4()), "wolontariusz@demo.pl", "wolontariusz", hashed_password, "volunteer"),
        (str(uuid.uuid4()), "user@demo.pl", "uzytkownik", hashed_password, "user")
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
    
    # We will upload images using the Admin user token
    admin_token = generate_admin_jwt(ADMIN_UUID, "admin@riskradar.local", "superadmin")
    
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
    
    start_date = datetime.date(2025, 10, 1)
    end_date = datetime.date(2026, 2, 28)
    
    demo_user_ids = list(user_map.values())

    for i in range(2500):
        report_id = str(uuid.uuid4())
        
        # Distribute randomly among demo users
        owner_id = random.choice(demo_user_ids)
        
        cat_code, cat_name = random.choice(REPORT_CATEGORIES)
        status = random.choice(REPORT_STATUSES)
        
        lat, lon = generate_location_in_krakow()
        
        # Real-ish title description
        title = fake.sentence(nb_words=4).replace(".", "")
        desc = fake.paragraph(nb_sentences=2)
        
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
    
    notif_data = []
    notif_templates = [
        ("REPORT_APPROVED", "Twoje zgłoszenie zostało zaakceptowane", "Dziękujemy za wkład w bezpieczeństwo."),
        ("REPORT_REJECTED", "Zgłoszenie odrzucone", "Twoje zgłoszenie narusza regulamin."),
        ("AI_FLAGGED", "Weryfikacja AI", "System oznaczył Twoje zgłoszenie do dodatkowej weryfikacji.")
    ]
    
    for uid in demo_user_ids:
        # Generate 5 read, 1 unread for each user
        for i in range(6):
            is_read = (i < 5)
            evt_type, title, body = random.choice(notif_templates)
            
            notif_data.append((
                str(uuid.uuid4()), uid, str(uuid.uuid4()), evt_type, title, body, 
                Json({}), is_read, datetime.datetime.now()
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
