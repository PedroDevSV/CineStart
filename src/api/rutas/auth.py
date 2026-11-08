"""Registro, login, «yo» y géneros favoritos."""
import re

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

import db
import mongo
from seguridad import crear_token, get_user, hash_password, password_ok

router = APIRouter()
ALIAS = re.compile(r"^[A-Za-z0-9_.-]{3,30}$")
EMAIL = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class Registro(BaseModel):
    alias: str
    email: str
    password: str


class Login(BaseModel):
    alias: str
    password: str


class Generos(BaseModel):
    genre_ids: list[int]


def usuario_publico(u):
    """El objeto `user` que espera la web."""
    n = db.fila("SELECT count(*) AS n FROM ratings WHERE user_id = %s", (u["id"],))["n"]
    generos = [r["genre_id"] for r in db.filas("SELECT genre_id FROM user_genre WHERE user_id = %s", (u["id"],))]
    return {
        "id": u["id"], "alias": u["alias"], "email": mongo.email_de(u["id"]), "role": u["role"],
        "genre_ids": generos, "created_at": db.iso(u["created_at"]),
        "onboarded": u["role"] == "admin" or n >= 3, "ratings_count": n,
    }


@router.post("/auth/registro", status_code=201)
def registro(datos: Registro):
    alias, email = datos.alias.strip(), datos.email.strip().lower()
    errores = []
    if not ALIAS.match(alias):
        errores.append("El alias debe tener entre 3 y 30 caracteres: letras, números, punto, guion o guion bajo.")
    if not EMAIL.match(email):
        errores.append("Introduce un email válido.")
    if len(datos.password) < 8:
        errores.append("La contraseña debe tener al menos 8 caracteres.")
    if errores:
        raise HTTPException(422, " · ".join(errores))
    if db.fila("SELECT 1 FROM users WHERE lower(alias) = lower(%s)", (alias,)):
        raise HTTPException(409, "Ese alias ya está en uso. Prueba con otro.")
    if mongo.email_existe(email):
        raise HTTPException(409, "Ya hay una cuenta con ese email.")
    clave = hash_password(datos.password)
    with db.transaccion() as c:
        nuevo_id = db.siguientes_ids(c, "users")[0]
        u = c.execute("""INSERT INTO users (id, alias, password_hash, role, active, created_at)
                         VALUES (%s, %s, %s, 'user', true, %s) RETURNING id, alias, role, active, created_at""",
                      (nuevo_id, alias, clave, db.ahora())).fetchone()
    mongo.guardar_email(u["id"], email)   # el email (IIP) no va a PostgreSQL
    return {"access_token": crear_token(u["id"]), "token_type": "bearer", "user": usuario_publico(u)}


@router.post("/auth/login")
def login(datos: Login):
    u = db.fila("SELECT id, alias, role, active, created_at, password_hash FROM users WHERE lower(alias) = lower(%s)",
                (datos.alias.strip(),))
    if not u or not password_ok(datos.password, u["password_hash"]):
        raise HTTPException(401, "Alias o contraseña incorrectos.")
    if not u["active"]:
        raise HTTPException(403, "Esta cuenta está desactivada. Contacta con el administrador.")
    return {"access_token": crear_token(u["id"]), "token_type": "bearer", "user": usuario_publico(u)}


@router.get("/auth/yo")
def yo(user=Depends(get_user)):
    return usuario_publico(user)


@router.delete("/auth/yo", status_code=204)
def borrar_cuenta(user=Depends(get_user)):
    borrar_usuario(user["id"])
    return Response(status_code=204)


def borrar_usuario(user_id):
    with db.transaccion() as c:
        for tabla in ("ratings", "dismissals", "recommendations", "user_genre", "user_list"):
            c.execute(f"DELETE FROM {tabla} WHERE user_id = %s", (user_id,))
        c.execute("DELETE FROM users WHERE id = %s", (user_id,))
    mongo.borrar_email(user_id)


@router.put("/usuarios/yo/generos")
def guardar_generos(datos: Generos, user=Depends(get_user)):
    ids = list(dict.fromkeys(datos.genre_ids))[:3]
    with db.transaccion() as c:
        c.execute("DELETE FROM user_genre WHERE user_id = %s", (user["id"],))
        for g in ids:
            c.execute("INSERT INTO user_genre (user_id, genre_id) VALUES (%s, %s)", (user["id"], g))
    return usuario_publico(user)
