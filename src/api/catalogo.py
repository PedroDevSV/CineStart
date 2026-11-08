"""Catálogo en memoria + motor de recomendación.

Al arrancar se leen de Neon las ~4.800 películas (tablas movies y movie_genre) y se
guardan en memoria: así buscar, ordenar y pintar carruseles no cuesta consultas.
Cuando entra una película nueva desde TMDB se escribe en Neon/Mongo y se añade aquí.
"""
import logging
import sys
import threading
import unicodedata
from concurrent.futures import ThreadPoolExecutor

import config
import db
import mongo
import tmdb

log = logging.getLogger("cinestart")
sys.path.insert(0, str(config.CARPETA_MODELS))
from motor import GENEROS, VERSION, Motor  # noqa: E402  (models/motor.py)

ID_A_GENERO = {v: k for k, v in GENEROS.items()}

peliculas: dict[int, dict] = {}     # id -> fila de movies + genre_ids + cast
generos: list[dict] = []            # [{id, name}]
motor: Motor | None = None
_cerrojo = threading.Lock()         # el motor no es seguro con hilos al añadir películas
_tmdb_probado: set[int] = set()     # para no pedir a TMDB lo que ya sabemos que no tiene
MODEL_VERSION = VERSION


def normalizar(texto):
    t = unicodedata.normalize("NFD", str(texto or "").lower())
    return "".join(c for c in t if unicodedata.category(c) != "Mn").strip()


# ------------------------------------------------------------------ carga
def cargar():
    global motor, generos
    generos = [{"id": g["id"], "name": g["name"]} for g in db.filas("SELECT id, name FROM genres ORDER BY id")]
    por_peli = {}
    for r in db.filas("SELECT movie_id, genre_id FROM movie_genre"):
        por_peli.setdefault(r["movie_id"], []).append(r["genre_id"])
    for r in db.filas("SELECT * FROM movies"):
        r["genre_ids"] = por_peli.get(r["id"], [])
        r["cast"] = []
        peliculas[int(r["id"])] = r
    for mid, extra in mongo.repartos().items():
        if mid in peliculas:
            peliculas[mid].update({k: v for k, v in extra.items() if v})
    motor = Motor(config.ARTEFACTOS)
    log.info("Catálogo: %d películas · motor %s con %d", len(peliculas), VERSION, len(motor.ids))


# ------------------------------------------------------------------ formato para la web
def a_web(p, fuente="catalog"):
    fecha = p.get("release_date")
    i = motor.fila.get(int(p["id"])) if motor else None
    return {
        "id": int(p["id"]),
        "title": p.get("title"),
        "original_title": p.get("original_title") or p.get("title"),
        "release_date": str(fecha)[:10] if fecha else None,
        "runtime": int(p["runtime_min"]) if p.get("runtime_min") else None,
        "genre_ids": p.get("genre_ids", []),
        "overview": p.get("overview_es") or p.get("overview") or "",
        "director": p.get("director") or "",
        "cast": p.get("cast") or [],
        "original_language": p.get("original_language"),
        "vote_average": float(p["vote_average"]) if p.get("vote_average") is not None else None,
        "vote_count": int(p["vote_count"]) if p.get("vote_count") is not None else None,
        "weighted_rating": float(p["weighted_rating"]) if p.get("weighted_rating") is not None else None,
        "long_tail": bool(p.get("long_tail")) if p.get("long_tail") is not None else None,
        "cluster_id": int(motor.cluster[i]) if i is not None else None,
        "poster_path": p.get("poster_path") or None,
        "source": fuente,
        **({"added_from_tmdb": True} if p.get("added_from_tmdb") else {}),
    }


def refrescar(ids):
    """Vuelve a leer de Neon y Mongo las películas que se van a enseñar.
    La memoria sirve para buscar y ordenar rápido; lo que se pinta, siempre al día."""
    ids = [int(i) for i in ids if int(i) in peliculas]
    if not ids:
        return
    generos_de = {}
    for r in db.filas("SELECT movie_id, genre_id FROM movie_genre WHERE movie_id = ANY(%s)", (ids,)):
        generos_de.setdefault(r["movie_id"], []).append(r["genre_id"])
    for r in db.filas("SELECT * FROM movies WHERE id = ANY(%s)", (ids,)):
        p = peliculas[int(r["id"])]
        p.update(r)
        p["genre_ids"] = generos_de.get(r["id"], p.get("genre_ids", []))
    for mid, extra in mongo.extras(ids).items():
        p = peliculas[mid]
        p["original_title"] = extra["original_title"]
        p["original_language"] = extra["original_language"]
        if extra["cast"]:
            p["cast"] = extra["cast"]


def recargar_todo():
    """Cada pocos minutos: así también la búsqueda ve los cambios hechos a mano en Neon o Mongo."""
    try:
        refrescar(list(peliculas))
    except Exception as e:  # nunca tumbar la API por esto
        log.warning("No se pudo recargar el catálogo: %s", e)


def lista_web(ids):
    ids = [int(i) for i in ids if int(i) in peliculas]
    completar(ids)
    refrescar(ids)
    return [a_web(peliculas[i]) for i in ids]


# ------------------------------------------------------------------ TMDB: lo que falta
def completar(ids):
    """Pide a TMDB póster y sinopsis en castellano de las que no los tienen y lo guarda en Neon."""
    if not tmdb.activo():
        return
    faltan = [i for i in ids if i in peliculas and i not in _tmdb_probado
              and (not peliculas[i].get("poster_path") or not peliculas[i].get("overview_es"))]
    if not faltan:
        return
    _tmdb_probado.update(faltan)
    with ThreadPoolExecutor(max_workers=8) as ex:
        resultados = list(ex.map(tmdb.basico, faltan))
    for mid, d in zip(faltan, resultados):
        if not d:
            continue
        p = peliculas[mid]
        poster = p.get("poster_path") or d.get("poster_path")
        sinopsis = p.get("overview_es") or d.get("overview") or None
        if poster != p.get("poster_path") or sinopsis != p.get("overview_es"):
            p["poster_path"], p["overview_es"] = poster, sinopsis
            db.ejecutar("UPDATE movies SET poster_path = %s, overview_es = %s WHERE id = %s", (poster, sinopsis, mid))


def reparto(mid):
    """Reparto para la ficha: Mongo si lo tiene; si no, TMDB."""
    p = peliculas[mid]
    if p.get("cast"):
        return p["cast"]
    cast = mongo.reparto_de(mongo.ficha(mid))
    if not cast and tmdb.activo():
        d = tmdb._get(f"/movie/{mid}/credits")
        cast = [c["name"] for c in sorted((d or {}).get("cast", []), key=lambda c: c.get("order", 999))][:8]
    p["cast"] = cast
    return cast


def asegurar(mid):
    """La película está en el catálogo; si viene de TMDB, se trae, se guarda y entra en el motor."""
    mid = int(mid)
    if mid in peliculas:
        return peliculas[mid]
    d = tmdb.completo(mid)
    if not d or not (d.get("title") or d.get("title_en")):
        return None
    crew = d.get("credits", {}).get("crew", [])
    cast = sorted(d.get("credits", {}).get("cast", []), key=lambda c: c.get("order", 999))
    director = next((c["name"] for c in crew if c.get("job") == "Director"), "")
    genre_ids = [g["id"] for g in d.get("genres", [])]
    kw = d.get("keywords", {}).get("keywords", [])
    keywords = [k["name"] for k in kw]
    votos, media = int(d.get("vote_count") or 0), float(d.get("vote_average") or 0)
    m, C = motor.modelo["m"], motor.modelo["C"]
    wr = round((votos * media + m * C) / (votos + m), 4)
    fila = {
        "id": mid, "title": d.get("title_en") or d.get("title"), "overview": d.get("overview_en") or "",
        "overview_es": d.get("overview") or None, "release_date": d.get("release_date") or None,
        "runtime_min": d.get("runtime") or None, "vote_average": media, "vote_count": votos,
        "popularity": d.get("popularity"), "weighted_rating": wr, "director": director,
        "poster_path": d.get("poster_path"), "long_tail": votos < motor._mediana_votos,
    }
    with _cerrojo:
        motor.anadir_pelicula({
            "id": mid, "title": fila["title"], "overview": fila["overview"],
            "genres": [ID_A_GENERO[g] for g in genre_ids if g in ID_A_GENERO],
            "keywords": keywords, "director": director,
            "top_cast": [c["name"] for c in cast[:3]], "vote_average": media, "vote_count": votos,
        })
        fila["cluster_id"] = int(motor.cluster[motor.fila[mid]])
    with db.transaccion() as c:
        c.execute("""INSERT INTO movies (id, title, overview, overview_es, release_date, runtime_min, vote_average,
                         vote_count, popularity, weighted_rating, director, poster_path, cluster_id, long_tail)
                     VALUES (%(id)s, %(title)s, %(overview)s, %(overview_es)s, %(release_date)s, %(runtime_min)s,
                         %(vote_average)s, %(vote_count)s, %(popularity)s, %(weighted_rating)s, %(director)s,
                         %(poster_path)s, %(cluster_id)s, %(long_tail)s)
                     ON CONFLICT (id) DO NOTHING""", fila)
        for g in genre_ids:
            c.execute("INSERT INTO movie_genre (movie_id, genre_id) VALUES (%s, %s) ON CONFLICT DO NOTHING", (mid, g))
    # mismo formato que los documentos que ya hay en movie_details
    mongo.guardar_ficha(mid, {
        "cast": cast[:20], "crew": crew[:40], "keywords": kw,
        "companies": d.get("production_companies", []), "countries": d.get("production_countries", []),
        "tmdb_api": {k: d.get(k) for k in ("original_title", "original_language", "budget", "revenue", "homepage",
                                           "tagline", "status", "spoken_languages")},
        "source": "tmdb",
    })
    fila.update(genre_ids=genre_ids, cast=[c["name"] for c in cast[:8]], added_from_tmdb=True,
                original_title=d.get("original_title"), original_language=d.get("original_language"))
    peliculas[mid] = fila
    log.info("Película %s añadida desde TMDB: %s", mid, fila["title"])
    return fila


# ------------------------------------------------------------------ búsqueda
def buscar(texto):
    q = normalizar(texto)
    if len(q) < 2:
        return {"catalog": [], "tmdb": []}
    puntuadas = []
    for p in peliculas.values():
        t, o = normalizar(p.get("title")), normalizar(p.get("original_title") or "")
        s = 0
        if q in (t, o):
            s = 100
        elif t.startswith(q):
            s = 60
        elif q in t or (o and q in o):
            s = 40
        elif q in normalizar(p.get("director")):
            s = 25
        elif any(q in normalizar(c) for c in p.get("cast") or []):
            s = 15
        if s:
            puntuadas.append((s + float(p.get("weighted_rating") or 0) / 10, p["id"]))
    puntuadas.sort(reverse=True)
    catalogo = lista_web([mid for _, mid in puntuadas[:30]])
    externas = []
    if tmdb.activo() and not any(s >= 100 for s, _ in puntuadas):
        for r in tmdb.buscar(texto)[:10]:
            if r.get("id") in peliculas:
                continue
            externas.append({
                "id": r["id"], "title": r.get("title"), "original_title": r.get("original_title"),
                "release_date": r.get("release_date") or None, "runtime": None,
                "genre_ids": r.get("genre_ids", []), "overview": r.get("overview") or "",
                "director": "", "cast": [], "original_language": r.get("original_language"),
                "vote_average": r.get("vote_average"), "vote_count": r.get("vote_count"),
                "weighted_rating": None, "long_tail": None, "cluster_id": None,
                "poster_path": r.get("poster_path"), "source": "tmdb",
            })
    return {"catalog": catalogo, "tmdb": externas}


# ------------------------------------------------------------------ motor
def recomendar(**kw):
    with _cerrojo:
        return motor.recomendar(**kw)


def similares(mid, n=12):
    with _cerrojo:
        return motor.similares(mid, n)


def onboarding(generos_ids, n=20):
    with _cerrojo:
        return motor.onboarding(generos_ids, n)
