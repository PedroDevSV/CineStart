"""API de TMDB: solo para lo que falta (póster, sinopsis en castellano, reparto)
y para buscar películas que no están en el catálogo."""
import logging

import httpx

import config

log = logging.getLogger("cinestart")
BASE = "https://api.themoviedb.org/3"
_cliente: httpx.Client | None = None


def abrir():
    global _cliente
    if not config.TMDB_TOKEN:
        log.warning("TMDB_TOKEN vacío: sin pósters, sinopsis en castellano ni búsqueda en TMDB.")
        return
    _cliente = httpx.Client(base_url=BASE, timeout=8.0,
                            headers={"Authorization": f"Bearer {config.TMDB_TOKEN}", "accept": "application/json"})


def activo():
    return _cliente is not None


def _get(ruta, **params):
    if not _cliente:
        return None
    try:
        r = _cliente.get(ruta, params=params)
        if r.status_code == 404:
            return None
        r.raise_for_status()
        return r.json()
    except httpx.HTTPError as e:
        log.warning("TMDB %s falló: %s", ruta, e)
        return None


def basico(movie_id):
    """Póster y sinopsis en castellano (una llamada)."""
    return _get(f"/movie/{int(movie_id)}", language="es-ES")


def completo(movie_id):
    """Todo lo necesario para meter una película nueva en el catálogo."""
    es = _get(f"/movie/{int(movie_id)}", language="es-ES", append_to_response="credits,keywords")
    if not es:
        return None
    en = _get(f"/movie/{int(movie_id)}", language="en-US") or {}
    es["overview_en"] = en.get("overview") or ""
    es["title_en"] = en.get("title") or es.get("original_title") or es.get("title")
    return es


def buscar(texto, pagina=1):
    d = _get("/search/movie", query=texto, language="es-ES", include_adult="false", page=pagina)
    return (d or {}).get("results", [])
