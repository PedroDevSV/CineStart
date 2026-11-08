"""Contraseñas (bcrypt), token JWT y las dependencias get_user / require_admin."""
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

import config
import db

_bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()


def password_ok(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), (hashed or "").encode())
    except ValueError:      # hash con formato no válido (p. ej. los de ejemplo de users.csv)
        return False


def crear_token(user_id: int) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=config.JWT_DIAS)
    return jwt.encode({"sub": str(user_id), "exp": exp}, config.JWT_SECRET, algorithm="HS256")


def get_user(cred: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> dict:
    if not cred:
        raise HTTPException(401, "Inicia sesión para continuar.")
    try:
        user_id = int(jwt.decode(cred.credentials, config.JWT_SECRET, algorithms=["HS256"])["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(401, "Tu sesión ha caducado. Vuelve a entrar.")
    user = db.fila("SELECT id, alias, role, active, created_at FROM users WHERE id = %s", (user_id,))
    if not user:
        raise HTTPException(401, "Tu sesión ha caducado. Vuelve a entrar.")
    if not user["active"]:
        raise HTTPException(403, "Esta cuenta está desactivada.")
    return user


def get_user_opcional(cred: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> dict | None:
    """Para rutas públicas (la portada de entrar/registrarse pinta pósters sin sesión)."""
    return get_user(cred) if cred else None


def require_admin(user: dict = Depends(get_user)) -> dict:
    if user["role"] != "admin":
        raise HTTPException(403, "Solo para administradores.")
    return user
