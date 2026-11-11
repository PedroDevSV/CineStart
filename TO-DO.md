# TO-DO · Pedro (Platform)

Plan de mi parte. El detalle técnico está en [SPEC.md](./SPEC.md) y la forma de arrancar el proyecto en el [README](./README.md).

## 🎯 NF3 · entrega del 12/11 (Blackboard: PDF + enlaces/evidencias)

Fichero: `NF3_Producto_Funcional_Local_y_Repositorio_NombreAlumno_Apellido1_Apellido2.pdf`.
El PDF lleva: (1) portada con proyecto, integrantes, fecha y repositorio · (2) estado actual: completo / parcial / pendiente NF4 · (3) guía de ejecución local · (4) evidencias: capturas de front, backend y flujo completo · (5) arquitectura real con diagrama · (6) índice de código con la estructura real · (7) repositorio versionado y reproducible.

### Requisitos del repositorio (rúbrica)

| Requisito | Estado |
|---|---|
| Enlace al repo y **tag o commit exacto** | ⏳ merge de la PR #2 y tag `nf3` |
| README con requisitos, configuración y comandos | ✅ |
| Dependencias/lockfile y `.env` de ejemplo sin secretos | ✅ `requirements.txt`, `package-lock.json`, `environment/.env.example` |
| Pruebas automatizadas con evidencia de resultado | ✅ CI con 5 jobs en verde (falta la captura para el PDF) |
| Estructura real del repo y módulos explicados | ✅ README + README de cada módulo + SPEC |
| Datos y artefactos versionados o referenciados | ✅ `src/artefactos/`, `environment/seed/`, `data/` |

### Pendiente antes de entregar (por orden)

- [ ] **Dar acceso al profesor.** El repo es **privado**: hacerlo público o invitarle (Settings → Collaborators). Confirmar el método en el aula virtual.
- [ ] **Merge de la PR #2** (squash). Esperar a que la CI de la rama esté en verde.
- [ ] **Tag `nf3`** sobre `main`: `git checkout main; git pull; git tag -a nf3 -m "Entrega NF3"; git push origin nf3`. Anotar el commit exacto.
- [ ] **Comprobar** en un clon limpio que `git checkout nf3` + los pasos del README arrancan (`/salud` → `postgres ok`, `mongodb ok`, 4.803 películas).
- [ ] **Capturas para el PDF:** web (login, onboarding, top-10, ficha), `/admin`, `/docs` y `/salud`, `docker compose ps` y la CI en verde (pestaña Checks de la PR o Actions).
  - Modo local: `docker compose -f environment/docker-compose.yml -f environment/docker-compose.local.yml up --build -d`; el usuario hay que registrarlo y hacerlo admin (comando en el README).
- [ ] **Datos de uso para el panel** (si no, sale vacío): pedir a Ramón el script de simulación o hacer valoraciones a mano con 2–3 usuarios.
- [ ] **Mi PDF:** secciones 3, 5, 6 y 7. Citar el commit/tag exacto y el enlace al repo. Cada integrante entrega **su** PDF y las contribuciones individuales se ven en sus commits y PRs.
- [ ] Mencionar en el PDF que la revisión cruzada de PRs y la protección de `main` se activan desde NF4 (hoy `main` no está protegida).

## 🔜 NF4 · entrega final del 10/12

**API y seguridad** (detalle en SPEC §5)
- [ ] Contraseña máx. 72 bytes (hoy bcrypt 5 puede dar 500 con claves más largas) → 422 claro.
- [ ] Límite de intentos en `/auth/login` y `/auth/registro`.
- [ ] `JWT_SECRET` con longitud mínima (hoy basta con cualquier cadena no vacía).
- [ ] `/salud` real (`SELECT 1`, ping a Mongo, 503 si falla Postgres) y `/salud/vivo` para el healthcheck.
- [ ] Índice único en `lower(alias)` (comprobar antes que no haya duplicados en Neon).
- [ ] Cerrar Mongo y TMDB en el `lifespan`; `LOG_LEVEL`; no loguear emails ni tokens; `ENABLE_DOCS` opcional.
- [ ] `requirements.txt` con `==` y `requirements-dev.txt` (`pytest`, `ruff`, `mongomock`).

**Pruebas y CI**
- [ ] Pruebas de autorización: sin token 401 · token manipulado o caducado 401 · usuario en `/admin/*` 403 · cuenta desactivada 403 · un usuario no ve datos de otro.
- [ ] Migrar `prueba_api.py` a `pytest` + `TestClient` en `tests/`.
- [ ] Regla `I` de ruff (orden de imports) sin romper los `sys.path.insert` de `catalogo.py` y `prueba_api.py`.
- [ ] Proteger `main` (PR obligatoria, 1 aprobación, checks requeridos, squash merge) y activar revisión cruzada.

**Plataforma y repo**
- [ ] Servicio `pipeline` en el compose cuando Ramón suba `src/ingestion/`.
- [ ] `docs/decisiones.md` con las decisiones de SPEC §2.
- [ ] Opcional: exportar KPIs a CSV (`GET /admin/kpis.csv`), MLflow.
- [ ] **Rotar las claves** de Neon, Atlas (`cinestart_api`) y TMDB, que pasaron por el chat.

## 📝 Notas
- `environment/.env` está en `.gitignore` y tiene las claves reales del equipo: no subirlo nunca.
- Docker Desktop hay que arrancarlo a mano si está parado.
- Si `prueba_api.py` falla en local con 2 comprobaciones (aceptación y reparto de «Matrix»), es por datos de pruebas anteriores: `docker compose ... down -v` y repetir.
