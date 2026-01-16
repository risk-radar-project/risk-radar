#!/bin/bash
set -e

# Wait for Postgres to be ready
echo "Waiting for Postgres at $DATABASE_URL..."

# Parse host and port from DATABASE_URL for pg_isready
# Simplified check using just sleep loop for now or pg_isready if available
# DATABASE_URL format: postgres://user:pass@host:5432/db

until pg_isready -d "$DATABASE_URL"; do
  echo "Postgres is unavailable - sleeping"
  sleep 2
done

echo "Postgres is up! Starting seeder..."

# First clean, then seed (to support reset scenario)
# Only if DEMO_MODE is true
if [ "$DEMO_MODE" = "true" ]; then
    echo "DEMO_MODE is enabled. Cleaning old demo data..."
    # Auto-confirm with 'yes'
    echo "yes" | python clean_db.py
    
    echo "Seeding new demo data..."
    python seeder.py
else
    echo "DEMO_MODE is false. Exiting without changes."
fi
