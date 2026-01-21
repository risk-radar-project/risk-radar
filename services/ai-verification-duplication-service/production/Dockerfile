# =============================================================================
# AI Verification-Duplication Service Docker Image
# Multi-stage build for optimized image size
# =============================================================================

# Stage 1: Build dependencies
FROM python:3.11-slim AS builder

WORKDIR /app

# Install build tools for native extensions
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Stage 2: Final runtime image
FROM python:3.11-slim

WORKDIR /app

# Install Git LFS for model file verification
RUN apt-get update && apt-get install -y \
    git \
    git-lfs \
    && git lfs install \
    && rm -rf /var/lib/apt/lists/*

# Copy installed dependencies from builder stage
COPY --from=builder /install /usr/local
COPY . .

# Verify model files are actual data (not Git LFS pointers)
RUN echo "Verifying AI model files..." && \
    ls -la && \
    if [ ! -f detector_model_components/bert_model_finetuned.pth ]; then \
    echo "ERROR: detector_model_components/bert_model_finetuned.pth not found!" && \
    echo "Please ensure the model files are present. If using Git LFS, run 'git lfs pull'." && \
    exit 1; \
    fi && \
    if head -c 50 detector_model_components/bert_model_finetuned.pth | grep -q "version https://git-lfs"; then \
    echo "ERROR: bert_model_finetuned.pth is a Git LFS pointer!" && \
    echo "Run 'git lfs pull' before building Docker image." && \
    exit 1; \
    fi && \
    echo "Model files OK"

EXPOSE 8080

CMD ["python", "main.py"]
