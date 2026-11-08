"""Panel de administración: solo consulta (KPIs, catálogo, usuarios y uso)."""
from datetime import timedelta
from itertools import combinations

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

import catalogo as cat
import db
from rutas.auth import borrar_usuario
from seguridad import require_admin

router = APIRouter(prefix="/admin")
MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"]


class Estado(BaseModel):
    active: bool


# ------------------------------------------------------------------ utilidades
def _tramos(dias, fin):
    """Etiquetas por día (≤31 días) o por semana, y una función que dice a qué tramo cae una fecha."""
    paso = timedelta(days=1 if dias <= 31 else 7)
    inicio = fin - timedelta(days=dias)
    n = -(-dias // (1 if dias <= 31 else 7))
    etiquetas = [f"{(inicio + i * paso).day} {MESES[(inicio + i * paso).month - 1]}" for i in range(n)]
    return etiquetas, lambda t: min(n - 1, max(0, int((t - inicio) / paso)))


def _jaccard(a, b):
    a, b = set(a), set(b)
    return len(a & b) / (len(a | b) or 1)


def _eventos(desde):
    desde = db.con_zona(desde)
    recs = db.filas("SELECT user_id, movie_id, batch_id, generated_at FROM recommendations WHERE generated_at >= %s", (desde,))
    primera = {(r["user_id"], r["movie_id"]): db.utc(r["primera"]) for r in db.filas(
        "SELECT user_id, movie_id, min(generated_at) AS primera FROM recommendations GROUP BY user_id, movie_id")}
    ratings = db.filas("SELECT user_id, movie_id, rating, source, created_at FROM ratings WHERE created_at >= %s", (desde,))
    descartes = db.filas("SELECT user_id, movie_id, created_at FROM dismissals WHERE created_at >= %s", (desde,))

    def venia_de_rec(e):  # la película se le había recomendado antes a ese usuario
        t = primera.get((e["user_id"], e["movie_id"]))
        return t is not None and t <= db.utc(e["created_at"])

    for r in recs:
        r["at"] = db.utc(r["generated_at"])
    for e in ratings + descartes:
        e["at"] = db.utc(e["created_at"])
    acept_r = [r for r in ratings if r["source"] != "onboarding" and venia_de_rec(r)]
    acept_d = [d for d in descartes if venia_de_rec(d)]
    return recs, acept_r, acept_d, ratings, descartes


def _kpis(recs, acept_r, acept_d, desde, hasta):
    recs = [r for r in recs if desde <= r["at"] < hasta]
    if not recs:
        return None
    total = len(cat.peliculas)
    lotes = {}
    for r in recs:
        lotes.setdefault(r["batch_id"], []).append(r["movie_id"])
    divs = []
    for ids in lotes.values():
        gs = [cat.peliculas[i]["genre_ids"] for i in ids if i in cat.peliculas]
        pares = list(combinations(gs, 2))
        if pares:
            divs.append(1 - sum(_jaccard(a, b) for a, b in pares) / len(pares))
    cola = sum(1 for r in recs if cat.peliculas.get(r["movie_id"], {}).get("long_tail"))
    rr = [r for r in acept_r if desde <= r["at"] < hasta]
    dd = [d for d in acept_d if desde <= d["at"] < hasta]
    buenas = sum(1 for r in rr if r["rating"] >= 4)
    return {
        "coverage": len({r["movie_id"] for r in recs}) / total if total else 0,
        "diversity": sum(divs) / len(divs) if divs else 0,
        "novelty": cola / len(recs),
        "acceptance": buenas / (len(rr) + len(dd)) if rr or dd else 0,
        "recs": len(recs),
    }


# ------------------------------------------------------------------ resumen
@router.get("/kpis")
def kpis(dias: int = 30, admin=Depends(require_admin)):
    dias = max(1, min(dias, 365))
    fin = db.utc(db.ahora()) + timedelta(seconds=1)
    desde, antes = fin - timedelta(days=dias), fin - timedelta(days=2 * dias)
    recs, acept_r, acept_d, _, _ = _eventos(antes)
    actual = _kpis(recs, acept_r, acept_d, desde, fin) or {"coverage": 0, "diversity": 0, "novelty": 0, "acceptance": 0, "recs": 0}
    previo = _kpis(recs, acept_r, acept_d, antes, desde)

    etiquetas, tramo = _tramos(dias, fin)
    serie = [{"pos": 0, "tot": 0} for _ in etiquetas]
    for r in acept_r:
        if r["at"] >= desde:
            serie[tramo(r["at"])]["tot"] += 1
            serie[tramo(r["at"])]["pos"] += r["rating"] >= 4
    for d in acept_d:
        if d["at"] >= desde:
            serie[tramo(d["at"])]["tot"] += 1

    ventana = [r for r in recs if r["at"] >= desde]
    por_genero, por_cluster, veces = {}, {}, {}
    for r in ventana:
        p = cat.peliculas.get(r["movie_id"])
        if not p:
            continue
        if p["genre_ids"]:
            por_genero[p["genre_ids"][0]] = por_genero.get(p["genre_ids"][0], 0) + 1
        i = cat.motor.fila.get(r["movie_id"])
        if i is not None:
            c = int(cat.motor.cluster[i])
            por_cluster[c] = por_cluster.get(c, 0) + 1
        veces[r["movie_id"]] = veces.get(r["movie_id"], 0) + 1
    en_catalogo = {}
    for mid in cat.peliculas:
        i = cat.motor.fila.get(mid)
        if i is not None:
            c = int(cat.motor.cluster[i])
            en_catalogo[c] = en_catalogo.get(c, 0) + 1
    total = len(cat.peliculas)
    top = sorted(veces.items(), key=lambda x: -x[1])[:8]
    return {
        "period_days": dias,
        "model_version": cat.MODEL_VERSION,
        "kpis": {k: {"value": actual[k], "previous": previo[k] if previo else None}
                 for k in ("coverage", "diversity", "novelty", "acceptance")},
        "recommendations_served": actual["recs"],
        "acceptance_series": [{"label": e, "value": s["pos"] / s["tot"] if s["tot"] else None, "n": s["tot"]}
                              for e, s in zip(etiquetas, serie)],
        "recs_by_genre": [{"genre_id": g, "count": n} for g, n in sorted(por_genero.items(), key=lambda x: -x[1])[:10]],
        "clusters": [{"cluster": f"G{c}", "catalog": en_catalogo[c] / total,
                      "recommended": por_cluster.get(c, 0) / len(ventana) if ventana else 0} for c in sorted(en_catalogo)],
        "top_recommended": [{**cat.a_web(cat.peliculas[mid]), "times_recommended": n} for mid, n in top],
        "ratings_distribution": [{"stars": s, "count": sum(1 for r in acept_r if r["at"] >= desde and r["rating"] == s)}
                                 for s in range(1, 6)],
        "never_recommended": total - len(veces),
        "catalog_size": total,
    }


# ------------------------------------------------------------------ catálogo (solo consulta)
@router.get("/peliculas")
def peliculas(buscar: str = "", nunca_recomendadas: bool = False, pagina: int = 1, tam: int = 20,
              orden: str = "recommended", admin=Depends(require_admin)):
    veces = {r["movie_id"]: r["n"] for r in db.filas("SELECT movie_id, count(*) AS n FROM recommendations GROUP BY movie_id")}
    notas = {r["movie_id"]: r for r in db.filas(
        "SELECT movie_id, avg(rating)::float AS media, count(*) AS n FROM ratings GROUP BY movie_id")}
    q = cat.normalizar(buscar)
    items = []
    for p in cat.peliculas.values():
        if q and q not in cat.normalizar(p.get("title")) and q not in cat.normalizar(p.get("director")):
            continue
        n = veces.get(p["id"], 0)
        if nunca_recomendadas and n:
            continue
        nota = notas.get(p["id"])
        items.append((p, n, nota["media"] if nota else None, nota["n"] if nota else 0))
    claves = {
        "recommended": lambda x: -x[1],
        "rating": lambda x: -float(x[0].get("weighted_rating") or 0),
        "votes": lambda x: -int(x[0].get("vote_count") or 0),
        "title": lambda x: cat.normalizar(x[0].get("title")),
    }
    items.sort(key=claves.get(orden, claves["recommended"]))
    tam = max(1, min(tam, 100))
    pagina_items = items[(pagina - 1) * tam: pagina * tam]
    return {
        "items": [{**cat.a_web(p), "times_recommended": n, "app_rating": media, "app_ratings_count": cuantas}
                  for p, n, media, cuantas in pagina_items],
        "total": len(items), "page": pagina, "page_size": tam,
    }


# ------------------------------------------------------------------ usuarios
@router.get("/usuarios")
def usuarios(buscar: str = "", estado: str = "", admin=Depends(require_admin)):
    filas = db.filas("""SELECT u.id, u.alias, u.role, u.active, u.created_at, count(r.movie_id) AS ratings_count
                        FROM users u LEFT JOIN ratings r ON r.user_id = u.id
                        GROUP BY u.id ORDER BY u.created_at DESC""")
    q = cat.normalizar(buscar)
    return [{**f, "created_at": db.iso(f["created_at"])} for f in filas
            if (not q or q in cat.normalizar(f["alias"]))
            and (not estado or (estado == "active") == bool(f["active"]))]


@router.patch("/usuarios/{user_id}", status_code=204)
def cambiar_estado(user_id: int, datos: Estado, admin=Depends(require_admin)):
    if user_id == admin["id"]:
        raise HTTPException(400, "No puedes desactivar tu propia cuenta.")
    if not db.ejecutar("UPDATE users SET active = %s WHERE id = %s", (datos.active, user_id)):
        raise HTTPException(404, "Usuario no encontrado.")
    return Response(status_code=204)


@router.delete("/usuarios/{user_id}", status_code=204)
def borrar(user_id: int, admin=Depends(require_admin)):
    if user_id == admin["id"]:
        raise HTTPException(400, "No puedes borrar tu propia cuenta desde el panel.")
    borrar_usuario(user_id)
    return Response(status_code=204)


# ------------------------------------------------------------------ uso
@router.get("/uso")
def uso(dias: int = 30, admin=Depends(require_admin)):
    dias = max(1, min(dias, 365))
    fin = db.utc(db.ahora()) + timedelta(seconds=1)
    desde = fin - timedelta(days=dias)
    etiquetas, tramo = _tramos(dias, fin)
    serie = [{"label": e, "registrations": 0, "ratings": 0, "dismissals": 0} for e in etiquetas]

    desde_sql = db.con_zona(desde)
    nuevos = db.filas("SELECT id, created_at FROM users WHERE role <> 'admin' AND created_at >= %s", (desde_sql,))
    for u in nuevos:
        serie[tramo(db.utc(u["created_at"]))]["registrations"] += 1
    for r in db.filas("SELECT created_at FROM ratings WHERE created_at >= %s", (desde_sql,)):
        serie[tramo(db.utc(r["created_at"]))]["ratings"] += 1
    for d in db.filas("SELECT created_at FROM dismissals WHERE created_at >= %s", (desde_sql,)):
        serie[tramo(db.utc(d["created_at"]))]["dismissals"] += 1

    ids = [u["id"] for u in nuevos] or [-1]
    valorados = {r["user_id"]: r["n"] for r in db.filas(
        "SELECT user_id, count(*) AS n FROM ratings WHERE user_id = ANY(%s) GROUP BY user_id", (ids,))}
    con_recs = {r["user_id"] for r in db.filas(
        "SELECT DISTINCT user_id FROM recommendations WHERE user_id = ANY(%s)", (ids,))}
    aceptan = {r["user_id"] for r in db.filas(
        """SELECT DISTINCT r.user_id FROM ratings r
           JOIN recommendations x ON x.user_id = r.user_id AND x.movie_id = r.movie_id AND x.generated_at <= r.created_at
           WHERE r.user_id = ANY(%s) AND r.source <> 'onboarding'""", (ids,))}
    onboarding = [u for u in nuevos if valorados.get(u["id"], 0) >= 3]
    activos = db.fila("SELECT count(*) AS n FROM users WHERE active AND role <> 'admin'")["n"]
    return {
        "period_days": dias,
        "totals": {"registrations": len(nuevos), "ratings": sum(s["ratings"] for s in serie),
                   "dismissals": sum(s["dismissals"] for s in serie), "active_users": activos},
        "onboarding_completion": len(onboarding) / len(nuevos) if nuevos else 0,
        "funnel": [
            {"step": "Registrados", "value": len(nuevos)},
            {"step": "Onboarding completo", "value": len(onboarding)},
            {"step": "Recibieron recomendaciones", "value": sum(1 for u in nuevos if u["id"] in con_recs)},
            {"step": "Valoraron una recomendación", "value": sum(1 for u in nuevos if u["id"] in aceptan)},
        ],
        "series": serie,
    }
