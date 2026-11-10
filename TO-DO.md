# TO-DO · Pedro (Platform: Docker, API, auth, CI)

Guía de trabajo para mi parte. Detalle y criterios en [SPEC_PLATAFORMA.md](./SPEC_PLATAFORMA.md).
**Fecha clave: NF3 el 12/11** → lo marcado 🔥 es lo mínimo para llegar con "versión funcional de principio a fin".

Flujo Git: una rama por bloque (`feature/docker-compose`, `feature/api-seguridad`, `feature/ci`…), PR a `main`, squash merge.

---

## 🎯 NF3 · Entrega del 12/11 (Blackboard: PDF + enlaces/evidencias)

**Actividad:** «Producto funcional y repositorio reproducible» (RA4 y RA5, evaluada con rúbrica). Fichero: `NF3_Producto_Funcional_Local_y_Repositorio_NombreAlumno_Apellido1_Apellido2.pdf`.

**El PDF debe llevar:** (1) portada con proyecto, integrantes, fecha y repositorio · (2) estado actual: completo / parcial / pendiente para NF4 · (3) guía de ejecución local desde cero (requisitos, pasos exactos, variables de entorno, orden de arranque) · (4) evidencias: capturas del front, del backend activo y del flujo completo · (5) arquitectura real + diagrama · (6) índice de código con la estructura **real** del repo · (7) repositorio versionado y reproducible.

**Evidencias mínimas del repositorio (obligatorias) → estado de mi parte**

| Requisito | Estado | Qué falta |
|---|---|---|
| Enlace al repo y **tag o commit exacto** de entrega | ❌ | Mergear la PR #2 y crear el tag `nf3` (ver bloque N5) |
| README con requisitos, configuración y comandos | ❌ | README raíz desfasado (describe carpetas y Alembic que no existen). Reescribir (N1) |
| Fichero de dependencias/lockfile y `.env` de ejemplo sin secretos | ⚠️ | Hay `requirements.txt` (parcialmente fijado), `package-lock.json` y `environment/.env.example`. Fijar versiones con `==` (A9) |
| **Pruebas automatizadas y evidencias de su resultado** | ⚠️ | La CI solo hace lint + build. Añadir `api-tests` y `motor-tests` (N3) y guardar capturas del resultado |
| Estructura real del repo y explicación de módulos | ⚠️ | Escribirla en el README (N1) |
| Datos y artefactos versionados o **referenciados** según licencia y privacidad | ❌ | Un clon limpio **no puede arrancar**: faltan los artefactos, el CSV limpio y el volcado de Mongo (N2) |

**Bloqueo detectado (N2): reproducibilidad desde un clon limpio.** `src/artefactos/` está ignorado por git; `features.py` necesita `tmdb_5000_clean.csv` (no está) o los dos CSV originales de Kaggle (en el repo solo está `tmdb_5000_movies.csv`, sin `credits`); y el Mongo local necesita `movie_details.json` (borrado de `docs/`). Hay que **decidir con el equipo** una de estas vías:
1. **Versionar los artefactos** (~25 MB; `model.joblib` pesa 20 MB, bajo el límite de 100 MB de GitHub) y una muestra/volcado comprimido de Mongo. Más simple y reproducible al instante.
2. **Referenciarlos**: subirlos a una *Release* de GitHub y añadir un script `scripts/descargar_datos.ps1/.sh`; o generarlos con `features.py` desde los CSV originales de Kaggle (TMDB 5000, licencia en su página; no se redistribuyen).
3. Mongo opcional: la API ya arranca sin Mongo (sin emails y con reparto pedido a TMDB). Documentarlo como "modo mínimo".

### Plan hasta el 12/11 (por prioridad)

- [ ] **N1 · README raíz** (🔥): descripción, integrantes y roles, arquitectura real, **requisitos** (Docker Desktop, Git; Node 22 y Python 3.11 solo para desarrollo), **pasos exactos** (clonar → `cp environment/.env.example environment/.env` → generar `JWT_SECRET` → arrancar), **variables de entorno** (tabla), **orden de arranque** (postgres → mongo → mongo-seed → api → web), URLs, cómo crear un admin, cómo ejecutar pruebas, estructura real del repo con explicación de módulos, atribución a TMDB y licencias de datos, insignia de CI.
- [ ] **N2 · Reproducibilidad** (🔥): decidir y aplicar la vía de arriba; comprobar con un **clon limpio en otra carpeta** (`git clone` → `docker compose up`) que arranca y que `/salud` da `ok`.
- [ ] **N3 · Pruebas en CI con evidencia** (🔥): jobs `api-tests` (Postgres de servicio + semilla + `prueba_api.py`) y `motor-tests` (`prueba_motor.py`); `docker-build`. Que los jobs suban el log como artefacto y guardar capturas del run en verde para el PDF.
- [ ] **N4 · Evidencias para el PDF**: capturas de (a) web de usuario (login, onboarding, top-10, ficha), (b) panel `/admin`, (c) `/docs` de la API y `/salud`, (d) `docker compose ps`, (e) CI en verde. Para que el panel no salga vacío hace falta datos de uso simulados (script pendiente de Ramón).
- [ ] **N5 · Cierre**: merge de la PR #2 (1 aprobación), crear el tag `nf3` en `main` (`git tag -a nf3 -m "Entrega NF3"; git push origin nf3`), anotar el **commit exacto** en el PDF y comprobar que el repo es accesible para el profesor.
- [ ] **N6 · Mi parte del PDF**: secciones 3 (guía de ejecución), 5 (arquitectura real: Docker Compose con web, API, Postgres/Neon, Mongo/Atlas, TMDB, motor + artefactos), 6 (índice de código) y 7 (reproducibilidad y CI). Cada integrante entrega **su** PDF con su nombre, y las contribuciones individuales deben quedar documentadas (commits/PRs a nombre de cada uno).
- [ ] **N7 · Estado actual (sección 2) desde mi lado**: completo = Docker local y nube, auth, API de usuario y admin, CI mínima · parcial = pruebas en CI, endurecimiento de seguridad · pendiente NF4 = A1–A9, rate limit, tests con `pytest`, `docker-build`, pipeline de ingesta.

> Lo de la Fase 2 (endurecer la API) queda **después** de N1–N5, salvo A9 (fijar versiones), que sí entra en N1/N2 por ser "fichero de dependencias".

---

## Fase 0 · Preparación (30 min) 🔥

- [x] Crear rama `feature/docker-compose`.
- [x] Copiar los artefactos: `docs/artefactos/*` → `src/artefactos/` (ignorado por git).
- [x] Crear `.gitignore` en la raíz (`.env`, `.venv/`, `__pycache__/`, `node_modules/`, `dist/`, `src/artefactos/`, `docs/Mongo/`).
- [x] Comprobar con `git status` que no aparecen volcados pesados para añadir.
- [x] ~~Pedir a Roberto las versiones~~ Resuelto leyendo el pickle: `scikit-learn==1.7.2` (NumPy 2.x). Fijado en `requirements.txt`; confirmar con Roberto solo si cambia el modelo.
- [ ] Pedir al equipo los datos de la nube (Neon, Atlas, TMDB) para mi `.env` **local** (nunca al repo).
- [ ] Abrir issues en GitHub Projects: Docker, API-seguridad, CI, docs.

## Fase 1 · Docker 🔥

### 1.1 Base
- [x] Crear `environment/` y `.dockerignore` en la raíz (excluir `.git`, `**/node_modules`, `**/.venv`, `**/.env`, `docs/`, `data/`, `src/artefactos/`).
- [x] `environment/.env.example` (variables del §3.4 del spec) y copiarlo a `environment/.env` (ignorado).
- [x] `environment/.env` con `JWT_SECRET`, Neon (`PG*`), Atlas (`MONGO_URI`, usuario `cinestart_api`) y `TMDB_TOKEN`. ✔ Probado: la imagen de la API arranca contra la nube y `/salud` da `postgres ok`, `mongodb ok`, `tmdb ok`, 4.805 películas.

### 1.2 Imagen de la API
- [x] `environment/api.Dockerfile`: `python:3.11-slim`, `WORKDIR /app/api`, instalar `requirements.txt`, copiar `src/api` → `/app/api` y `src/models` → `/app/models`, usuario no root, `CMD uvicorn main:app --host 0.0.0.0 --port 8000` (**1 worker**).
- [x] Fijar scikit-learn (resto de versiones `==` en A9).
- [x] `docker build -f environment/api.Dockerfile -t cinestart-api .` ✔ · verificado: el motor carga 4.795 películas con los artefactos montados, sin avisos de versión, y el contenedor corre como `cinestart` (no root). Falta probar el arranque completo (necesita Postgres → paso 1.4/1.5).

### 1.3 Imagen de la web
- [x] `environment/web.Dockerfile`: etapa `node:22-alpine` (`npm ci && npm run build` con `ARG VITE_USE_MOCKS=false`, `ARG VITE_API_URL=http://localhost:8000`) → `nginx:alpine`.
- [x] `environment/nginx.conf` con `try_files $uri /index.html;`.
- [x] Probado: `/` y `/pelicula/27205` → 200 (sin 404 al recargar), `/assets/inexistente.js` → 404.

### 1.4 Semilla local (override `docker-compose.local.yml`)
- [x] `genres.csv`, `movies.csv`, `movie_genre.csv` copiados a `environment/seed/postgres/` (se versionan, ~2 MB). Ya no están en `docs/`.
- [x] `00_esquema.sql` y `10_carga.sql` (`runtime_min` llega como `162.0`: se carga vía tabla temporal). Resultado: 4.803 películas, 12.160 relaciones, 20 géneros.
- [x] Importación de Mongo dentro del compose (servicio `mongo-seed`, `mongoimport --jsonArray`, solo si la colección está vacía). El JSON se monta desde `docs/Mongo/` (o `MONGO_SEED_DIR`) y **no** se versiona; se borró de `docs/` y se vuelve a sacar de Atlas con `mongoexport` (ver `docs/DATOS.md`). Resultado: 4.803 documentos.

### 1.5 Compose
- [x] `environment/docker-compose.yml` (modo nube: `api` + `web`) y `environment/docker-compose.local.yml` (override: `postgres`, `mongo`, `mongo-seed`; fuerza `DATABASE_URL`/`MONGO_URI` locales y `PGSSLMODE=disable`). Se eligió override en vez de perfiles: el modo nube no necesita `required: false`.
- [x] Volúmenes `pgdata` y `mongodata`; artefactos montados `:ro` en `/app/artefactos`.
- [x] Healthchecks (`pg_isready`, ping de Mongo, `/salud` de la API) y `depends_on` con `service_healthy`.
- [x] `CORS_ORIGINS=http://localhost:8080` en `environment/.env`.

### 1.6 Verificación (criterios del §3.6)
- [x] Modo local: `docker compose -f environment/docker-compose.yml -f environment/docker-compose.local.yml up --build -d`
- [x] `curl http://localhost:8000/salud` → `postgres ok`, `mongodb ok`, `tmdb ok`, 4.803 películas.
- [x] Web en `http://localhost:8080` (`/` y `/pelicula/27205` → 200) y registro por API → 201, con el email guardado en Mongo (`user_contacts`).
- [ ] Completar el onboarding en el navegador y ver el top-10.
- [ ] Hacerme admin: `docker compose -f environment/docker-compose.yml -f environment/docker-compose.local.yml exec postgres psql -U cinestart -d cinestart -c "UPDATE users SET role='admin' WHERE alias='tu_alias';"` y abrir `/admin`.
- [x] Modo nube (solo `docker-compose.yml`, con Neon y Atlas): probado con la imagen de la API; falta una pasada con `docker compose up` completo.
- [ ] `docker compose down -v` y volver a levantar desde cero.
- [ ] Actualizar `README.md` raíz con la sección "Puesta en marcha con Docker".
- [ ] PR → revisión de otro miembro → merge.

## Fase 2 · API: endurecer y probar

Rama: `feature/api-seguridad`. Una PR pequeña por punto o agrupadas (A# = spec §4.1).

- [ ] **A1** Límite de contraseña a 72 bytes en `Registro` (422 claro). Probar primero con una de 100 caracteres para confirmar el 500 actual.
- [ ] **A3** Validar longitud mínima de `JWT_SECRET` en `config.py`.
- [ ] **A5** `/salud` con `SELECT 1` y ping a Mongo (503 si falla Postgres) + `GET /salud/vivo`; apuntar el healthcheck de Docker al segundo.
- [ ] **A2** Límite de intentos en login/registro (en memoria).
- [ ] **A6** `sql/002_alias_unico.sql` (índice único `lower(alias)`) o captura de `UniqueViolation` → 409. Comprobar antes que no hay alias duplicados en Neon.
- [ ] **A4** `ENABLE_DOCS` para ocultar `/docs` si hace falta.
- [ ] **A7** `mongo.cerrar()` y `tmdb.cerrar()` en `lifespan`.
- [ ] **A8** `LOG_LEVEL`; revisar que no se loguean emails ni tokens.
- [ ] **A9** `requirements.txt` con `==` y `requirements-dev.txt` (`pytest`, `ruff`, `mongomock`, `httpx`).
- [ ] Ejecutar `prueba_api.py` contra el Postgres del Docker local (`PRUEBA_PG="host=127.0.0.1 port=5432 user=cinestart password=cinestart dbname=cinestart"`) y comprobar que pasa.
- [ ] Añadir pruebas de autorización (HU-02): sin token 401 · token manipulado 401 · token caducado 401 · usuario normal en `/admin/*` 403 · cuenta desactivada 403 · un usuario no ve datos de otro.
- [ ] Añadir pruebas para A1, A3, A5.
- [ ] Contrastar el contrato con `src/web/README.md` (sección "Contrato de la API") tras los cambios: no deben cambiar rutas ni JSON.

## Fase 3 · CI (GitHub Actions)

Rama: `feature/ci`.

- [x] `ruff.toml` en la raíz (`line-length = 150`, reglas `E,F`; ignora `E741`). `ruff check src` pasa. Pendiente a futuro: activar `I` (orden de imports) sin romper el `sys.path.insert` de `catalogo.py` y `prueba_api.py`.
- [x] 🔥 `.github/workflows/ci.yml` mínimo: `lint` + `web-build` (`npm ci && npm run build`). **En verde en GitHub** (PR #2).
- [ ] Job `api-tests`: servicio `postgres:16`, aplicar esquema + semilla, generar artefactos, ejecutar `python src/api/prueba_api.py` con `PRUEBA_PG` y `JWT_SECRET` de prueba.
- [ ] Comprobar si `features.py --movies tmdb_5000_movies.csv --out src/artefactos` genera artefactos válidos solo con el CSV de la raíz (si no, plan B del spec §5.1).
- [ ] Job `motor-tests`: `ARTEFACTOS=src/artefactos pytest src/models/prueba_motor.py`.
- [ ] Job `docker-build` (solo build, sin push).
- [ ] Caché de pip y npm.
- [ ] Activar en GitHub: **Branch protection** de `main` (PR obligatoria, 1 aprobación, checks requeridos, squash merge).
- [ ] Añadir insignia de CI al `README.md`.

## Fase 4 · Repositorio y documentación

- [ ] `docs/decisiones.md` con las 4 decisiones del spec §5.2.
- [ ] README raíz: estructura real, Docker, atribución a TMDB, integrantes y roles, sección OUT (copiar de la diapositiva 6), licencia.
- [ ] Mover/crear `tests/` si se migra `prueba_api.py` a `pytest` (`tests/api/`).
- [ ] Avisar al equipo: no subir volcados pesados a `docs/` (ya se limpiaron; ver `docs/DATOS.md`).
- [ ] Documentar en `src/api/README.md` la ejecución en Docker y las variables nuevas (`ENABLE_DOCS`, `LOG_LEVEL`).

## Fase 5 · Después de NF3 (H4, hasta el 29/11)

- [ ] Servicio `pipeline` en el compose cuando Ramón suba `src/ingestion/`.
- [ ] Migrar `prueba_api.py` a `pytest` + `TestClient`.
- [ ] Apoyo cruzado con Frontend: comprobar contra la API real las pantallas de usuario y de admin; Lighthouse.
- [ ] Opcional: exportar KPIs a CSV (`GET /admin/kpis.csv`), MLflow.

---

## Orden recomendado para los próximos 3 días

| Día | Objetivo |
|---|---|
| 10/11 (hoy) | N2 (decisión y aplicación) + N1 (README) + N3 (jobs de pruebas en CI) |
| 11/11 | Merge de la PR, N4 (capturas), N6 (mi parte del PDF), revisión cruzada con el equipo |
| 12/11 | N5: tag `nf3`, PDF final con commit exacto y entrega en Blackboard |
