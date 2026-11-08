"""Catálogo, ficha, búsqueda, onboarding y recomendaciones."""
from fastapi import APIRouter, Depends, HTTPException

import catalogo as cat
import db
from seguridad import get_user, get_user_opcional

router = APIRouter()


@router.get("/generos")
def generos():  # pública
    return cat.generos


@router.get("/onboarding/peliculas")
def onboarding(generos: str = "", user=Depends(get_user)):
    ids = [int(g) for g in generos.split(",") if g.strip().isdigit()]
    return cat.lista_web(cat.onboarding(ids, 20))


@router.get("/peliculas/buscar")
def buscar(q: str = "", user=Depends(get_user)):
    return cat.buscar(q)


@router.get("/peliculas")
def listar(ids: str = "", genero: int | None = None, orden: str = "nota", limite: int = 20,
           user=Depends(get_user_opcional)):
    """Pública para «lo más valorado» (la pantalla de entrar la usa sin sesión); con ?ids= hace falta sesión."""
    if ids and not user:
        raise HTTPException(401, "Inicia sesión para continuar.")
    if ids:
        lista = []
        for i in [int(x) for x in ids.split(",") if x.strip().isdigit()][:200]:
            if cat.asegurar(i):
                lista.append(i)
        return cat.lista_web(lista)
    pelis = [p for p in cat.peliculas.values() if genero is None or genero in p["genre_ids"]]
    clave = {"votos": "vote_count", "popularidad": "popularity"}.get(orden, "weighted_rating")
    pelis.sort(key=lambda p: float(p.get(clave) or 0), reverse=True)
    return cat.lista_web([p["id"] for p in pelis[:max(1, min(limite, 100))]])


@router.get("/peliculas/{movie_id}")
def ficha(movie_id: int, user=Depends(get_user)):
    p = cat.asegurar(movie_id)          # si viene de TMDB, entra en el catálogo aquí
    if not p:
        raise HTTPException(404, "No hemos encontrado esa película.")
    cat.completar([movie_id])
    cat.refrescar([movie_id])
    cat.reparto(movie_id)
    return {**cat.a_web(cat.peliculas[movie_id]), "similar": cat.lista_web(cat.similares(movie_id, 12))}


@router.get("/recomendaciones")
def recomendaciones(n: int = 10, cola_larga: bool = False, user=Depends(get_user)):
    uid = user["id"]
    valoraciones = {r["movie_id"]: r["rating"] for r in db.filas("SELECT movie_id, rating FROM ratings WHERE user_id = %s", (uid,))}
    descartes = [r["movie_id"] for r in db.filas("SELECT movie_id FROM dismissals WHERE user_id = %s", (uid,))]
    lista = [r["movie_id"] for r in db.filas("SELECT movie_id FROM user_list WHERE user_id = %s", (uid,))]
    generos = [r["genre_id"] for r in db.filas("SELECT genre_id FROM user_genre WHERE user_id = %s", (uid,))]
    recs = cat.recomendar(valoraciones=valoraciones, descartes=descartes, en_lista=lista, generos_fav=generos,
                          n=max(1, min(n, 50)), solo_cola_larga=cola_larga)
    ahora = db.ahora()
    lote = f"web-{uid}-{ahora:%Y%m%d%H%M%S%f}"[:40]
    with db.transaccion() as c:     # se guarda lo servido: de aquí salen los KPIs del panel
        ids = db.siguientes_ids(c, "recommendations", len(recs))
        for rid, (pos, r) in zip(ids, enumerate(recs, 1)):
            c.execute("""INSERT INTO recommendations (id, user_id, movie_id, batch_id, position, score, generated_at)
                         VALUES (%s, %s, %s, %s, %s, %s, %s)""", (rid, uid, r["id"], lote, pos, r["score"], ahora))
    return {"items": cat.lista_web([r["id"] for r in recs]), "model_version": cat.MODEL_VERSION,
            "generated_at": db.iso(ahora)}
