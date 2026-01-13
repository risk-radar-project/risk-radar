import os
import time
import psycopg2
import logging
import redis
from psycopg2.extras import DictCursor
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('cleaner')

# Database configuration
DB_URL = os.environ.get('DATABASE_URL')
REDIS_HOST = os.environ.get('REDIS_HOST', 'localhost')
REDIS_PORT = int(os.environ.get('REDIS_PORT', 6379))

def clean_redis():
    try:
        r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
        r.flushall()
        logger.info("🧹 Redis flushed successfully!")
    except Exception as e:
        logger.warning(f"Failed to flush Redis: {e}")

def get_db_connection():
    """Create a database connection with retries"""
    while True:
        try:
            conn = psycopg2.connect(DB_URL)
            conn.autocommit = True
            return conn
        except psycopg2.OperationalError as e:
            logger.warning(f"Database not ready, retrying in 2 seconds... Error: {e}")
            time.sleep(2)

def clean_database():
    """
    Wipes all data from the database to allow fresh testing.
    Preserves schema (tables, constraints) but removes all rows.
    """
    logger.info("🔥 STARTING FULL DATABASE CLEANUP...")
    
    conn = get_db_connection()
    try:
        cur = conn.cursor()
        
        # Order matters due to foreign keys!
        tables_to_truncate = [
            "audit_logs",
            "notifications_inbox",
            "email_jobs",
            "event_dispatch_log",
            "notification_rules",
            "notification_templates",
            "report_image_ids", # ElementCollection for Report
            "report",
            "role_permissions",
            "user_roles",
            "permissions",
            "roles",
            "users",
            "media_assets",
            # Add other tables here if needed
        ]
        
        for table in tables_to_truncate:
            logger.info(f"Binary nuking table: {table}")
            try:
                # CASCADE is needed to handle FK constraints automatically
                cur.execute(f"TRUNCATE TABLE {table} CASCADE;")
            except psycopg2.errors.UndefinedTable:
                logger.warning(f"Table {table} does not exist, skipping.")
            except Exception as e:
                logger.error(f"Error truncating {table}: {e}")

        logger.info("✅ Database cleaned successfully!")
        
    except Exception as e:
        logger.error(f"❌ Custom cleanup failed: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    # Check for FORCE_CLEAN env var to skip prompt
    if os.environ.get('FORCE_CLEAN', 'false').lower() == 'true':
        logger.info("🔥 FORCE_CLEAN enabled. Skipping confirmation.")
        clean_redis()
        clean_database()
    else:
        confirm = input("⚠️  WARNING: This will DELETE ALL DATA from the database. Type 'yes' to confirm: ")
        if confirm.lower() == 'yes':
            logger.info("🔥 STARTING FULL DATABASE CLEANUP...")
            clean_redis()
            clean_database()
        else:
            logger.info("Cleanup cancelled.")
