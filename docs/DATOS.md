# Datos y artefactos del proyecto (resumen)

Aquí queda el contexto de los volcados que los compañeros descargaron en `docs/`. Los archivos pesados se movieron a las carpetas donde se usan.

## Dónde está cada cosa

| Antes en `docs/` | Qué es | Ahora |
|---|---|---|
| `artefactos/` (~25 MB) | `embeddings.npy`, `model.joblib`, `movies_features.parquet`, `neighbors_top50.parquet`: salida de `src/models/features.py` | `src/artefactos/`, **versionado en git** para que un clon arranque sin pasos extra. El modelo se generó con **scikit-learn 1.7.2** y NumPy 2.x (fijado en `src/api/requirements.txt`) |
| `models/` | Copia antigua de `src/models/` | Borrada: idéntica a `src/models/` (menos un README anterior) |
| `Neon(postgreSQL)/movies.csv`, `movie_genre.csv`, `genres.csv` | Catálogo de Neon | `environment/seed/postgres/` (semilla del Docker local) |
| `Mongo/movie_details.json` (~38 MB) | Volcado de la colección `movie_details` de Atlas | `environment/seed/mongo/movie_details.json.gz` (8 MB, comprimido; 4.803 documentos). Lo importa el servicio `mongo-seed` |
| `Mongo/movie_details.jsonl` | Estaba vacío (0 bytes) | Borrado |

Para regenerar el volcado de Mongo desde Atlas (necesita `mongoexport`, de las MongoDB Database Tools, y el `MONGO_URI` de `environment/.env`):

```bash
mongoexport --uri "<MONGO_URI>" --db cinestart --collection movie_details --jsonArray | gzip -9 > environment/seed/mongo/movie_details.json.gz
```

## PostgreSQL (Neon) · esquema `CineStartUsuariosdb`

| Tabla | Filas en el volcado | Columnas |
|---|---|---|
| `movies` | 4.803 | id (TMDB), title, overview, overview_es, release_date, runtime_min, vote_average, vote_count, popularity, weighted_rating, director, poster_path, cluster_id, long_tail |
| `genres` | 20 | id, name |
| `movie_genre` | 12.160 | movie_id, genre_id |
| `users` | 3 (de ejemplo) | id, alias, password_hash, role, active, created_at |
| `ratings` | 7 | user_id, movie_id, rating (1–5), source (`onboarding`/`manual`), created_at |
| `dismissals` | 3 | user_id, movie_id, created_at |
| `user_genre` | 6 | user_id, genre_id |
| `recommendations` | 6 | id, user_id, movie_id, batch_id, position, score, generated_at |

- Los CSV pequeños de `Neon(postgreSQL)/` (`users`, `ratings`, `dismissals`, `user_genre`, `recommendations`) se conservan como ejemplo.
- Usuarios de ejemplo: `admin_cinestart` (admin), `lucia_cine` y `carlos_m`. Sus contraseñas son de relleno y **no pueden entrar**; para tener un admin hay que registrarse y ejecutar `UPDATE users SET role='admin' WHERE alias='tu_alias';`.
- `users.id` y `recommendations.id` no tienen numeración automática: la API reserva el siguiente id.
- `runtime_min` viene como `162.0` en el CSV (hay que convertirlo a entero al cargarlo; lo hace `10_carga.sql`).
- La API añade sola la tabla `user_list` ("Mi lista").

## MongoDB (Atlas) · base `cinestart`

- `movie_details`: 4.803 documentos, `_id` = id de TMDB (relación 1:1 con `movies`). Campos: `cast`, `crew`, `keywords`, `companies`, `countries`, `tmdb_api`.
- `user_contacts`: la crea la API; guarda el email de cada usuario (dato personal, fuera de PostgreSQL).
- Usuario de la API: `cinestart_api` (`readWrite` solo sobre `cinestart`).

## Documentación de Fase 1

- `CineStart_Fase1_Documentacion_y_Diseno_Tecnico.pptx` y su texto, `diapositivas_fase1.txt`.
