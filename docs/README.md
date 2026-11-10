# CineStart · estructura del repositorio

```
data/            CSV limpio (tmdb_5000_clean.csv) — no se sube a GitHub
docs/            documentación (Fase 1: documentación y diseño técnico)
src/models/      ML: features.py (features, clusters, popularidad) y motor.py (recomendador híbrido)
src/artefactos/  lo que genera features.py — versionado en el repo (25 MB); se puede regenerar
src/api/         API FastAPI: une la web con Neon, MongoDB Atlas, TMDB y el motor
src/web/         web (React + Vite)
environment/     Docker: compose, Dockerfiles y semilla de datos
```

> **Forma recomendada de arrancar todo: Docker.** Ver el [README de la raíz](../README.md). Lo de abajo es para desarrollar fuera de contenedores.

## Arrancar todo en local (sin Docker)

1. **Artefactos del modelo:** ya están en `src/artefactos/`. Para regenerarlos, con el CSV en `data/`:
   ```bash
   cd src/models
   pip install pandas scikit-learn pyarrow joblib scipy
   python features.py --csv ../../data/tmdb_5000_clean.csv --out ../artefactos/
   python prueba_motor.py ../artefactos/
   ```
2. **API:** sigue `src/api/README.md`. Necesita un `src/api/.env` con las claves: pídeselo al equipo, nunca se sube.
   Para comprobar que todo conecta, abre http://localhost:8000/salud.
3. **Web:** con la API arrancada, ejecuta:
   ```bash
   cd src/web
   npm install
   npm run dev -- --port 5180
   ```
   El `src/web/.env` necesita `VITE_USE_MOCKS=false`. Con `true`, la web funciona sola con datos de ejemplo, sin la API.
