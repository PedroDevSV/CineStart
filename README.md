# 🎬 CineStart

[![CI](https://github.com/PedroDevSV/CineStart/actions/workflows/ci.yml/badge.svg)](https://github.com/PedroDevSV/CineStart/actions/workflows/ci.yml)

**CineStart** es un recomendador híbrido de películas pensado para **usuarios nuevos** (problema de arranque en frío). El usuario se registra con un alias, valora al menos 3 películas y recibe al instante 10 recomendaciones explicadas. El motor combina similitud de contenido (géneros, temas, director, reparto, sinopsis), popularidad ponderada y reglas de diversidad. Un panel de administración mide cobertura, diversidad, novedad y aceptación.

Proyecto del módulo **C088 · Proyecto de Inteligencia Artificial y Big Data** (Curso de especialización en IA y Big Data), **Grupo 2**.

| Integrante | Rol | Responsabilidades |
|---|---|---|
| Ramón Moncholí | Data / BI | Ingesta, limpieza, EDA, cliente de TMDB, modelo de datos SQL/NoSQL |
| Roberto Raya | ML / BI | Features, clustering, motor de recomendación, reglas y validación |
| Pedro Sandoval | Platform / BI | API FastAPI, autenticación, Docker, CI y repositorio |
| Todos | Frontend | Web React (usuario y administración), KPIs y documentación |

> **Entrega NF3:** el commit evaluable es el del tag `nf3` (ver [Versión de entrega](#-versión-de-entrega)).

---

## 🚀 Arrancar desde cero

### Requisitos previos
- **Git** y **Docker Desktop** (Docker Compose v2.20+). Nada más: Python y Node se usan *dentro* de los contenedores.
- ~3 GB libres de disco y los puertos **8000** (API), **8080** (web), **5432** (Postgres) y **27017** (Mongo) libres.
- Opcional, solo para desarrollar fuera de Docker: Python 3.11 y Node 22.

### Pasos (modo local: no necesita cuentas externas)

```bash
git clone https://github.com/PedroDevSV/CineStart.git
cd CineStart

# 1. Variables de entorno (Windows: copy environment\.env.example environment\.env)
cp environment/.env.example environment/.env

# 2. Pon un JWT_SECRET en environment/.env (cadena larga y aleatoria):
python -c "import secrets; print(secrets.token_urlsafe(48))"      # o: openssl rand -base64 48

# 3. Levantar todo
docker compose -f environment/docker-compose.yml -f environment/docker-compose.local.yml up --build -d
```

La primera vez tarda unos minutos (descarga de imágenes y carga de los datos). Cuando termine:

| Qué | URL |
|---|---|
| **Web** | http://localhost:8080 |
| API (documentación interactiva) | http://localhost:8000/docs |
| Salud de los servicios | http://localhost:8000/salud → `postgres ok`, `mongodb ok`, `4803` películas |

**Orden de arranque** (lo gestiona Compose con healthchecks): `postgres` y `mongo` → `mongo-seed` (importa `movie_details`) → `api` (carga el catálogo y el motor) → `web`.

Para parar: `docker compose -f environment/docker-compose.yml -f environment/docker-compose.local.yml down` (añade `-v` para borrar también los datos y volver al estado inicial).

### Crear un administrador

El panel `/admin` solo lo ve el rol `admin`. Regístrate en la web y ejecuta:

```bash
docker compose -f environment/docker-compose.yml -f environment/docker-compose.local.yml exec postgres \
  psql -U cinestart -d cinestart -c "UPDATE users SET role='admin' WHERE alias='tu_alias';"
```
Cierra sesión y vuelve a entrar.

### Variables de entorno (`environment/.env`)

| Variable | Obligatoria | Para qué |
|---|---|---|
| `JWT_SECRET` | **Sí** | Firma de los tokens de sesión. Sin ella la API no arranca |
| `TMDB_TOKEN` | No | «API Read Access Token» de [TMDB](https://www.themoviedb.org/settings/api). Sin él la API funciona, pero no completa pósters ni sinopsis en castellano ni busca fuera del catálogo |
| `CORS_ORIGINS` | No | Orígenes permitidos (por defecto la web de Docker, `http://localhost:8080`) |
| `DATABASE_URL`, `MONGO_URI`, `MONGO_DB` | Solo en modo nube | El modo local las fija solo con el override `docker-compose.local.yml` |
| `PGHOST`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `PGSSLMODE`, `PGCHANNELBINDING` | Solo en modo nube | Alternativa a `DATABASE_URL` para Neon |

`environment/.env` está en `.gitignore`: **nunca se sube**. Las claves reales se piden al equipo.

### Modo nube (Neon + MongoDB Atlas)

Usa las bases de datos reales del equipo en lugar de contenedores. Rellena en `environment/.env` las variables de Neon y Atlas (ver `environment/.env.example`) y arranca **solo** con el compose base:

```bash
docker compose -f environment/docker-compose.yml up --build -d
```
Atlas solo acepta IPs de su lista (*Network Access*). La API funciona aunque no haya `MONGO_URI` (sin emails de usuario y con el reparto pedido a TMDB).

---

## 🧪 Pruebas

| Qué | Cómo | Resultado |
|---|---|---|
| Lint | `ruff check src` | sin errores |
| Build de la web | `cd src/web && npm ci && npm run build` | build correcto |
| Coherencia del motor (9 pruebas) | `cd src/models && python prueba_motor.py ../artefactos` | `TODO BIEN` |
| API completa (53 comprobaciones: auth, roles, onboarding, recomendaciones, biblioteca, admin) | Postgres sembrado + `cd src/api && PRUEBA_PG="host=127.0.0.1 port=5432 user=cinestart password=cinestart dbname=cinestart" python prueba_api.py` (necesita `pip install -r requirements.txt mongomock`) | `TODO BIEN` |

Las pruebas de la API usan una copia local del esquema, **Mongo simulado (mongomock)** y **TMDB simulado**: no tocan servicios reales. Suponen la base recién sembrada (4.803 películas, sin otros usuarios).

La **CI** (GitHub Actions, `.github/workflows/ci.yml`) ejecuta todo en cada PR y push a `main`: `Lint`, `Build de la web`, `Pruebas del motor`, `Pruebas de la API` y `Build de las imágenes Docker`. Los logs de las pruebas se publican como artefactos de cada ejecución.

---

## 🏗️ Arquitectura

```
                    ┌──────────────────────── Docker Compose ───────────────────────────┐
 Navegador ──HTTP──▶│  web (nginx + React/Vite) :8080                                    │
                    │        │ REST/JSON + JWT                                           │
                    │        ▼                                                           │
                    │  api (FastAPI) :8000 ── motor híbrido (src/models) + artefactos    │
                    │     │          │               │                                  │
                    │     ▼          ▼               ▼                                  │
                    │ PostgreSQL   MongoDB        API de TMDB (HTTPS, solo lo que falta) │
                    │ (Neon o      (Atlas o      pósters, sinopsis es, búsquedas         │
                    │  contenedor) contenedor)                                           │
                    └────────────────────────────────────────────────────────────────────┘
```

- **PostgreSQL**: usuarios (alias + hash bcrypt), valoraciones, descartes, géneros, catálogo (`movies`), recomendaciones servidas (base de los KPIs) y «Mi lista».
- **MongoDB**: `movie_details` (reparto, equipo, keywords por película) y `user_contacts` (el email, dato personal, fuera de PostgreSQL).
- **Artefactos del motor** (`src/artefactos/`): embeddings, modelo TF-IDF/SVD/KMeans y vecinos, generados por `src/models/features.py` con **scikit-learn 1.7.2** y versionados en el repo.
- **Seguridad**: bcrypt, JWT con caducidad (7 días), roles `user`/`admin`, secretos en `.env`.
- **La API corre con un solo worker**: el catálogo y el motor viven en memoria.

---

## 📁 Estructura del repositorio

```
CineStart/
├── .github/workflows/ci.yml     CI: lint, build web, pruebas del motor y de la API, build Docker
├── environment/                 Todo lo de Docker
│   ├── docker-compose.yml           modo nube: web + api
│   ├── docker-compose.local.yml     override local: postgres, mongo, mongo-seed
│   ├── api.Dockerfile · web.Dockerfile · nginx.conf
│   ├── .env.example                 plantilla de variables (sin secretos)
│   └── seed/
│       ├── postgres/                esquema + CSV del catálogo (genres, movies, movie_genre)
│       └── mongo/movie_details.json.gz    volcado de Mongo comprimido
├── src/
│   ├── api/                     API FastAPI (ver src/api/README.md)
│   │   ├── main.py · config.py · db.py · mongo.py · tmdb.py · catalogo.py · seguridad.py
│   │   ├── rutas/                   auth, peliculas, biblioteca, admin
│   │   ├── sql/                     esquema local y migración de «Mi lista»
│   │   ├── prueba_api.py            53 comprobaciones
│   │   └── requirements.txt         dependencias de la API y del motor
│   ├── models/                  Motor: features.py (genera artefactos), motor.py, prueba_motor.py
│   ├── artefactos/              embeddings.npy, model.joblib, *.parquet (salida de features.py)
│   └── web/                     React + Vite: usuario y /admin (ver src/web/README.md)
├── scripts/                     análisis y limpieza previos (analisis_kmeans.py, pruebas_merged.py; Ramón / Roberto)
├── data/                        tmdb_5000_movies.csv: CSV original del TMDB 5000 (Kaggle); el resto de CSV se ignora
├── docs/                        Documentación de Fase 1 (presentación de diseño) y muestras CSV de Neon
├── SPEC.md                      especificación técnica detallada (arquitectura, datos, API, Docker, CI)
├── TO-DO.md                     plan y pendientes de la parte de Plataforma
├── ruff.toml · .gitignore · .dockerignore · .gitattributes
└── README.md
```

> **Documentación:** este README (cómo arrancar), [SPEC.md](./SPEC.md) (detalle técnico) y [TO-DO.md](./TO-DO.md) (pendientes), más el README de cada módulo ([api](./src/api/README.md), [web](./src/web/README.md), [models](./src/models/README.md)).

---

## 🗂️ Datos, artefactos y licencias

| Dato | Origen | Dónde está | Licencia / privacidad |
|---|---|---|---|
| Catálogo (4.803 películas) | [TMDB 5000 Movie Dataset](https://www.kaggle.com/datasets/tmdb/tmdb-movie-metadata) (Kaggle), limpiado | `environment/seed/postgres/*.csv` y `data/tmdb_5000_movies.csv` | Uso **no comercial con atribución a TMDB** |
| Detalle de películas (reparto, equipo…) | Mismo dataset | `environment/seed/mongo/movie_details.json.gz` (8 MB) | Ídem |
| Artefactos del motor | Generados con `src/models/features.py` | `src/artefactos/` (25 MB) | Derivados del dataset; no contienen datos personales |
| Pósters y sinopsis en castellano | API de TMDB, bajo demanda | Se guardan en la base de datos; las imágenes se sirven desde el CDN de TMDB | Atribución obligatoria (ver abajo) |
| Usuarios y valoraciones | Cuentas de prueba del equipo | Solo en las bases de datos | Sin datos de personas reales. En PostgreSQL solo alias y hash; el email va aparte, en Mongo |

El detalle de las tablas y colecciones está en [SPEC.md](./SPEC.md#4-modelo-de-datos).

### Desarrollo sin Docker (opcional)

API: `src/api/README.md` (necesita Python 3.11, un `src/api/.env` y Postgres/Mongo accesibles). Web: `cd src/web && npm install && npm run dev` (`VITE_USE_MOCKS=true` en `src/web/.env` la hace funcionar sola, con datos de ejemplo). Regenerar los artefactos del motor: `src/models/README.md`.

---

## 📌 Versión de entrega

La entrega NF3 corresponde al tag **`nf3`** del repositorio. Para ver exactamente ese código:

```bash
git clone https://github.com/PedroDevSV/CineStart.git && cd CineStart && git checkout nf3
```

---

## 🙏 Atribución

Este producto utiliza la API de TMDB pero no está avalado ni certificado por TMDB. Los datos de películas y las imágenes provienen de [The Movie Database (TMDB)](https://www.themoviedb.org/).

## 📄 Licencia

Proyecto académico, uso no comercial. Los datos están sujetos a los términos de TMDB y Kaggle.
