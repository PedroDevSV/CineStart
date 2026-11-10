# CineStart · Spec técnico de Plataforma (Pedro Sandoval)

> Rol: **Platform / BI** · Alcance: **API FastAPI, autenticación, Docker, CI y repositorio**.
> Estado a **9/11/2026** (S7). Próximo hito: **H3 · NF3 el 12/11** (versión funcional de principio a fin). Después: H4 29/11 (panel, tests, accesibilidad) y H5 NF4 el 10/12.
> Fuentes: `README.md` (raíz, `docs/`, `src/api`, `src/web`, `src/models`), `docs/diapositivas_fase1.txt` y el código de `src/`.
> **Actualización 9/11:** el modo local se implementó como **override** (`environment/docker-compose.local.yml`) en lugar de perfiles, y los volcados pesados de `docs/` se limpiaron (ver [docs/DATOS.md](./docs/DATOS.md)). Donde este spec habla de "perfil `local`", léase "override local"; los riesgos R3 y R4 quedan resueltos.
> Orden de trabajo acordado: **1) Docker → 2) API (endurecer y probar) → 3) CI → 4) repositorio y documentación**. La guía paso a paso está en [TO-DO.md](./TO-DO.md).

---

## 1. Resumen: qué hay y qué queda (todo el proyecto)

### Ya existe en el repositorio

| Pieza | Dueño | Estado | Dónde |
|---|---|---|---|
| Motor híbrido (contenido + popularidad + reglas), `features.py`, 9 pruebas de coherencia | Roberto | Hecho | `src/models/` |
| API FastAPI: auth, películas, recomendaciones, biblioteca, admin (KPIs, catálogo, usuarios, uso) | Pedro | Hecha (26 rutas + `/salud`), con script de 53 comprobaciones | `src/api/` |
| Web React + Vite (usuario + `/admin`), con modo mock y modo API real | Todos | Hecha | `src/web/` |
| Datos cargados en Neon (PostgreSQL) y Atlas (MongoDB); CSV/JSON de volcado | Ramón | Hecho (volcados en `docs/`) | `docs/Neon(postgreSQL)/`, `docs/Mongo/` |
| Artefactos del modelo (`embeddings.npy`, `model.joblib`, parquet) | Roberto | Generados; **no están en `src/artefactos/`** sino en `docs/artefactos/` | `docs/artefactos/` |

### Falta (por área)

**Plataforma (Pedro, este documento)**
- Docker: **no existe nada** (ni `Dockerfile`, ni `docker-compose.yml`, ni carpeta `environment/`).
- CI: **no existe `.github/`**. No hay `ruff`, ni `pytest` en el repo, ni carpeta `tests/`.
- API: funciona, pero hay que endurecerla (seguridad, salud, límites) y convertir `prueba_api.py` en pruebas ejecutables en CI.
- Repositorio: `.gitignore` en la raíz, PRs/rama protegida, `docs/decisiones.md`, README raíz actualizado.

**Datos (Ramón)**
- Carpeta `src/ingestion/` (carga, limpieza, cliente TMDB como pipeline por lotes) no está en el repo.
- `docs/especificacion.md` (diccionario de las 24 columnas), `modelo_datos.png`, `arquitectura.png`.
- Script de datos de uso simulados para las demos del panel.
- Decidir qué volcados se versionan (ver §6, riesgo R5).

**ML (Roberto)**
- Fijar versiones de `numpy / pandas / scikit-learn` con las que se generó `model.joblib` (ver R2).
- Ajuste del motor con las pruebas de coherencia; ejecutarlas en CI.
- Opcional: colaborativo con valoraciones de la app, MLflow, ajuste del motor desde el panel.

**Frontend / todos**
- Accesibilidad (contraste AA, teclado, aria-label en estrellas) y Lighthouse.
- Aviso/atribución a TMDB (logo + texto) y limitaciones del catálogo declaradas en la web (verificar `About.jsx`).
- Memoria final y presentación (NF4); aviso de privacidad (GDPR).
- Opcionales tras H3: exportar KPIs a CSV, estado de datos y relanzar features.

**Documentación común**
- README raíz desfasado: describe `ingestion/ storage/ api/ web/ dashboard/ docker/` y Alembic, que no existen. Sección OUT "pendiente de definir" (ya está en la diapositiva 6). Licencia pendiente.

---

## 2. Estado real de la API (verificado en el código)

Pila: Python (la diapositiva dice **3.11**; la máquina local tiene 3.14), FastAPI, `psycopg` + `psycopg_pool` (**no SQLAlchemy**, como decía la diapositiva), `pymongo`, `httpx`, `bcrypt`, `PyJWT`, `python-dotenv`.

| Área | Rutas |
|---|---|
| Salud | `GET /salud` |
| Auth | `POST /auth/registro`, `POST /auth/login`, `GET /auth/yo`, `DELETE /auth/yo`, `PUT /usuarios/yo/generos` |
| Catálogo | `GET /generos`, `/onboarding/peliculas`, `/peliculas/buscar`, `/peliculas`, `/peliculas/{id}` |
| Recomendaciones | `GET /recomendaciones` |
| Biblioteca | `/valoraciones` (GET, PUT, DELETE), `/descartes` (GET, POST, DELETE), `/lista` (GET, PUT, DELETE) |
| Admin (`require_admin`) | `GET /kpis`, `/peliculas`, `/usuarios`, `PATCH`/`DELETE /usuarios/{id}`, `GET /uso` (prefijo `/admin`) |

Arranque (`main.py`, `lifespan`): abre pool de Neon → Mongo (opcional) → TMDB (opcional) → `catalogo.cargar()` (carga ~4.800 películas en memoria y el motor) → hilo que refresca el catálogo cada 5 min.

Configuración (`config.py`, todo por variables de entorno; `.env` solo en local):
`DATABASE_URL` o `PG*`, `MONGO_URI`, `MONGO_DB`, `MONGO_COLECCION_*`, `TMDB_TOKEN`, `JWT_SECRET` (**obligatorio**: sin él el proceso se cierra), `JWT_DIAS` (7), `ARTEFACTOS`, `CARPETA_MODELS`, `CORS_ORIGINS`.

Restricciones de diseño que condicionan Docker:

1. **Rutas relativas por defecto:** `ARTEFACTOS = ../artefactos` y `CARPETA_MODELS = ../models` respecto a `api/`. En la imagen se respeta la disposición `/app/api`, `/app/models`, `/app/artefactos`.
2. **Un solo proceso:** el catálogo vive en memoria y el motor usa un cerrojo de hilos. **`uvicorn` con 1 worker** (no `--workers N`).
3. **IDs sin autonumérico** en `users` y `recommendations` (la API los reserva con `pg_advisory_xact_lock`). El esquema local debe respetarlo: se reutiliza `src/api/sql/esquema_local.sql`.
4. **`user_list`** la crea la propia API al arrancar (`db.preparar_esquema`), no hay que sembrarla.
5. **Sin `MONGO_URI`** la API funciona (sin emails y con reparto pedido a TMDB). Sin `TMDB_TOKEN` también.
6. `ratings.source` en BD es `onboarding|manual`; la API traduce a `onboarding|recommendation` para la web (ya resuelto en `biblioteca.py`).
7. `model.joblib` es un pickle de scikit-learn: **la versión de scikit-learn de la imagen debe coincidir** con la que lo generó.

---

## 3. Docker (objetivo 1)

### 3.1 Requisitos funcionales

- RF-D1: `docker compose up --build` deja funcionando **web + API** en una máquina limpia con Docker (cumple "reproducible con un comando").
- RF-D2: dos modos de datos **sin tocar el compose**, solo cambiando el `.env`:
  - **Nube** (por defecto del equipo): API → Neon + Atlas.
  - **Local** (perfil `local`): PostgreSQL 16 + MongoDB 7 en contenedores, sembrados con los volcados. Sirve para CI, demos sin red y para la defensa.
- RF-D3: secretos fuera de las imágenes y del repo (`.env`, ignorado por git; `.env.example` versionado).
- RF-D4: datos persistentes en volúmenes con nombre; `docker compose down -v` los borra.
- RF-D5: healthchecks y orden de arranque correctos (la API no arranca hasta que Postgres esté sano).

### 3.2 Estructura (según la diapositiva 14: `environment/`)

```
environment/
├── docker-compose.yml
├── api.Dockerfile
├── web.Dockerfile
├── nginx.conf                 # SPA fallback para VITE_ROUTER_MODE=browser
├── .env.example               # variables del compose + de la API (modo nube y modo local)
└── seed/
    ├── postgres/              # 00_esquema.sql, 10_carga.sql, genres/movies/movie_genre.csv
    └── mongo/                 # importar.sh (mongoimport --jsonArray)
.dockerignore                  # en la raíz (el contexto de build es la raíz del repo)
```

Contexto de build = **raíz del repo** (la imagen de la API necesita `src/api` y `src/models`).

### 3.3 Servicios

| Servicio | Imagen / build | Puerto host | Notas |
|---|---|---|---|
| `api` | `api.Dockerfile` (`python:3.11-slim`) | 8000 | usuario no root; `uvicorn main:app --host 0.0.0.0 --port 8000` (1 worker); `env_file: .env`; volumen **solo lectura** `../src/artefactos:/app/artefactos:ro`; healthcheck contra `/salud` |
| `web` | `web.Dockerfile`: etapa `node:22-alpine` (`npm ci && npm run build`) → `nginx:alpine` | 8080 | `VITE_*` se fijan **en build** (`ARG`): `VITE_USE_MOCKS=false`, `VITE_API_URL=http://localhost:8000`. `try_files $uri /index.html` |
| `postgres` | `postgres:16-alpine` | 5432 | perfil `local`; volumen `pgdata`; healthcheck `pg_isready`; `seed/postgres` en `/docker-entrypoint-initdb.d` |
| `mongo` | `mongo:7` | 27017 | perfil `local`; volumen `mongodata`; healthcheck con `mongosh --eval "db.runCommand('ping')"` |
| `mongo-seed` | `mongo:7` (one-shot) | — | perfil `local`; importa `movie_details.json` con `--jsonArray` y termina |

- `api.depends_on`: `postgres` y `mongo` con `condition: service_healthy` y **`required: false`** (Compose ≥ 2.20; la máquina tiene v5.3), para que el modo nube no los exija.
- El servicio `pipeline` de la diapositiva 8 queda **fuera de este primer compose**: depende de `src/ingestion/` (Ramón). Se añade cuando exista.

### 3.4 Variables (`environment/.env.example`)

```
# Modo local (perfil "local")
DATABASE_URL=postgresql://cinestart:cinestart@postgres:5432/cinestart
MONGO_URI=mongodb://mongo:27017
# Modo nube: DATABASE_URL de Neon y MONGO_URI de Atlas (pedírselos al equipo)
MONGO_DB=cinestart
TMDB_TOKEN=
JWT_SECRET=                      # python -c "import secrets; print(secrets.token_urlsafe(48))"
CORS_ORIGINS=http://localhost:8080
```

### 3.5 Semilla local

- **PostgreSQL:** `esquema_local.sql` + `COPY` de `genres`, `movies`, `movie_genre` (4.803 películas, ~12.000 relaciones). **No se cargan los usuarios de ejemplo** (hashes falsos, no pueden entrar); el admin se crea registrándose y ejecutando `UPDATE users SET role='admin' WHERE alias='...'` con `docker compose exec postgres psql`.
- **MongoDB:** `docs/Mongo/movie_details.json` es un **array JSON** (39 MB) con `_id` = id TMDB. `movie_details.jsonl` está **vacío (0 bytes)**; usar el `.json`. Comando: `mongoimport --db cinestart --collection movie_details --jsonArray --file ...`.
- `user_contacts` la crea la API (índice único por email) al arrancar.

### 3.6 Criterios de aceptación

- [ ] `docker compose -f environment/docker-compose.yml --profile local up --build` arranca y `GET http://localhost:8000/salud` devuelve `postgres: ok`, `mongodb: ok` y `peliculas >= 4795`.
- [ ] `http://localhost:8080` muestra la web, el registro/login funcionan contra la API del contenedor y se recarga `/pelicula/27205` sin 404.
- [ ] Sin perfil `local` y con `DATABASE_URL`/`MONGO_URI` de la nube, también arranca (modo nube).
- [ ] Ningún secreto en `docker history` ni en el repo; la imagen de la API corre sin root.
- [ ] `docker compose down -v && up` reproduce el estado desde cero.

---

## 4. API (objetivo 2)

La API ya cumple las historias HU-01 a HU-12. Lo que queda es **endurecerla, hacerla operable en contenedor y probarla en automático**.

### 4.1 Cambios requeridos

| ID | Cambio | Motivo / criterio |
|---|---|---|
| A1 | `Registro.password`: máximo **72 bytes** (422 claro) | `bcrypt>=5` lanza `ValueError` con contraseñas > 72 bytes en `hashpw` → hoy daría 500. Verificar con la versión instalada |
| A2 | Límite de intentos en `/auth/login` y `/auth/registro` (en memoria, por IP + alias; p. ej. 5 fallos/min) | Riesgo "vulnerabilidades en la autenticación" (diapositiva 13). Sin dependencias nuevas si es posible |
| A3 | Validar `JWT_SECRET` (mínimo 32 caracteres) | Hoy basta con cualquier cadena no vacía |
| A4 | `docs_url`/`redoc_url`/`openapi_url` configurables (`ENABLE_DOCS`, por defecto `true` en local) | Poder ocultar `/docs` en un despliegue público |
| A5 | `/salud` real: `SELECT 1` en Postgres y ping a Mongo; HTTP **503** si Postgres falla. Añadir `GET /salud/vivo` trivial para el healthcheck | Hoy devuelve `"postgres": "ok"` siempre |
| A6 | Índice único `lower(alias)` (`sql/002_alias_unico.sql`) o captura de `UniqueViolation` → 409 | Hoy la unicidad case-insensitive se comprueba en código (carrera entre dos registros simultáneos) |
| A7 | Cerrar el pool en `lifespan` también con Mongo/httpx (`mongo.cerrar()`, `tmdb.cerrar()`) | Parada limpia del contenedor (`SIGTERM`) |
| A8 | Logging por `LOG_LEVEL` y sin datos personales (no loguear emails ni tokens) | GDPR (diapositiva 9) |
| A9 | Fijar versiones en `requirements.txt` (`==`) y separar `requirements-dev.txt` (`pytest`, `ruff`, `mongomock`) | Imagen reproducible y compatible con `model.joblib` (R2) |
| A10 | Quitar `sys.path.insert` frágil solo si molesta a `ruff`/imports; **no** reestructurar paquetes ahora | Evitar riesgo antes de NF3 |

No se cambian rutas ni JSON: el contrato lo consume `src/web/src/api/index.js` y está documentado en `src/web/README.md`.

### 4.2 Autenticación (estado y requisitos)

- Hash: bcrypt coste 12. Token: JWT HS256, `sub` = id, caducidad 7 días (`JWT_DIAS`). Roles `user|admin`; `require_admin` → 403.
- Cuenta desactivada: 403 al entrar y en cada petición. Usuario borrado: 401.
- Error de login genérico ("Alias o contraseña incorrectos").
- **Sin recuperación de contraseña** (OUT, diapositiva 6) ni refresh tokens.
- Pruebas de autorización obligatorias (diapositiva 13): sin token → 401, token manipulado/caducado → 401, usuario normal en `/admin/*` → 403, usuario desactivado → 403, un usuario no ve datos de otro.

### 4.3 Pruebas

- Hoy: `src/api/prueba_api.py` (script, 53 comprobaciones). Necesita Postgres con el esquema **y las 4.803 películas** (`>= 4795`) y los artefactos; usa `mongomock` y TMDB simulado.
- Objetivo: ejecutarlo tal cual en CI contra un servicio `postgres` sembrado (misma semilla que el modo local de Docker) y, después, migrar a `pytest` + `TestClient` en `tests/api/` (diapositiva 12). Variable `PRUEBA_PG` ya soportada.
- Añadir casos de A1–A3, A5 y de autorización (§4.2).

---

## 5. CI (objetivo 3) y repositorio

### 5.1 GitHub Actions: `.github/workflows/ci.yml`

Disparadores: `pull_request` y `push` a `main`. Jobs (en paralelo salvo indicación):

| Job | Pasos | Falla si |
|---|---|---|
| `lint` | Python 3.11, `pip install ruff`, `ruff check src` (y `ruff format --check` opcional) | cualquier error de `ruff` |
| `api-tests` | servicio `postgres:16` → aplicar `esquema_local.sql` + semilla → generar artefactos → `pip install -r requirements.txt -r requirements-dev.txt` → `python src/api/prueba_api.py` | algún `FALLA` (sale con código 1) |
| `motor-tests` | generar artefactos → `pytest src/models/prueba_motor.py` con `ARTEFACTOS` | alguna prueba de coherencia |
| `web-build` | Node 22, `npm ci`, `npm run build` en `src/web` | el build falla |
| `docker-build` | `docker build` de `api.Dockerfile` y `web.Dockerfile` (sin push) | fallo de build |

Detalles:
- **Artefactos en CI:** están ignorados por git. Se generan con `features.py --movies tmdb_5000_movies.csv` (el CSV de la raíz está versionado; el limpio `tmdb_5000_clean.csv` **no**). Hay que comprobar que `features.py` acepta solo `--movies` (acepta `credits` opcional) y que los ids coinciden con la semilla. Alternativa si no: `actions/cache` + artefacto publicado en una Release.
- **Semilla en CI:** requiere `genres/movies/movie_genre.csv` versionados (≈2 MB) en `environment/seed/postgres/`.
- Caché de pip y npm (`actions/setup-python`/`setup-node` con `cache`).
- Configuración de `ruff` en `ruff.toml` (raíz): `line-length = 140`, reglas `E,F,I` al principio; ampliar después. Ajustar sin reescribir el código de los compañeros.
- Secretos: la CI **no** usa Neon, Atlas ni TMDB reales; `JWT_SECRET` de prueba en el workflow.

### 5.2 Repositorio y flujo (diapositiva 12)

- `.gitignore` raíz: `.env`, `.venv/`, `__pycache__/`, `node_modules/`, `dist/`, `src/artefactos/`, `docs/artefactos/`, `docs/Mongo/`, `data/` (CSV).
- Rama `main` protegida: PR obligatoria, 1 aprobación de otro miembro, CI verde, squash merge.
- Ramas `feature/HU-xx-…`, `fix/…`, `docs/…`; issue por tarea en GitHub Projects enlazado a la PR.
- `docs/decisiones.md`: registrar al menos (1) `psycopg` en lugar de SQLAlchemy, (2) sin Alembic (SQL versionado en `src/api/sql/`), (3) Neon+Atlas como entorno principal y Docker local para CI/demo, (4) 1 worker uvicorn por catálogo en memoria.
- Actualizar README raíz: estructura real, comandos de Docker, atribución a TMDB, integrantes.

---

## 6. Riesgos y decisiones abiertas

| ID | Riesgo / decisión | Propuesta |
|---|---|---|
| R1 | Quedan **3 días** hasta NF3 (12/11) y no hay Docker ni CI | Prioridad estricta: Docker local (§3) antes que A1–A10; CI mínima (`lint` + `web-build`) antes que la completa |
| R2 | `model.joblib` depende de la versión de scikit-learn/numpy/pandas; la imagen usa Python 3.11 y la máquina local 3.14 | Pedir a Roberto las versiones exactas y fijarlas en `requirements.txt`; si no, regenerar artefactos dentro del contenedor |
| R3 | `src/artefactos/` está vacío; los artefactos están en `docs/artefactos/` (sin ignorar → riesgo de subir ~25 MB) | Copiar a `src/artefactos/` y añadir `docs/artefactos/` al `.gitignore` |
| R4 | `docs/models/` duplica `src/models/` (solo difiere en saltos de línea) | Pedir a Ramón que no lo suba; ignorar o borrar |
| R5 | `docs/Mongo/movie_details.json` pesa 39 MB; `movie_details.jsonl` está vacío | No versionar; compartir por otro canal. Sembrado local lo monta desde una ruta configurable |
| R6 | Usuarios de ejemplo de Neon con hash falso | No cargarlos en local; crear admin por SQL |
| R7 | Mongo Atlas filtra por IP | En modo nube desde Docker, la IP de salida es la del host; añadirla en Atlas si hace falta |
| R8 | Las claves de nube (Neon, Atlas, TMDB, JWT) | Solo en `.env` local; **nunca** en el repo ni en la imagen. Rotar si alguna se publicó |

---

## 7. Fuera de alcance (Plataforma)

HTTPS/dominio y despliegue público, Kubernetes, Alembic, refresh tokens, recuperación de contraseña, rate limiting distribuido (Redis), observabilidad avanzada, escalado horizontal de la API.

---

## 8. Definición de terminado (Plataforma)

1. `docker compose up --build` funciona en una máquina limpia en modo local y en modo nube (§3.6).
2. API con A1–A9 aplicados y pruebas de autorización en verde.
3. CI en verde en cada PR con los 5 jobs de §5.1; `main` protegida.
4. README raíz, `docs/decisiones.md` y este spec reflejan lo implementado.
