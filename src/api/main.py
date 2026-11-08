"""
CineStart · API (FastAPI)

    cd api
    uvicorn main:app --reload        ->  http://localhost:8000/docs

Conecta la web con Neon (PostgreSQL), MongoDB Atlas, la API de TMDB y el motor de models/.
"""
import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import catalogo
import config
import db
import mongo
import tmdb
from rutas import admin, auth, biblioteca, peliculas

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("cinestart")


@asynccontextmanager
async def arranque(app: FastAPI):
    db.abrir()
    log.info("PostgreSQL (Neon) conectado")
    try:
        mongo.abrir()
        if mongo.activo():
            log.info("MongoDB conectado")
    except Exception as e:  # sin Mongo la API sigue funcionando
        log.error("No se pudo conectar a MongoDB (%s): sigo sin él", e)
    tmdb.abrir()
    catalogo.cargar()
    parar = threading.Event()

    def recargar_cada_5_min():
        while not parar.wait(300):
            catalogo.recargar_todo()

    threading.Thread(target=recargar_cada_5_min, daemon=True).start()
    yield
    parar.set()
    db.cerrar()


app = FastAPI(title="CineStart API", version="1.0", lifespan=arranque)
app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_credentials=False,
                   allow_methods=["*"], allow_headers=["*"])


@app.exception_handler(RequestValidationError)
async def datos_no_validos(request: Request, exc: RequestValidationError):
    # La web muestra `detail` tal cual: un texto en castellano mejor que la lista técnica de Pydantic
    campos = ", ".join(str(e["loc"][-1]) for e in exc.errors())
    return JSONResponse(status_code=422, content={"detail": f"Revisa estos datos: {campos}.", "errors": jsonable_encoder(exc.errors())})


@app.get("/salud")
def salud():
    return {
        "postgres": "ok",
        "mongodb": "ok" if mongo.activo() else "no configurado",
        "tmdb": "ok" if tmdb.activo() else "no configurado",
        "peliculas": len(catalogo.peliculas),
        "modelo": catalogo.MODEL_VERSION,
    }


for r in (auth.router, peliculas.router, biblioteca.router, admin.router):
    app.include_router(r)
