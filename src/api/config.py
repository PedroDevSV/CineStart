"""Configuración: todo sale del archivo .env (que NO se sube a GitHub)."""
import os
from pathlib import Path

from dotenv import load_dotenv

AQUI = Path(__file__).resolve().parent
load_dotenv(AQUI / ".env")

# Neon: libpq lee solo PGHOST, PGDATABASE, PGUSER, PGPASSWORD, PGSSLMODE y PGCHANNELBINDING.
# Si preferís una sola línea, poned DATABASE_URL=postgresql://... y se usa esa.
DATABASE_URL = os.getenv("DATABASE_URL", "")

MONGO_URI = os.getenv("MONGO_URI", "")
MONGO_DB = os.getenv("MONGO_DB", "cinestart")
MONGO_DETALLES = os.getenv("MONGO_COLECCION_DETALLES", "movie_details")
MONGO_CONTACTOS = os.getenv("MONGO_COLECCION_CONTACTOS", "user_contacts")

TMDB_TOKEN = os.getenv("TMDB_TOKEN", "")          # «token de lectura» (v4) de TMDB

JWT_SECRET = os.getenv("JWT_SECRET", "")
JWT_DIAS = int(os.getenv("JWT_DIAS", "7"))

ARTEFACTOS = Path(os.getenv("ARTEFACTOS", AQUI.parent / "artefactos"))
CARPETA_MODELS = Path(os.getenv("CARPETA_MODELS", AQUI.parent / "models"))

CORS_ORIGINS = [o.strip() for o in os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5180,http://127.0.0.1:5180",
).split(",") if o.strip()]

if not JWT_SECRET:
    raise SystemExit("Falta JWT_SECRET en api/.env (una cadena larga y aleatoria).")
