# Contexto de build: la raíz del repo (docker build -f environment/api.Dockerfile .)
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PIP_NO_CACHE_DIR=1

# El código espera api/, models/ y artefactos/ como hermanas (config.py usa ../artefactos y ../models)
WORKDIR /app/api

COPY src/api/requirements.txt .
RUN pip install -r requirements.txt

COPY src/api /app/api
COPY src/models /app/models

RUN useradd --system --no-create-home cinestart
USER cinestart

EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
    CMD python -c "import urllib.request as u; u.urlopen('http://127.0.0.1:8000/salud', timeout=4)"

# Un solo proceso: el catálogo vive en memoria y el motor usa un cerrojo de hilos
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
