"""
Pruebas de coherencia del motor (las que pide la documentación).

    python prueba_motor.py artefactos/      # también funciona con pytest si defines ARTEFACTOS
"""
import os
import sys
import time

from motor import GENEROS, MAX_POR_GENERO, MIN_COLA_LARGA, Motor

ARTEFACTOS = sys.argv[1] if __name__ == "__main__" and len(sys.argv) > 1 else os.environ.get("ARTEFACTOS", "artefactos")
motor = Motor(ARTEFACTOS)
CF = GENEROS["Science Fiction"]
titulo = {}


def ids_por_titulo(*titulos):
    import pandas as pd
    df = pd.read_parquet(f"{ARTEFACTOS}/movies_features.parquet", columns=["id", "title"])
    titulo.update(dict(zip(df["id"], df["title"])))
    mapa = dict(zip(df["title"], df["id"]))
    return [int(mapa[t]) for t in titulos]


def comprobar_reglas(recs, vistas=(), n=10):
    ids = [r["id"] for r in recs]
    assert len(ids) == n, f"esperaba {n}, salen {len(ids)}"
    assert len(set(ids)) == n, "hay repetidas"
    assert not set(ids) & set(vistas), "recomienda algo ya visto"
    principales = [motor.genero_principal[motor.fila[i]] for i in ids]
    assert max(principales.count(g) for g in set(principales)) <= MAX_POR_GENERO, "más de 3 del mismo género"
    assert sum(motor.cola_larga[motor.fila[i]] for i in ids) >= MIN_COLA_LARGA, "menos de 2 de cola larga"


def test_usuario_nuevo_sin_valoraciones():
    recs = motor.recomendar({})
    comprobar_reglas(recs)
    # sin datos manda la popularidad: las populares deben tener buena nota
    populares = [r for r in recs if not motor.cola_larga[motor.fila[r["id"]]]]
    assert all(motor.popularidad[motor.fila[r["id"]]] > 0.6 for r in populares)


def test_fan_de_ciencia_ficcion():
    vistas = ids_por_titulo("Interstellar", "The Matrix", "Inception")
    recs = motor.recomendar({vistas[0]: 5, vistas[1]: 5, vistas[2]: 5}, generos_fav=[CF])
    comprobar_reglas(recs, vistas)
    con_cf = sum(CF in motor.generos[motor.fila[r["id"]]] for r in recs)
    assert con_cf >= 4, f"solo {con_cf} de ciencia ficción para un fan del género"
    principales = {motor.genero_principal[motor.fila[r["id"]]] for r in recs}
    assert len(principales) >= 4, f"solo {len(principales)} géneros principales distintos: falta variedad"


def test_descartar_cambia_la_lista():
    vistas = ids_por_titulo("Interstellar", "The Matrix", "Inception")
    val = {vistas[0]: 5, vistas[1]: 5, vistas[2]: 4}
    antes = motor.recomendar(val)
    primera = antes[0]["id"]
    despues = motor.recomendar(val, descartes=[primera])
    assert primera not in [r["id"] for r in despues]
    comprobar_reglas(despues, list(val) + [primera])


def test_mi_lista_no_se_recomienda():
    favorita = motor.recomendar({})[0]["id"]
    assert favorita not in [r["id"] for r in motor.recomendar({}, en_lista=[favorita])]


def test_gustos_opuestos_dan_listas_distintas():
    cf = ids_por_titulo("Interstellar", "The Matrix", "Inception")
    romance = ids_por_titulo("The Notebook", "Pride & Prejudice", "Titanic")
    a = {r["id"] for r in motor.recomendar({i: 5 for i in cf})}
    b = {r["id"] for r in motor.recomendar({i: 5 for i in romance})}
    assert len(a & b) <= 3, f"comparten {len(a & b)} de 10"


def test_cola_larga():
    recs = motor.recomendar({}, n=12, solo_cola_larga=True)
    assert len(recs) == 12 and all(motor.cola_larga[motor.fila[r["id"]]] for r in recs)


def test_similares_y_onboarding():
    origen = ids_por_titulo("Toy Story")[0]
    sim = motor.similares(origen)
    assert len(sim) == 12 and origen not in sim
    anim = sum(GENEROS["Animation"] in motor.generos[motor.fila[i]] for i in sim)
    assert anim >= 6, f"Toy Story con solo {anim} de animación entre sus similares"

    onb = motor.onboarding([CF])
    assert len(onb) == 20 and len(set(onb)) == 20
    assert len({motor.cluster[motor.fila[i]] for i in onb}) >= 8, "poca variedad de clusters"
    assert sum(CF in motor.generos[motor.fila[i]] for i in onb) >= 3


def test_pelicula_nueva_desde_tmdb():
    nueva = {"id": 693134, "title": "Dune: Part Two",
             "overview": "Paul Atreides unites with the Fremen while on a path of revenge against "
                         "the conspirators who destroyed his family, on the desert planet Arrakis.",
             "genres": ["Science Fiction", "Adventure"],
             "keywords": ["desert", "messiah", "space opera", "based on novel or book"],
             "director": "Denis Villeneuve",
             "top_cast": ["Timothée Chalamet", "Zendaya", "Rebecca Ferguson"],
             "vote_average": 8.2, "vote_count": 6500}
    motor.anadir_pelicula(nueva)
    titulo[693134] = nueva["title"]
    sim = motor.similares(693134, n=10)
    con_cf = sum(CF in motor.generos[motor.fila[i]] for i in sim)
    assert con_cf >= 5, f"Dune con solo {con_cf} similares de ciencia ficción"
    # y ya puede recomendarse
    vistas = ids_por_titulo("Interstellar", "Avatar", "Star Wars")
    recs = motor.recomendar({i: 5 for i in vistas}, n=50)
    assert 693134 in [r["id"] for r in recs]
    print("  similares de Dune 2:", [titulo.get(i, i) for i in sim[:5]])


def test_velocidad():
    vistas = ids_por_titulo("Interstellar", "The Matrix", "Inception", "Toy Story", "Titanic")
    t = time.perf_counter()
    for _ in range(50):
        motor.recomendar({i: 4 for i in vistas}, descartes=vistas[:1])
    ms = (time.perf_counter() - t) / 50 * 1000
    print(f"  {ms:.1f} ms por recomendación")
    assert ms < 100


if __name__ == "__main__":
    pruebas = [f for nombre, f in list(globals().items()) if nombre.startswith("test_")]
    fallos = 0
    for prueba in pruebas:
        try:
            prueba()
            print("OK  ", prueba.__name__)
        except AssertionError as e:
            fallos += 1
            print("FALLA", prueba.__name__, "→", e)
    vistas = ids_por_titulo("Interstellar", "The Matrix", "Inception")
    print("\nEjemplo · fan de Interstellar, Matrix y Origen:")
    for r in motor.recomendar({i: 5 for i in vistas}, generos_fav=[CF]):
        i = motor.fila[r["id"]]
        print(f"  {r['score']:.3f}  {titulo.get(r['id'])}{'  (poco vista)' if motor.cola_larga[i] else ''}")
    sys.exit(1 if fallos else 0)
