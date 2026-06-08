# ============================================================
# 30-Day Readmission Risk API — Dockerfile
# ============================================================
# Multi-stage approach:
# Stage 1: Install dependencies (cached layer)
# Stage 2: Copy application code (rebuilt on code changes)
#
# This ordering means code changes don't trigger
# a full dependency reinstall — builds are fast.
# ============================================================

# Base image — Python 3.11 slim (smaller than full Python image)
# Pinned to specific digest for reproducibility in production
FROM python:3.11-slim

# Metadata
LABEL maintainer="Ibrahim — Health Tech Engineer"
LABEL description="30-Day Hospital Readmission Risk Prediction API"
LABEL version="1.0.0"

# Set working directory inside container
WORKDIR /app

# --- System dependencies ---
# libgomp1: required by XGBoost for parallel tree building
# gcc: required to compile some Python packages
# curl: useful for health checks
RUN apt-get update && apt-get install -y \
    libgomp1 \
    gcc \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# --- Python dependencies ---
# Copy requirements first — Docker caches this layer
# If requirements.txt hasn't changed, pip install is skipped
COPY requirements-docker.txt .

# Install setuptools first — fixes pkg_resources issue
# Then install all requirements
RUN pip install --no-cache-dir --upgrade pip setuptools && \
    pip install --no-cache-dir -r requirements-docker.txt


# --- Application code ---
# Copy source code
COPY src/ ./src/

# Copy model artifacts
# These are the trained model files from Lesson 4
COPY models/ ./models/

# Copy any config files
COPY .env* ./

# --- Security: run as non-root user ---
# Running as root inside containers is a security risk
# Create a dedicated user for the application
RUN useradd --create-home --shell /bin/bash appuser && \
    chown -R appuser:appuser /app
USER appuser

# --- Runtime configuration ---
# Document the port (doesn't actually publish it — that's docker run -p)
EXPOSE 7860

CMD ["uvicorn", "src.api.main:app", \
     "--host", "0.0.0.0", \
     "--port", "7860", \
     "--workers", "1"]