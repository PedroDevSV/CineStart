"""
Prueba de humo de la API completa, SIN tocar Neon, Mongo ni TMDB de verdad:
PostgreSQL local con el mismo esquema, MongoDB simulado (mongomock) y TMDB simulado.

    pip install mongomock
    PRUEBA_PG="host=127.0.0.1 port=55432 user=postgres dbname=cinestart" python prueba_api.py
"""
import os
import sys

os.environ["DATABASE_URL"] = os.environ.get("PRUEBA_PG", "host=127.0.0.1 port=55432 user=postgres dbname=cinestart")
os.environ.setdefault("JWT_SECRET", "secreto-de-prueba")
os.environ["TMDB_TOKEN"] = "falso"
os.environ["MONGO_URI"] = "mongodb://falso"
for k in ("PGHOST", "PGPASSWORD", "PGUSER", "PGDATABASE"):
    os.environ.pop(k, None)

import httpx  # noqa: E402
import mongomock  # noqa: E402

import mongo  # noqa: E402
import tmdb  # noqa: E402


def tmdb_falso(req: httpx.Request):
    p, idioma = req.url.path, req.url.params.get("language")
    if p.endswith("/search/movie"):
        return httpx.Response(200, json={"results": [
            {"id": 496243, "title": "Parásitos", "original_title": "기생충", "release_date": "2019-05-30",
             "genre_ids": [35, 53, 18], "overview": "Toda la familia de Ki-taek está en el paro.", "poster_path": "/parasite.jpg",
             "vote_average": 8.5, "vote_count": 17000, "original_language": "ko"},
            {"id": 27205, "title": "Origen"}]})
    if p.endswith("/movie/496243"):
        if idioma == "en-US":
            return httpx.Response(200, json={"title": "Parasite", "overview": "All unemployed, Ki-taek's family takes "
                                             "peculiar interest in the wealthy Park family, a class struggle thriller."})
        return httpx.Response(200, json={
            "id": 496243, "title": "Parásitos", "original_title": "기생충", "original_language": "ko",
            "overview": "Toda la familia de Ki-taek está en el paro.", "poster_path": "/parasite.jpg",
            "release_date": "2019-05-30", "runtime": 133, "vote_average": 8.5, "vote_count": 17000, "popularity": 90,
            "genres": [{"id": 35, "name": "Comedia"}, {"id": 53, "name": "Suspense"}, {"id": 18, "name": "Drama"}],
            "credits": {"cast": [{"name": "Song Kang-ho", "order": 0}, {"name": "Lee Sun-kyun", "order": 1}],
                        "crew": [{"name": "Bong Joon-ho", "job": "Director"}]},
            "keywords": {"keywords": [{"name": "class differences"}, {"name": "dark comedy"}]}})
    if p.endswith("/credits"):
        return httpx.Response(200, json={"cast": [{"name": "Actor Uno", "order": 0}]})
    mid = p.rsplit("/", 1)[-1]
    if mid == "999999999":
        return httpx.Response(404, json={"status_message": "not found"})
    return httpx.Response(200, json={"poster_path": f"/poster{mid}.jpg", "overview": f"Sinopsis en castellano {mid}"})


def mongo_falso():
    mongo._db = mongomock.MongoClient()["cinestart"]
    mongo._db["movie_details"].insert_one({"_id": 603, "cast": [{"name": "Keanu Reeves", "order": 0},
                                                                {"name": "Laurence Fishburne", "order": 1}]})


mongo.abrir = mongo_falso
tmdb.abrir = lambda: setattr(tmdb, "_cliente", httpx.Client(base_url=tmdb.BASE, transport=httpx.MockTransport(tmdb_falso)))

from fastapi.testclient import TestClient  # noqa: E402

import db  # noqa: E402
from main import app  # noqa: E402

fallos = []


def ok(cond, que):
    print(("OK   " if cond else "FALLA") + " " + que)
    if not cond:
        fallos.append(que)


with TestClient(app) as cli:
    from rutas.auth import borrar_usuario
    for viejo in db.filas("SELECT id FROM users WHERE alias IN ('prueba_api', 'admin_api')"):
        borrar_usuario(viejo["id"])          # restos de una ejecución anterior
    db.ejecutar("DELETE FROM recommendations WHERE movie_id = 496243")
    db.ejecutar("DELETE FROM movie_genre WHERE movie_id = 496243")
    db.ejecutar("DELETE FROM movies WHERE id = 496243")
    ok(cli.get("/salud").json()["peliculas"] >= 4795, "arranca y carga el catálogo")

    r = cli.post("/auth/registro", json={"alias": "prueba_api", "email": "Prueba@Ejemplo.com", "password": "clave1234"})
    ok(r.status_code == 201, f"registro ({r.status_code})")
    token, user = r.json()["access_token"], r.json()["user"]
    h = {"Authorization": f"Bearer {token}"}
    ok(user["email"] == "prueba@ejemplo.com" and not user["onboarded"], "el email va a Mongo y aún no hizo onboarding")
    ok(db.fila("SELECT * FROM users WHERE id = %s", (user["id"],)).get("email") is None, "el email NO está en PostgreSQL")
    ok(cli.post("/auth/registro", json={"alias": "PRUEBA_API", "email": "x@y.es", "password": "clave1234"}).status_code == 409,
       "alias repetido -> 409")
    ok(cli.post("/auth/registro", json={"alias": "a", "email": "mal", "password": "1"}).status_code == 422, "datos malos -> 422")
    ok(cli.post("/auth/login", json={"alias": "prueba_api", "password": "otra"}).status_code == 401, "contraseña mala -> 401")
    ok(cli.post("/auth/login", json={"alias": "lucia_cine", "password": "loquesea"}).status_code == 401,
       "usuarios de ejemplo con hash falso no rompen el login")
    ok(cli.get("/auth/yo").status_code == 401, "sin token -> 401")

    ok(cli.put("/usuarios/yo/generos", json={"genre_ids": [878, 53]}, headers=h).json()["genre_ids"] == [878, 53], "géneros")
    onb = cli.get("/onboarding/peliculas?generos=878,53", headers=h).json()
    ok(len(onb) == 20 and onb[0]["poster_path"], "onboarding: 20 películas con póster de TMDB")
    ok(db.fila("SELECT poster_path FROM movies WHERE id = %s", (onb[0]["id"],))["poster_path"], "el póster se guarda en Neon")
    for mid, nota in ((603, 5), (27205, 5), (157336, 4)):
        cli.put(f"/valoraciones/{mid}", json={"rating": nota, "source": "onboarding"}, headers=h)
    ok(cli.get("/auth/yo", headers=h).json()["onboarded"], "con 3 valoraciones ya está onboarded")

    recs = cli.get("/recomendaciones?n=10", headers=h).json()
    ok(len(recs["items"]) == 10 and recs["model_version"], "10 recomendaciones")
    ok(not {603, 27205, 157336} & {m["id"] for m in recs["items"]}, "no recomienda lo ya valorado")
    ok(db.fila("SELECT count(*) AS n FROM recommendations WHERE user_id = %s", (user["id"],))["n"] == 10, "se guardan las servidas")
    cola = cli.get("/recomendaciones?n=12&cola_larga=true", headers=h).json()["items"]
    ok(len(cola) == 12 and all(m["long_tail"] for m in cola), "joyas por descubrir: 12 de cola larga")

    f = cli.get("/peliculas/603", headers=h).json()
    ok(f["title"] == "The Matrix" and len(f["similar"]) == 12, "ficha con 12 similares")
    ok(f["cast"][:1] == ["Keanu Reeves"] and f["overview"].startswith("Sinopsis en castellano"), "reparto de Mongo y sinopsis de TMDB")
    ok(cli.get("/peliculas/999999999", headers=h).status_code == 404, "id que no existe ni en TMDB -> 404")
    db.ejecutar("UPDATE movies SET title = 'Matrix (cambiada a mano)' WHERE id = 603")
    mongo.detalles().update_one({"_id": 603}, {"$set": {"tmdb_api": {"original_title": "hola3", "original_language": "en"}}})
    f = cli.get("/peliculas/603", headers=h).json()
    ok(f["title"] == "Matrix (cambiada a mano)" and f["original_title"] == "hola3", "un cambio hecho a mano en Neon/Mongo se ve sin reiniciar")
    db.ejecutar("UPDATE movies SET title = 'The Matrix' WHERE id = 603")
    cli.get("/peliculas/603", headers=h)
    top = cli.get("/peliculas?genero=878&orden=nota&limite=20", headers=h).json()
    ok(len(top) == 20 and all(878 in m["genre_ids"] for m in top), "lo más valorado de un género")

    b = cli.get("/peliculas/buscar?q=the matrix", headers=h).json()
    ok(b["catalog"][0]["id"] == 603 and b["tmdb"] == [], "buscar en el catálogo (sin ir a TMDB si hay coincidencia exacta)")
    b = cli.get("/peliculas/buscar?q=keanu", headers=h).json()
    ok(any(m["id"] == 603 for m in b["catalog"]), "buscar por actor (reparto de Mongo)")
    b = cli.get("/peliculas/buscar?q=parasitos", headers=h).json()
    ok([m["id"] for m in b["tmdb"]] == [496243], "búsqueda en TMDB de lo que no está (y sin repetir las del catálogo)")
    nueva = cli.get("/peliculas/496243", headers=h).json()
    ok(nueva["added_from_tmdb"] and nueva["director"] == "Bong Joon-ho" and len(nueva["similar"]) == 12, "abrirla la mete en el catálogo")
    ok(db.fila("SELECT title FROM movies WHERE id = 496243")["title"] == "Parasite", "guardada en Neon (movies)")
    ok(db.fila("SELECT count(*) AS n FROM movie_genre WHERE movie_id = 496243")["n"] == 3, "con sus géneros (movie_genre)")
    ok(mongo.detalles().find_one({"_id": 496243})["source"] == "tmdb", "y su ficha en Mongo")
    recs = cli.get("/recomendaciones?n=50", headers=h).json()["items"]
    ok(any(m["id"] == 496243 for m in cli.get("/peliculas?ids=496243", headers=h).json()), "pedir por ids")

    ok(cli.put("/lista/496243", headers=h).status_code == 204, "añadir a Mi lista")
    cli.put("/lista/496243", headers=h)
    ok(cli.get("/lista", headers=h).json()[0]["movie_id"] == 496243, "Mi lista (sin duplicar)")
    primera = cli.get("/recomendaciones?n=10", headers=h).json()["items"][0]["id"]
    ok(cli.post("/descartes", json={"movie_id": primera}, headers=h).status_code == 204, "descartar")
    ok(primera not in [m["id"] for m in cli.get("/recomendaciones?n=10", headers=h).json()["items"]], "lo descartado desaparece")
    ok(cli.get("/descartes", headers=h).json() == [primera], "lista de descartes")
    cli.put(f"/valoraciones/{primera}", json={"rating": 4, "source": "recommendation"}, headers=h)
    ok(cli.get("/descartes", headers=h).json() == [], "valorar quita el descarte")
    v = cli.get("/valoraciones", headers=h).json()
    ok(len(v) == 4 and {x["source"] for x in v} == {"onboarding", "recommendation"}, "valoraciones con su origen")
    ok(db.fila("SELECT source FROM ratings WHERE user_id = %s AND movie_id = %s", (user["id"], primera))["source"] == "manual",
       "en Neon se guarda como «manual»")
    cli.put(f"/valoraciones/{primera}", json={"rating": 2}, headers=h)
    ok(db.fila("SELECT rating FROM ratings WHERE user_id = %s AND movie_id = %s", (user["id"], primera))["rating"] == 2, "cambiar nota")
    ok(cli.put("/valoraciones/603", json={"rating": 9}, headers=h).status_code == 422, "nota fuera de 1-5 -> 422")
    ok(cli.get("/admin/kpis", headers=h).status_code == 403, "un usuario no entra al panel")

    # ---------------------------------------------------------------- administración
    r = cli.post("/auth/registro", json={"alias": "admin_api", "email": "admin@ejemplo.com", "password": "clave1234"})
    db.ejecutar("UPDATE users SET role = 'admin' WHERE alias = 'admin_api'")
    ha = {"Authorization": f"Bearer {r.json()['access_token']}"}
    k = cli.get("/admin/kpis?dias=30", headers=ha).json()
    ok(set(k["kpis"]) == {"coverage", "diversity", "novelty", "acceptance"} and k["recommendations_served"] > 0, "KPIs")
    ok(len(k["acceptance_series"]) == 30 and len(k["clusters"]) >= 10 and k["top_recommended"], "series, clusters y top")
    ok(k["kpis"]["acceptance"]["value"] == 0.0 and sum(x["count"] for x in k["ratings_distribution"]) == 1,
       "aceptación: 1 valoración de 2★ sobre una recomendada + 0 descartes vigentes")
    ok(len(cli.get("/admin/kpis?dias=90", headers=ha).json()["acceptance_series"]) == 13, "90 días van por semanas")
    pa = cli.get("/admin/peliculas?nunca_recomendadas=true&pagina=2&tam=20", headers=ha).json()
    ok(pa["page"] == 2 and len(pa["items"]) == 20 and all(m["times_recommended"] == 0 for m in pa["items"]), "catálogo del panel")
    ok(cli.get("/admin/peliculas?buscar=nolan&orden=rating", headers=ha).json()["total"] >= 8, "buscar en el catálogo del panel")
    us = cli.get("/admin/usuarios", headers=ha).json()
    ok(any(u["alias"] == "prueba_api" and u["ratings_count"] == 4 for u in us) and "password_hash" not in us[0],
       "usuarios (sin hash ni email)")
    ok(cli.patch(f"/admin/usuarios/{user['id']}", json={"active": False}, headers=ha).status_code == 204, "desactivar")
    ok(cli.get("/auth/yo", headers=h).status_code == 403, "un desactivado no puede usar la API")
    cli.patch(f"/admin/usuarios/{user['id']}", json={"active": True}, headers=ha)
    u = cli.get("/admin/uso?dias=7", headers=ha).json()
    ok(u["totals"]["registrations"] >= 1 and u["funnel"][1]["value"] >= 1 and len(u["series"]) == 7, "uso y embudo")
    me = cli.get("/auth/yo", headers=ha).json()
    ok(cli.delete(f"/admin/usuarios/{me['id']}", headers=ha).status_code == 400, "no puede borrarse a sí mismo")

    # ---------------------------------------------------------------- borrar cuenta (derecho de supresión)
    ok(cli.delete("/auth/yo", headers=h).status_code == 204, "borrar mi cuenta")
    ok(db.fila("SELECT count(*) AS n FROM ratings WHERE user_id = %s", (user["id"],))["n"] == 0
       and db.fila("SELECT count(*) AS n FROM user_list WHERE user_id = %s", (user["id"],))["n"] == 0
       and mongo.email_de(user["id"]) is None, "se borran sus datos y su email")
    cli.delete("/auth/yo", headers=ha)
    db.ejecutar("DELETE FROM movie_genre WHERE movie_id = 496243")
    db.ejecutar("DELETE FROM movies WHERE id = 496243")

print(f"\n{'TODO BIEN' if not fallos else f'{len(fallos)} FALLOS'}")
sys.exit(1 if fallos else 0)
