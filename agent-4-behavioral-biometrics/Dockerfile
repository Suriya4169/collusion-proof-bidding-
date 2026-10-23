# Agent 4 scoring service. Serving needs only numpy + fastapi + pydantic + uvicorn:
# the model is a JSON bundle, so no scikit-learn, pandas or pickle is in the image.
FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY agent4/ agent4/
COPY models/ models/

# Run as an unprivileged user; the model directory is read-only to it.
RUN useradd --system --uid 10001 --no-create-home --shell /usr/sbin/nologin agent4 \
    && chown -R root:root /app && chmod -R a+rX /app
USER agent4

ENV AGENT4_MODEL_DIR=/app/models \
    AGENT4_LOG_LEVEL=INFO

EXPOSE 8000

# Fails the container (and so the orchestrator restarts it) if the model is not loaded.
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
    CMD python -c "import json,sys,urllib.request; d=json.load(urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=2)); sys.exit(0 if d.get('model_loaded') else 1)"

CMD ["uvicorn", "agent4.service:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
