# Enterprise Production Dockerfile for ProcureGuard-AI Backend
#
# Build from the REPOSITORY ROOT (docker compose does this): the backend loads the Agent 2C, 3 and 4 folders
# that sit next to backend/, and the route modules find them relative to their own location.
#   docker build -f backend/Dockerfile -t procureguard-backend .
FROM python:3.12-slim AS builder

WORKDIR /app

# Install system build dependencies for C-extensions (PyMuPDF, sentence-transformers)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .

# Install dependencies into virtualenv / wheel cache
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Final Runtime Image
FROM python:3.12-slim AS runner

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Same layout as the repository, so the relative paths in src/main.py, src/api/routes/cartel.py and
# src/services/behavior_signals.py hold.
COPY backend/ /app/backend/
COPY cartel-graph/ /app/cartel-graph/
COPY agent-4-behavioral-biometrics/ /app/agent-4-behavioral-biometrics/
COPY solvency-calculator/ /app/solvency-calculator/
WORKDIR /app/backend

# Ensure storage directories exist
RUN mkdir -p test_data/uploads test_data/vault_storage

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
