"""Valoraciones, descartes («No me interesa») y Mi lista."""
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

import catalogo as cat
import db
from seguridad import get_user

router = APIRouter()
VACIO = Response(status_code=204)


class Valoracion(BaseModel):
    rating: int = Field(ge=1, le=5)
    source: str = "recommendation"


class Descarte(BaseModel):
    movie_id: int


def _origen_bd(source):
    # En Neon la columna `source` usa «onboarding» o «manual»
    return "onboarding" if source == "onboarding" else "manual"


def _origen_web(source):
    return "onboarding" if source == "onboarding" else "recommendation"


def _existe(movie_id):
    if not cat.asegurar(movie_id):
        raise HTTPException(404, "Película no encontrada.")


# ------------------------------------------------------------------ valoraciones
@router.get("/valoraciones")
def valoraciones(user=Depends(get_user)):
    filas = db.filas("SELECT movie_id, rating, source, created_at FROM ratings WHERE user_id = %s ORDER BY created_at DESC",
                     (user["id"],))
    return [{"movie_id": r["movie_id"], "rating": r["rating"], "source": _origen_web(r["source"]),
             "created_at": db.iso(r["created_at"])} for r in filas]


@router.put("/valoraciones/{movie_id}")
def valorar(movie_id: int, datos: Valoracion, user=Depends(get_user)):
    _existe(movie_id)
    uid = user["id"]
    with db.transaccion() as c:
        cambiadas = c.execute("UPDATE ratings SET rating = %s WHERE user_id = %s AND movie_id = %s",
                              (datos.rating, uid, movie_id)).rowcount
        if not cambiadas:
            c.execute("INSERT INTO ratings (user_id, movie_id, rating, source, created_at) VALUES (%s, %s, %s, %s, %s)",
                      (uid, movie_id, datos.rating, _origen_bd(datos.source), db.ahora()))
        c.execute("DELETE FROM dismissals WHERE user_id = %s AND movie_id = %s", (uid, movie_id))
    r = db.fila("SELECT movie_id, rating, source, created_at FROM ratings WHERE user_id = %s AND movie_id = %s", (uid, movie_id))
    return {"movie_id": movie_id, "rating": r["rating"], "source": _origen_web(r["source"]), "created_at": db.iso(r["created_at"])}


@router.delete("/valoraciones/{movie_id}", status_code=204)
def borrar_valoracion(movie_id: int, user=Depends(get_user)):
    db.ejecutar("DELETE FROM ratings WHERE user_id = %s AND movie_id = %s", (user["id"], movie_id))
    return VACIO


# ------------------------------------------------------------------ descartes
@router.get("/descartes")
def descartes(user=Depends(get_user)):
    return [r["movie_id"] for r in db.filas("SELECT movie_id FROM dismissals WHERE user_id = %s", (user["id"],))]


@router.post("/descartes", status_code=204)
def descartar(datos: Descarte, user=Depends(get_user)):
    _existe(datos.movie_id)     # dismissals.movie_id tiene clave foránea a movies
    if not db.fila("SELECT 1 FROM dismissals WHERE user_id = %s AND movie_id = %s", (user["id"], datos.movie_id)):
        db.ejecutar("INSERT INTO dismissals (user_id, movie_id, created_at) VALUES (%s, %s, %s)", (user["id"], datos.movie_id, db.ahora()))
    return VACIO


@router.delete("/descartes/{movie_id}", status_code=204)
def deshacer_descarte(movie_id: int, user=Depends(get_user)):
    db.ejecutar("DELETE FROM dismissals WHERE user_id = %s AND movie_id = %s", (user["id"], movie_id))
    return VACIO


# ------------------------------------------------------------------ Mi lista
@router.get("/lista")
def mi_lista(user=Depends(get_user)):
    filas = db.filas("SELECT movie_id, added_at FROM user_list WHERE user_id = %s ORDER BY added_at DESC", (user["id"],))
    return [{"movie_id": r["movie_id"], "added_at": db.iso(r["added_at"])} for r in filas]


@router.put("/lista/{movie_id}", status_code=204)
def anadir(movie_id: int, user=Depends(get_user)):
    _existe(movie_id)
    db.ejecutar("INSERT INTO user_list (user_id, movie_id, added_at) VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
                (user["id"], movie_id, db.ahora()))
    return VACIO


@router.delete("/lista/{movie_id}", status_code=204)
def quitar(movie_id: int, user=Depends(get_user)):
    db.ejecutar("DELETE FROM user_list WHERE user_id = %s AND movie_id = %s", (user["id"], movie_id))
    return VACIO
