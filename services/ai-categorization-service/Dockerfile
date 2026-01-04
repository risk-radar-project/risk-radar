FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create non-root user for security
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run FastAPI and then tests without a separate shell script
CMD bash -c "\
    python main.py & \
    APP_PID=\$!; \
    echo '[ai-categorization-service] Waiting for FastAPI service...'; \
    for i in {1..15}; do \
        if curl -s http://localhost:8080/health >/dev/null; then \
            echo '[ai-categorization-service] Service is up!'; \
            break; \
        fi; \
        echo '[ai-categorization-service] Waiting... (\$i)'; \
        sleep 2; \
    done; \
    echo '[ai-categorization-service] Running tests...'; \
    python test_app.py; \
    echo '[ai-categorization-service] Tests finished'; \
    wait \$APP_PID"
