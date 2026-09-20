# 🎬 CineStart

**CineStart** es un sistema de recomendación híbrido de películas desarrollado como Trabajo de Fin de Máster (TFM) en Big Data e IA. El proyecto combina técnicas de filtrado colaborativo, basado en contenido y modelos híbridos para ofrecer recomendaciones personalizadas y explicadas, con especial foco en resolver el problema de **arranque en frío** (cold start): usuarios con menos de cinco valoraciones.

---

## 🎯 Objetivo principal

Diseñar y construir un recomendador híbrido de películas, accesible mediante una **API** y una **aplicación web**, capaz de:

- Ofrecer recomendaciones personalizadas y explicadas a usuarios nuevos o con muy poco historial (< 5 valoraciones).
- Superar en precisión y acierto a una lista de "populares" tradicional en el escenario de arranque en frío.
- Servir como base evaluable y desplegable mediante contenedores Docker.

---

## 📋 Alcance del proyecto

### ✅ IN · Funcionalidades mínimas

- Ingesta de **MovieLens** y enriquecimiento con **TMDB**.
- Limpieza, EDA (análisis exploratorio de datos) y almacenamiento en **PostgreSQL** y **MongoDB**.
- Modelos de recomendación: populares, colaborativo, basado en contenido e híbrido.
- Onboarding de usuario y explicación de cada recomendación.
- API construida con **FastAPI**, frontend en **React** y cuadro de mando (dashboard).
- Evaluación comparativa de modelos y despliegue mediante **Docker**.

### 🚫 OUT (fuera de alcance en esta primera versión)

- *(Pendiente de definir según los límites establecidos en la presentación)*

---

## 🏗️ Arquitectura de alto nivel

El sistema se organiza en **seis piezas** principales:

| Componente        | Descripción                                                      |
|--------------------|-------------------------------------------------------------------|
| **Ingesta y ETL**  | MovieLens + TMDB, procesamiento por lotes y con caché              |
| **Almacén**        | PostgreSQL + MongoDB + Parquet                                     |
| **Motor**          | Modelos de contenido, K-means (clustering) e híbrido               |
| **Reglas**         | Ajustan y explican cada sugerencia generada                        |
| **API y web**      | FastAPI + React, con flujo de onboarding para nuevos usuarios       |
| **Cuadro y Docker**| KPIs de evaluación y despliegue mediante Docker Compose             |

---

## 🗂️ Fuentes de datos candidatas

| Fuente          | Tipo de dato                          | Acceso                        | Riesgo o licencia                              |
|-----------------|-----------------------------------------|--------------------------------|--------------------------------------------------|
| **MovieLens**   | Tabular · ~100.000 valoraciones         | Público, IDs anonimizados      | Licencia académica, requiere cita                |
| **API de TMDB** | Texto, JSON e imágenes (pósters)        | Público, con API key gratuita  | Límite de peticiones y atribución obligatoria    |
| **IMDb** (alt.) | Tabular · títulos y notas medias        | Público                        | Solo uso no comercial, sin valoraciones          |
| **Logs de la app** | Valoraciones y clics                 | Simulados                      | Sin datos de personas reales                     |

---

## 🧩 Stack tecnológico

- **Backend / API:** FastAPI
- **Frontend:** React
- **Bases de datos:** PostgreSQL (estructurado), MongoDB (semi-estructurado), Parquet (almacenamiento analítico)
- **Modelado:** Filtrado colaborativo, basado en contenido, K-means, modelo híbrido
- **Infraestructura:** Docker / Docker Compose
- **Migraciones de BD:** Alembic
- **Otros:** n8n (automatización de flujos, si aplica al pipeline de datos)

---

## 🚀 Puesta en marcha (borrador inicial)

> ⚠️ Sección en construcción — se completará conforme avance la implementación.

```bash
# Clonar el repositorio
git clone https://github.com/<usuario>/cinestart.git
cd cinestart

# Levantar servicios con Docker Compose
docker compose up -d --build
```

---

## 📊 Evaluación

El proyecto incluirá una evaluación comparativa entre:

- Recomendador basado en **popularidad** (baseline).
- Recomendador **colaborativo**.
- Recomendador **basado en contenido**.
- Recomendador **híbrido** (propuesta principal).

El foco de la comparación estará en el escenario de **arranque en frío**, midiendo precisión y acierto frente a la lista de populares.

---

## 📁 Estructura del repositorio (propuesta)

```
cinestart/
├── ingestion/        # Scripts de ETL: MovieLens + TMDB
├── storage/           # Modelos de datos: PostgreSQL, MongoDB, Parquet
├── models/            # Modelos de recomendación (populares, colaborativo, contenido, híbrido)
├── api/               # API FastAPI
├── web/               # Frontend React
├── dashboard/         # Cuadro de mando / KPIs
├── docker/            # Dockerfiles y docker-compose.yml
└── docs/              # Documentación del TFM
```

---

## 📄 Licencia

*(Pendiente de definir)*

---

## ✍️ Autor

Proyecto desarrollado como Trabajo de Fin de Máster en Big Data e Inteligencia Artificial.
