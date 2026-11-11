# CineStart · Especificación técnica

Documento técnico de referencia del sistema **tal y como está implementado** (entrega NF3). El [README](./README.md) explica cómo arrancarlo; el [TO-DO](./TO-DO.md) recoge lo pendiente. Los README de cada módulo ([api](./src/api/README.md), [web](./src/web/README.md), [models](./src/models/README.md)) detallan su código.

**Equipo:** Ramón Moncholí (Data/BI) · Roberto Raya (ML/BI) · Pedro Sandoval (Platform/BI: API, auth, Docker, CI y repositorio). Frontend: todos. Diseño de Fase 1 en `docs/` (`diapositivas_fase1.txt` y `.pptx`).

---

## 1. Alcance y estado

**Producto:** recomendador híbrido de películas para usuarios nuevos (arranque en frío): alias + contraseña → géneros favoritos (opcional) → valorar ≥ 3 películas → top-10 que se recalcula al valorar o descartar. Panel `/admin` con KPIs, catálogo, usuarios y uso.

| Área | Estado |
|---|---|
| Registro, login (JWT), roles `user`/`admin`, borrado de cuenta | Completo |
| Onboarding, recomendaciones, «No me interesa», Mi lista, valoraciones | Completo |
| Buscador (catálogo + TMDB si no está) y ficha con similares | Completo |
| Panel admin: KPIs, catálogo, usuarios, uso | Completo; las gráficas necesitan datos de uso (no hay script de simulación) |
| Docker: modo local (Postgres + Mongo en contenedores) y modo nube (Neon + Atlas) | Completo |
| CI: lint, build web, pruebas del motor y de la API, build de las imágenes | Completo |
| Endurecimiento de la API (límite de intentos, `/salud` real, versiones fijadas) | Parcial → NF4 |
| Pipeline de ingesta (`src/ingestion/`) y datos de uso simulados | Pendiente → NF4 |
| Colaborativo, MLflow, exportar KPIs a CSV, ajustar el motor desde el panel | Opcional → NF4 |

**Fuera de alcance:** usuarios reales y producción, recuperar contraseña, reproducir vídeo, series, pagos, app móvil, almacenar imágenes (se usa el CDN de TMDB), tiempo real/Spark/redes neuronales.

---

## 2. Arquitectura

```
Navegador ──▶ web (nginx + React/Vite) :8080 ──REST/JSON + JWT──▶ api (FastAPI) :8000
                                                                    ├─ motor híbrido (src/models) + artefactos (src/artefactos)
                                                                    ├─ PostgreSQL  (Neon o contenedor)
                                                                    ├─ MongoDB     (Atlas o contenedor)
                                                                    └─ API de TMDB (HTTPS, solo lo que falta)
```

| Componente | Tecnología | Responsabilidad |
|---|---|---|
| Web | React 19 + Vite, nginx | Usuario y panel `/admin`; todo pasa por `src/web/src/api/index.js`. Con `VITE_USE_MOCKS=true` funciona sin API |
| API | FastAPI, `psycopg` + `psycopg_pool`, `pymongo`, `httpx`, `bcrypt`, `PyJWT` | Contrato REST, auth, carga del catálogo en memoria, recomendación y KPIs |
| Motor | numpy, pandas, scikit-learn 1.7.2 | TF-IDF + SVD + KMeans (offline); puntuación híbrida y reglas (online, en la API) |
| PostgreSQL 16 | | Datos relacionales: usuarios, valoraciones, catálogo, recomendaciones servidas |
| MongoDB 7 | | `movie_details` (reparto, equipo, keywords) y `user_contacts` (email) |
| TMDB | API v3 con token de lectura | Póster, sinopsis en castellano, reparto y búsqueda de lo que no está en el catálogo |

Decisiones de diseño relevantes:
1. **Un solo worker de uvicorn.** El catálogo (~4.800 películas) y el motor viven en memoria, y el motor usa un cerrojo de hilos. Se refresca desde las bases cada 5 min.
2. **`psycopg` sin ORM** (el diseño de Fase 1 mencionaba SQLAlchemy). Sin Alembic: la API crea sola `user_list` (`sql/001_user_list.sql`).
3. **IDs sin numeración automática** en `users` y `recommendations` (así es el esquema de Neon): la API reserva el siguiente id con `pg_advisory_xact_lock`.
4. **Email fuera de PostgreSQL** (dato personal): va a Mongo, `user_contacts`. En PostgreSQL solo alias y hash.
5. **Degradación:** sin `MONGO_URI` la API funciona (sin emails; reparto desde TMDB). Sin `TMDB_TOKEN` funciona sin pósters nuevos ni búsqueda externa.
6. **Neon y Atlas** son el entorno del equipo; Docker local es el reproducible para la evaluación y la CI.

---

## 3. Motor de recomendación (`src/models/`)

`features.py` (offline) construye, a partir del TMDB 5000 limpio, la «sopa» de texto (géneros, keywords, director, top-3 reparto, sinopsis) → TF-IDF → SVD → embeddings normalizados; KMeans (k ≈ 10–12, por silueta) para `cluster_id`; nota ponderada; cola larga (`long_tail`); y los 50 vecinos más cercanos. Salida en `src/artefactos/`: `embeddings.npy`, `model.joblib`, `movies_features.parquet`, `neighbors_top50.parquet`.

`motor.py` (online, versión `content-v1.0`):

| Método | Qué hace |
|---|---|
| `recomendar(valoraciones, descartes, en_lista, generos_fav, n, solo_cola_larga)` | Perfil = suma de embeddings ponderada (5★ +2, 4★ +1, 3★ 0, 2★ −1, 1★ −2, descarte −1). Puntuación = `w_c·parecido + w_p·popularidad + bonus`, con `w_c = n/(n+3)`, `w_p = 3/(n+3)`; bonus +0,05 cola larga y +0,08 género favorito |
| Reglas | Excluye valoradas, descartadas y en Mi lista · máx. 3 por género principal · ≥ 2 de cola larga en listas de 10 |
| `similares(id, n=12)` | «Películas similares» de la ficha |
| `onboarding(generos, n=20)` | Selección de películas conocidas (≥ 1.200 votos) de clusters distintos |
| `anadir_pelicula(peli)` | Incorpora en memoria una película que entró desde TMDB, sin reentrenar |

`prueba_motor.py`: 9 pruebas de coherencia (se ejecutan en la CI).

---

## 4. Modelo de datos

### PostgreSQL (esquema `CineStartUsuariosdb` en Neon; copia local en `environment/seed/postgres/00_esquema.sql`)

| Tabla | Filas en el volcado | Campos principales | Claves |
|---|---|---|---|
| `movies` | 4.803 | id (TMDB), title, overview, overview_es, release_date, runtime_min, vote_average, vote_count, popularity, weighted_rating, director, poster_path, cluster_id, long_tail | PK id |
| `genres` | 20 | id, name | PK id · UK name |
| `movie_genre` | 12.160 | movie_id, genre_id | PK compuesta, 2 FK |
| `users` | — | id, alias, password_hash, role (`user`/`admin`), active, created_at | PK id · UK alias |
| `user_genre` | — | user_id, genre_id (máx. 3 por usuario) | PK compuesta, 2 FK |
| `ratings` | — | user_id, movie_id, rating (1–5, CHECK), source (`onboarding`/`manual`), created_at | PK (user, movie) |
| `dismissals` | — | user_id, movie_id, created_at | PK (user, movie) |
| `recommendations` | — | id, user_id, movie_id, batch_id, position, score, generated_at | PK id · base de los KPIs |
| `user_list` | — | user_id, movie_id, added_at | La crea la API; `ON DELETE CASCADE` |

La web usa `source` = `onboarding`/`recommendation`; la API traduce (`manual` en Neon). Las fechas se guardan en UTC con zona (`timestamptz`). En `docs/Neon(postgreSQL)/` hay CSV de muestra (3 usuarios de ejemplo con hashes falsos que **no pueden entrar**, 7 valoraciones, 3 descartes, 6 recomendaciones).

### MongoDB (base `cinestart`)
- `movie_details`: 4.803 documentos, `_id` = id TMDB (1:1 con `movies`): `cast`, `crew`, `keywords`, `companies`, `countries`, `tmdb_api`.
- `user_contacts`: `{user_id, email}` con índice único por email (lo crea la API).
- Usuario de la API en Atlas: `cinestart_api` (`readWrite` solo sobre `cinestart`).

### Datos y artefactos en el repositorio
| Dato | Ubicación | Notas |
|---|---|---|
| Catálogo (semilla de PostgreSQL) | `environment/seed/postgres/*.csv` | `runtime_min` llega como `162.0`; `10_carga.sql` lo convierte vía tabla temporal |
| `movie_details` | `environment/seed/mongo/movie_details.json.gz` (8 MB) | Regenerable: `mongoexport --uri "<MONGO_URI>" --db cinestart --collection movie_details --jsonArray \| gzip -9 > environment/seed/mongo/movie_details.json.gz` |
| Artefactos del motor | `src/artefactos/` (25 MB) | Generados con scikit-learn **1.7.2**; el pickle solo carga con esa versión (fijada en `requirements.txt`) |
| TMDB 5000 original | `data/tmdb_5000_movies.csv` | Entrada de `scripts/` y de `src/web/scripts/build_mock_data.py` |
| Fase 1 | `docs/` | Presentación de diseño y texto |

Licencias: TMDB 5000 (Kaggle) y API de TMDB, **uso no comercial con atribución** (logo y aviso en la web). A TMDB nunca se envían datos de usuarios. Sin usuarios reales.

---

## 5. API (`src/api/`)

Documentación interactiva en `/docs` (OpenAPI). Todas las rutas, salvo las públicas, exigen `Authorization: Bearer <JWT>`.

| Grupo | Rutas |
|---|---|
| Salud | `GET /salud` (pública) |
| Auth y cuenta | `POST /auth/registro` · `POST /auth/login` · `GET /auth/yo` · `DELETE /auth/yo` · `PUT /usuarios/yo/generos` |
| Catálogo | `GET /generos` (pública) · `GET /peliculas` (pública para «mejor valoradas»; `?ids=` exige sesión; `genero`, `orden`, `limite`) · `GET /peliculas/buscar?q=` · `GET /peliculas/{id}` (con similares) · `GET /onboarding/peliculas?generos=` |
| Recomendaciones | `GET /recomendaciones?n=10&cola_larga=false` (guarda lo servido en `recommendations`) |
| Biblioteca | `GET/PUT/DELETE /valoraciones[/{id}]` · `GET/POST/DELETE /descartes[/{id}]` · `GET/PUT/DELETE /lista[/{id}]` |
| Admin (rol `admin`) | `GET /admin/kpis?dias=` · `GET /admin/peliculas?buscar&nunca_recomendadas&pagina&tam&orden` · `GET /admin/usuarios?buscar&estado` · `PATCH`/`DELETE /admin/usuarios/{id}` · `GET /admin/uso?dias=` |

El contrato JSON que consume la web está en `src/web/README.md`. Errores de validación: `422` con `detail` en castellano.

**Reglas de negocio** (criterios de aceptación de HU-01 a HU-12): alias 3–30 caracteres (letras, números, `.`, `-`, `_`), único sin distinguir mayúsculas; contraseña ≥ 8; email válido y único; 0–3 géneros; valoración 1–5; `onboarded` con ≥ 3 valoraciones; borrar la cuenta elimina todo en cascada (y el email en Mongo); el admin no puede borrarse a sí mismo y nunca ve hashes ni emails; una cuenta desactivada recibe 403.

**KPIs del panel** (se calculan sobre `recommendations`, `ratings` y `dismissals` del periodo, comparados con el periodo anterior): **cobertura** = películas distintas recomendadas / catálogo; **diversidad** = media por lote de 1 − similitud Jaccard de géneros entre pares de películas del lote; **novedad** = fracción de recomendaciones de cola larga; **aceptación** = valoraciones ≥ 4★ / (valoraciones + descartes) de películas que se le habían recomendado antes al usuario (no cuentan las del onboarding). Además: series temporales, clusters, top recomendadas y distribución de notas.

### Seguridad
- Contraseñas con bcrypt (coste 12). JWT HS256, caducidad `JWT_DIAS` (7), `sub` = id de usuario.
- Roles con `require_admin` (403). Mensaje de login genérico. Secretos solo en `.env`; el proceso no arranca sin `JWT_SECRET`.
- CORS acotado a `CORS_ORIGINS`. Contenedor de la API sin privilegios (usuario `cinestart`).
- **Pendientes (NF4):** límite de contraseña a 72 bytes (bcrypt), límite de intentos de login, longitud mínima de `JWT_SECRET`, `/salud` que compruebe de verdad las bases (503 si Postgres falla), índice único en `lower(alias)`, cierre limpio de Mongo/TMDB, `LOG_LEVEL` sin datos personales, versiones `==` en `requirements.txt`.

---

## 6. Contenedores y entornos (`environment/`)

Contexto de build = raíz del repo.

| Servicio | Imagen | Puerto | Notas |
|---|---|---|---|
| `api` | `api.Dockerfile` (python:3.11-slim) | 8000 | usuario no root, 1 worker; `env_file: .env`; artefactos montados `:ro` en `/app/artefactos`; healthcheck contra `/salud` |
| `web` | `web.Dockerfile` (node:22-alpine → nginx:alpine) | 8080 | `VITE_*` se fijan al compilar; `try_files $uri /index.html` para las rutas de React Router |
| `postgres` | postgres:16-alpine | 5432 | solo en el override local; se siembra con `seed/postgres`; volumen `pgdata` |
| `mongo` | mongo:7 | 27017 | solo en el override local; volumen `mongodata` |
| `mongo-seed` | mongo:7 (one-shot) | — | importa `movie_details.json.gz` si la colección está vacía |

- **`docker-compose.yml`:** modo nube (web + api, según `.env`). **`docker-compose.local.yml`:** override que añade Postgres y Mongo y fuerza `DATABASE_URL`/`MONGO_URI` locales y `PGSSLMODE=disable`.
- Orden: `postgres` y `mongo` (healthy) → `mongo-seed` → `api` (healthy) → `web`.
- Variables (`environment/.env.example`): `JWT_SECRET` (obligatoria), `TMDB_TOKEN`, `CORS_ORIGINS`, `MONGO_DB`; en modo nube `DATABASE_URL` o `PG*`, y `MONGO_URI`.

---

## 7. Pruebas y CI

| Comprobación | Dónde | Resultado esperado |
|---|---|---|
| Lint | `ruff check src` (`ruff.toml`: reglas `E`,`F`) | sin errores |
| Build de la web | `npm ci && npm run build` en `src/web` | correcto |
| Coherencia del motor (9) | `src/models/prueba_motor.py` | `TODO BIEN` |
| API (53 comprobaciones: auth, roles, onboarding, recomendaciones, biblioteca, admin, KPIs) | `src/api/prueba_api.py` con `PRUEBA_PG` y mongomock + TMDB simulado | `TODO BIEN` (sale con código 1 si algo falla) |
| Build de las imágenes | `docker build` de `api.Dockerfile` y `web.Dockerfile` | correcto |

`prueba_api.py` necesita la base **recién sembrada** (4.803 películas y sin otros usuarios): con datos de otras pruebas fallan 2 comprobaciones (aceptación y reparto de «Matrix»). `docker compose ... down -v` y repetir.

**GitHub Actions** (`.github/workflows/ci.yml`): se ejecuta en cada PR, en cada push a `main` y en los tags `nf*`. Jobs: `Lint`, `Build de la web`, `Pruebas del motor`, `Pruebas de la API` (Postgres 16 sembrado con la misma semilla que Docker local) y `Build de las imágenes Docker`. Los logs de las pruebas se publican como artefactos. Sin secretos reales: la CI no usa Neon, Atlas ni TMDB.

---

## 8. Estructura del repositorio

Ver el árbol comentado en el [README](./README.md). Resumen: `environment/` (Docker y semillas), `src/api`, `src/models`, `src/artefactos`, `src/web`, `scripts/` (análisis y limpieza previos, de Ramón y Roberto), `data/` (CSV original), `docs/` (Fase 1) y `.github/workflows/`.

---

## 9. Riesgos y limitaciones conocidas

| Riesgo | Mitigación |
|---|---|
| Sin valoraciones reales no hay colaborativo ni métrica de acierto | Contenido + popularidad; pruebas de coherencia y KPIs |
| Catálogo de 4.803 películas anterior a 2017, 94 % en inglés | El buscador lo amplía con TMDB; cuota de cola larga; limitaciones declaradas en la web |
| Pickle de scikit-learn atado a la versión | Versión fijada en `requirements.txt`; regenerar con `features.py` si se cambia |
| Atlas solo admite IPs de su lista | Añadir la IP en *Network Access* |
| Fallos o límites de TMDB | Lo consultado se guarda; si falla, el buscador usa solo el catálogo |
| Claves de nube en `environment/.env` | Ignorado por git; rotar al terminar la entrega |
