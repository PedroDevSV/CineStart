# CineStart · Motor híbrido

Recomendador de contenido + popularidad + reglas, listo para que la API lo use con la web.
Va en `src/models/`, junto a `features.py`. El CSV limpio va en `data/` (no se sube a GitHub) y los artefactos se generan en `src/artefactos/` (tampoco se suben).

| Archivo | Qué es |
|---|---|
| `motor.py` | El motor: `recomendar`, `similares`, `onboarding`, `anadir_pelicula` |
| `features.py` | El de siempre: genera los artefactos que lee el motor |
| `prueba_motor.py` | 9 pruebas de coherencia |

## Uso

```bash
cd models
python features.py --csv ../../data/tmdb_5000_clean.csv --out ../artefactos/
python prueba_motor.py ../artefactos/        # o: ARTEFACTOS=../artefactos pytest prueba_motor.py
```

```python
from motor import Motor, VERSION
motor = Motor("../artefactos/")     # UNA vez al arrancar la API, no en cada petición

motor.recomendar(valoraciones={27205: 5, 157336: 4}, descartes=[680],
                 en_lista=[155], generos_fav=[878], n=10)
# -> [{"id": 11, "score": 0.83}, ...]
```

Los ids son los de TMDB y los géneros van por id (878 = Ciencia ficción), igual que en la web.

## Cómo funciona

1. **Perfil:** suma de los embeddings de lo que ha valorado, con peso 5★ +2 · 4★ +1 · 3★ 0 · 2★ −1 · 1★ −2 · descarte −1.
2. **Puntuación:** `w_c · parecido + w_p · popularidad + bonus`, con `w_c = n/(n+3)` y `w_p = 3/(n+3)`. Con pocas valoraciones manda la popularidad; con muchas, el gusto. Bonus: +0,05 cola larga, +0,08 género favorito.
3. **Reglas:** fuera lo visto (valorado, descartado, en Mi lista) · máximo 3 por género principal · al menos 2 de cola larga en el top-10.

Los números están arriba de `motor.py` como constantes.

## Qué ruta de la web usa cada método

| Ruta de la API | Llamada al motor | Qué añade la API |
|---|---|---|
| `GET /recomendaciones?n=10` | `recomendar(val, desc, lista, generos, n)` | Lee de Postgres valoraciones, descartes, Mi lista y géneros; completa cada id con su ficha (Mongo); guarda las servidas en `recommendations` |
| `GET /recomendaciones?n=12&cola_larga=true` | `recomendar(..., solo_cola_larga=True)` | Igual |
| `GET /peliculas/{id}` → `similar` | `similares(id, n=12)` | Fichas de esos ids |
| `GET /onboarding/peliculas?generos=` | `onboarding(generos, n=20)` | Fichas de esos ids |
| Película nueva al buscar en TMDB | `anadir_pelicula(peli)` | Guardarla también en Mongo/Postgres |

Ejemplo del endpoint con la forma exacta que espera la web:

```python
from datetime import datetime, timezone

@router.get("/recomendaciones")
def recomendaciones(n: int = 10, cola_larga: bool = False, user=Depends(get_user), db=Depends(get_db)):
    val = {r.movie_id: r.rating for r in db.query(Rating).filter_by(user_id=user.id)}
    desc = [d.movie_id for d in db.query(Dismissal).filter_by(user_id=user.id)]
    lista = [l.movie_id for l in db.query(ListItem).filter_by(user_id=user.id)]
    recs = motor.recomendar(val, desc, lista, user.genre_ids, n=n, solo_cola_larga=cola_larga)
    guardar_servidas(db, user.id, recs)                      # para los KPIs del panel
    return {"items": fichas([r["id"] for r in recs]),         # de Mongo, en ese orden
            "model_version": VERSION,
            "generated_at": datetime.now(timezone.utc).isoformat()}
```

`anadir_pelicula` cambia el motor solo en memoria. Si se reinicia la API, las películas nuevas se vuelven a añadir al arrancar leyéndolas de la base de datos, o se relanza `features.py` con el catálogo ampliado.
