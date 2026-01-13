# Demo Data Seeder

This service populates the Risk Radar database with initial demo data.

## Local Development Setup

If you want to run or modify this script locally (outside of Docker), follow these steps to set up your Python environment.

### 1. Prerequisites
- Python 3.11 or higher installed on your machine.
- PostgreSQL database running (localhost:5432).

### 2. Create Virtual Environment (.venv)
Open a terminal in this directory:
```bash
# Windows (PowerShell)
python -m venv .venv

# Activate the virtual environment
.\.venv\Scripts\Activate.ps1
```

If you get a permission error on PowerShell, run: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

### 3. Install Dependencies
With the virtual environment activated:
```bash
pip install -r requirements.txt
```

### 4. Configuration
You need to set environment variables to connect to your local database. Create a `.env` file or set them in your shell:

```powershell
$env:DATABASE_URL="postgres://risk-radar-admin:passwd@localhost:5432/risk-radar"
$env:DEMO_MODE="true"
$env:ADMIN_PASSWORD="supersekretnehaslo"
```

### 5. Run the Seeder
```bash
python seeder.py
```

### 6. Clean Database (Optional)
To wipe the demo data:
```bash
python clean_db.py
```
