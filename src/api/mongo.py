"""MongoDB Atlas: ficha ampliada de cada película (reparto, equipo, keywords) y el email de cada usuario.

Si no hay MONGO_URI en el .env, la API funciona igual: el reparto se pide a TMDB
y el email no se guarda (se avisa en el log al arrancar).
"""
import logging

from pymongo import ASCENDING, MongoClient

import config

log = logging.getLogger("cinestart")
_db = None


def abrir():
    global _db
    if not config.MONGO_URI:
        log.warning("MONGO_URI vacío: sin MongoDB (el reparto saldrá de TMDB y el email no se guardará).")
        return
    cliente = MongoClient(config.MONGO_URI, serverSelectionTimeoutMS=8000, appname="cinestart-api")
    cliente.admin.command("ping")
    _db = cliente[config.MONGO_DB]
    _db[config.MONGO_CONTACTOS].create_index([("email", ASCENDING)], unique=True)


def activo():
    return _db is not None


def detalles():
    return _db[config.MONGO_DETALLES]


def contactos():
    return _db[config.MONGO_CONTACTOS]


def _nombres(lista, n=None):
    lista = sorted(lista or [], key=lambda p: p.get("order", 999) if isinstance(p, dict) else 999)
    nombres = [p.get("name") if isinstance(p, dict) else str(p) for p in lista]
    return [x for x in nombres if x][:n]


def repartos(limite=5):
    """{movie_id: {cast, original_title, original_language}} de todo el catálogo (para buscar por actor)."""
    if not activo():
        return {}
    cursor = detalles().find({}, {"cast": {"$slice": 12}, "tmdb_api.original_title": 1, "tmdb_api.original_language": 1})
    return {int(d["_id"]): {"cast": _nombres(d.get("cast"), limite),
                            "original_title": (d.get("tmdb_api") or {}).get("original_title"),
                            "original_language": (d.get("tmdb_api") or {}).get("original_language")}
            for d in cursor if str(d["_id"]).isdigit()}


def extras(ids):
    """Lo mismo que repartos() pero solo para unas películas: se lee en cada petición, así que
    un cambio hecho en Atlas se ve al momento."""
    if not activo() or not ids:
        return {}
    cursor = detalles().find({"_id": {"$in": [int(i) for i in ids]}},
                             {"cast": {"$slice": 12}, "tmdb_api.original_title": 1, "tmdb_api.original_language": 1})
    return {int(d["_id"]): {"cast": _nombres(d.get("cast"), 8),
                            "original_title": (d.get("tmdb_api") or {}).get("original_title"),
                            "original_language": (d.get("tmdb_api") or {}).get("original_language")}
            for d in cursor}


def ficha(movie_id):
    if not activo():
        return None
    return detalles().find_one({"_id": int(movie_id)})


def reparto_de(doc, n=8):
    return _nombres((doc or {}).get("cast"), n)


def guardar_ficha(movie_id, doc):
    if activo():
        detalles().update_one({"_id": int(movie_id)}, {"$set": doc}, upsert=True)


# ---------------------------------------------------------------- email (IIP, fuera de PostgreSQL)
def email_de(user_id):
    if not activo():
        return None
    d = contactos().find_one({"_id": int(user_id)}, {"email": 1})
    return d["email"] if d else None


def email_existe(email):
    return activo() and contactos().count_documents({"email": email.lower()}, limit=1) > 0


def guardar_email(user_id, email):
    if activo():
        contactos().update_one({"_id": int(user_id)}, {"$set": {"email": email.lower()}}, upsert=True)


def borrar_email(user_id):
    if activo():
        contactos().delete_one({"_id": int(user_id)})
