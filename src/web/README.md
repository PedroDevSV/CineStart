# CineStart · Web

Frontend de CineStart, el recomendador de películas para usuarios nuevos.
**Solo la web**: React 19 + Vite. El backend (FastAPI), las bases de datos (PostgreSQL + MongoDB + Parquet) y el modelo los pone el equipo; la web habla con ellos por la API descrita abajo.

Mientras no exista el backend, la web funciona sola con **datos de ejemplo** (`VITE_USE_MOCKS=true`): un catálogo de ~600 películas sacado del TMDB 5000 limpio, con las features y los clusters de `features.py`, y un recomendador de mentira que sigue la misma lógica que el documento.

---

## Arrancar

Requisitos: Node 20.19+ (o 22+).

```bash
npm install
cp .env.example .env      # en Windows: copy .env.example .env
npm run dev               # http://localhost:5173
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con recarga en caliente |
| `npm run build` | Versión de producción en `dist/` |
| `npm run preview` | Sirve `dist/` para probarla |
| `npm run mock-data` | Regenera el catálogo de ejemplo (ver más abajo) |

### Cuentas de ejemplo (solo en modo mock)

| Usuario | Contraseña | Qué ves |
|---|---|---|
| `demo` | `demo1234` | Usuario con 5 valoraciones y 3 películas en Mi lista |
| `admin` | `admin1234` | Panel de administración |

También puedes registrarte: pasarás por el onboarding completo. Todo se guarda en el `localStorage` del navegador (clave `cinestart.mock.v2`); bórrala para empezar de cero.

---

## Variables de entorno (`.env`)

| Variable | Valor por defecto | Para qué |
|---|---|---|
| `VITE_USE_MOCKS` | `true` | `true`: datos de ejemplo en el navegador. `false`: llama a la API real |
| `VITE_API_URL` | `http://localhost:8000` | URL base de la API FastAPI, sin barra final |
| `VITE_ROUTER_MODE` | `browser` | `browser`: rutas limpias (`/pelicula/27205`), el servidor debe devolver `index.html` en cualquier ruta. `hash`: rutas con `#`, vale para cualquier hosting estático |
| `VITE_TMDB_IMAGE_BASE` | `https://image.tmdb.org/t/p` | Base de los pósters de TMDB |

## Conectar el backend

1. Poned `VITE_USE_MOCKS=false` y `VITE_API_URL` apuntando a FastAPI.
2. En FastAPI, activad CORS para el origen de la web (`http://localhost:5173` en desarrollo):
   ```python
   from fastapi.middleware.cors import CORSMiddleware
   app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"],
                      allow_methods=["*"], allow_headers=["*"])
   ```
3. Implementad los endpoints del contrato de abajo. **Ningún componente llama a `fetch` directamente**: todo pasa por `src/api/index.js`, así que si una ruta cambia de nombre solo se toca ese archivo.

---

## Pantallas

| Ruta | Pantalla | Acceso |
|---|---|---|
| `/entrar`, `/registro` | Inicio de sesión y registro (alias + email + contraseña) | Público |
| `/bienvenida` | Onboarding: 1) hasta 3 géneros (se puede saltar) · 2) valorar ~20 películas variadas, mínimo 3 | Usuario sin onboarding |
| `/` | **Descubrir** (portada): destacada, tira con tus valoraciones, carruseles *Recomendadas para ti*, *Mi lista*, *Joyas por descubrir* y *Lo más valorado en tu género* | Usuario |
| `/buscar?q=` | Resultados: catálogo + «No está en CineStart, pero sí en TMDB» | Usuario |
| `/pelicula/:id` | Ficha: valorar, Mi lista, No me interesa, sinopsis, reparto, similares | Usuario |
| `/mi-lista` | Películas guardadas | Usuario |
| `/valoraciones` | Mis valoraciones (desde el menú del perfil): editar o borrar notas | Usuario |
| `/cuenta` | Perfil, géneros, privacidad, descarga de datos (JSON), borrar cuenta | Usuario |
| `/admin` | Resumen: cobertura, diversidad, novedad, aceptación y gráficas | Admin |
| `/admin/catalogo` | Catálogo con veces recomendada (solo consulta) | Admin |
| `/admin/usuarios` | Usuarios: activar / desactivar / borrar (nunca se ve el hash) | Admin |
| `/admin/uso` | Embudo de registro, registros y valoraciones por día | Admin |

Decisiones del documento que la web respeta:

- La portada es siempre **Descubrir**; *Mis valoraciones* está dentro del menú del perfil.
- **No se explica por qué** se recomienda una película.
- El administrador **solo consulta**: no oculta películas ni veta géneros.
- El email no se muestra en el panel de administración.

## Lazy loading

- Cada pantalla es un `React.lazy` (un archivo JS por ruta). El panel y Recharts (~390 KB) solo los descarga un administrador.
- Los carruseles que no se ven al cargar se piden cuando se acercan a la pantalla (`LazySection`, con `IntersectionObserver`).
- Pósters con `loading="lazy"` y tamaños de TMDB según el sitio (`w185`, `w342`, `w500`).
- Los datos de ejemplo (`src/api/mock`, ~470 KB) solo se descargan si `VITE_USE_MOCKS=true`. Con el backend real no se incluyen en lo que baja el usuario.

## Estructura

```
src/
  api/
    index.js        ← única puerta al backend (real o mock)
    http.js         ← fetch + JWT + errores de FastAPI
    config.js       ← lee las variables VITE_*
    mock/           ← backend de mentira para trabajar sin servidor
      data/catalog.json   (generado con scripts/build_mock_data.py)
      handlers.js · recommender.js · simulated.js · tmdbExternal.js
  components/       ← Header, SearchBox, Carousel, MovieCard, Poster, StarRating…
  context/          ← AuthContext (sesión), LibraryContext (valoraciones, descartes, Mi lista), ToastContext
  hooks/            ← useAsync, useInView, useDebounce, useDocumentTitle
  lib/              ← géneros en español, formatos (fechas, %, duración), utilidades
  pages/            ← una carpeta/archivo por pantalla; admin/ para el panel
  styles/           ← tokens.css (colores, tipografía), base, components, pages, admin
scripts/build_mock_data.py
```

Tipografías: Fraunces e Instrument Sans, servidas desde el propio proyecto (`@fontsource`), sin llamadas a Google Fonts.

---

## Contrato de la API

Todas las rutas devuelven JSON. Con sesión, la web manda `Authorization: Bearer <token>` (el token se guarda en `localStorage`, clave `cinestart.token`). Los errores deben venir como los de FastAPI, `{"detail": "mensaje"}`; la web muestra ese mensaje tal cual, así que mejor en español. `401` cierra la sesión.

### Objeto `movie`

```json
{
  "id": 27205,
  "title": "Origen",
  "original_title": "Inception",
  "release_date": "2010-07-14",
  "runtime": 148,
  "genre_ids": [28, 53, 878],
  "overview": "Sinopsis en español…",
  "director": "Christopher Nolan",
  "cast": ["Leonardo DiCaprio", "Joseph Gordon-Levitt"],
  "original_language": "en",
  "vote_average": 8.1,
  "vote_count": 13752,
  "weighted_rating": 7.97,
  "long_tail": false,
  "cluster_id": 11,
  "poster_path": "/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg",
  "source": "catalog"
}
```

- `poster_path` es el de TMDB (la web añade `VITE_TMDB_IMAGE_BASE` + tamaño). Si es `null`, la web pinta un póster generado con el color del género. **El TMDB 5000 no trae pósters**: el backend debe pedirlos a TMDB y guardarlos.
- `overview` en español: pedidlo a TMDB con `language=es-ES` (en el modo mock salen en inglés, que es lo que trae el CSV).
- `long_tail`: `true` si está por debajo del umbral de votos (la web muestra «Poco vista»).
- `source`: `"catalog"` o `"tmdb"` (resultado de TMDB que aún no está en el catálogo). Una película añadida desde TMDB puede llevar `"added_from_tmdb": true`.
- Los campos que falten pueden ser `null`; la web no se rompe.

### Objeto `user`

```json
{ "id": 2, "alias": "demo", "email": "demo@…", "role": "user", "genre_ids": [878, 53],
  "onboarded": true, "ratings_count": 5, "created_at": "2026-10-22T10:00:00Z" }
```

`role`: `"user"` o `"admin"`. `onboarded`: `true` cuando tiene 3 valoraciones o más (los admin, siempre). Si es `false`, la web lleva al onboarding.

### Autenticación y cuenta

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| POST | `/auth/registro` | `{alias, email, password}` | `{access_token, token_type, user}` · `409` si el alias o el email existen |
| POST | `/auth/login` | `{alias, password}` | `{access_token, token_type, user}` · `401` si no coincide, `403` si está desactivado |
| GET | `/auth/yo` | — | `user` |
| DELETE | `/auth/yo` | — | `204` · borra la cuenta y todos sus datos |
| PUT | `/usuarios/yo/generos` | `{genre_ids: [int]}` (0 a 3) | `user` |

Reglas que la web ya valida en el formulario (el backend debe repetirlas): alias de 3 a 30 caracteres (letras, números, `_` `.` `-`), email con formato válido y contraseña de 8 caracteres o más.

### Catálogo

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/generos` | `[{id, name}]` (la web ya los traduce por id) |
| GET | `/onboarding/peliculas?generos=878,53` | `[movie]` · unas 20, 2 por cluster y priorizando los géneros elegidos |
| GET | `/peliculas/{id}` | `movie` + `"similar": [movie]` (12). Si el id es de TMDB y no está en el catálogo, se trae de TMDB, **se guarda en el catálogo** y se devuelve |
| GET | `/peliculas/buscar?q=texto` | `{catalog: [movie], tmdb: [movie]}` · `tmdb` solo con las que no están en el catálogo |
| GET | `/peliculas?genero=18&orden=nota&limite=20` | `[movie]` ordenadas por `weighted_rating` |
| GET | `/peliculas?ids=1,2,3` | `[movie]` (para pintar Mi lista y valoraciones) |

### Recomendaciones

| Método | Ruta | Respuesta |
|---|---|---|
| GET | `/recomendaciones?n=10` | `{items: [movie], model_version, generated_at}` |
| GET | `/recomendaciones?n=12&cola_larga=true` | Igual, solo de cola larga (carrusel *Joyas por descubrir*) |

Sin películas ya valoradas, descartadas ni de Mi lista. La web vuelve a pedir recomendaciones cada vez que el usuario valora o descarta.

### Biblioteca del usuario

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| GET | `/valoraciones` | — | `[{movie_id, rating, source, created_at}]` |
| PUT | `/valoraciones/{movie_id}` | `{rating: 1-5, source}` | `{movie_id, rating, source, created_at}` |
| DELETE | `/valoraciones/{movie_id}` | — | `204` |
| GET | `/descartes` | — | `[movie_id]` |
| POST | `/descartes` | `{movie_id}` | `204` |
| DELETE | `/descartes/{movie_id}` | — | `204` (botón «Deshacer») |
| GET | `/lista` | — | `[{movie_id, added_at}]` |
| PUT | `/lista/{movie_id}` | — | `204` |
| DELETE | `/lista/{movie_id}` | — | `204` |

`source` de una valoración: `"onboarding"` (pantalla de bienvenida) o `"recommendation"` (portada o ficha). Sirve para el KPI de aceptación; para afinarlo, el backend puede cruzarlo con el registro de recomendaciones servidas a ese usuario.

### Administración (rol `admin`, si no `403`)

**`GET /admin/kpis?dias=30`**

```json
{
  "period_days": 30,
  "model_version": "content-v1.0",
  "kpis": {
    "coverage":   {"value": 0.41,  "previous": 0.373},
    "diversity":  {"value": 0.603, "previous": 0.598},
    "novelty":    {"value": 0.273, "previous": 0.294},
    "acceptance": {"value": 0.464, "previous": 0.465}
  },
  "recommendations_served": 1278,
  "acceptance_series": [{"label": "4 oct", "value": 0.42, "n": 31}],
  "recs_by_genre": [{"genre_id": 18, "count": 300}],
  "clusters": [{"cluster": "G0", "catalog": 0.03, "recommended": 0.01}],
  "top_recommended": [{"…movie": "…", "times_recommended": 42}],
  "ratings_distribution": [{"stars": 1, "count": 0}],
  "never_recommended": 351,
  "catalog_size": 595
}
```

Valores entre 0 y 1 (la web los pinta como %). `previous` puede ser `null`. Definiciones (salen en la propia pantalla):

- **Cobertura**: películas distintas recomendadas alguna vez / películas del catálogo.
- **Diversidad**: 1 − Jaccard medio de géneros entre las películas de cada top-10.
- **Novedad**: parte de las recomendaciones que son de cola larga.
- **Aceptación**: valoraciones ≥ 4★ sobre recomendadas / (valoraciones de recomendadas + descartes).

**`GET /admin/peliculas?buscar=&nunca_recomendadas=true&pagina=1&tam=20&orden=recommended|rating|votes|title`**
→ `{items: [movie + {times_recommended, app_rating, app_ratings_count}], total, page, page_size}`

**`GET /admin/usuarios?buscar=&estado=active|inactive`**
→ `[{id, alias, role, active, created_at, ratings_count}]` · sin email ni contraseña.

**`PATCH /admin/usuarios/{id}`** `{active: bool}` → `204` · **`DELETE /admin/usuarios/{id}`** → `204`. Un admin no puede desactivarse ni borrarse a sí mismo (`400`).

**`GET /admin/uso?dias=30`**

```json
{
  "period_days": 30,
  "totals": {"registrations": 64, "ratings": 613, "dismissals": 208, "active_users": 131},
  "onboarding_completion": 0.875,
  "funnel": [{"step": "Registrados", "value": 64}, {"step": "Onboarding completo", "value": 56},
             {"step": "Recibieron recomendaciones", "value": 55}, {"step": "Valoraron una recomendación", "value": 55}],
  "series": [{"label": "4 oct", "registrations": 1, "ratings": 14, "dismissals": 14}]
}
```

Con 7 o 30 días, `series` va por día; con 90, por semana.

---

## Datos de ejemplo

`src/api/mock/data/catalog.json` se genera desde el CSV limpio y los artefactos de `features.py`:

```bash
python scripts/build_mock_data.py \
  --movies data/tmdb_5000_movies.csv \
  --credits data/tmdb_5000_credits.csv \
  --artefactos artefactos/
```

Coge ~420 películas populares + ~160 de cola larga (mínimo 8 por género) y sus 12 vecinas más parecidas según los embeddings. El panel de administración, en modo mock, se rellena con ~140 usuarios simulados (siempre los mismos, semilla fija) que usan ese mismo recomendador.

## TMDB

Las condiciones de la API de TMDB obligan a mostrar su aviso y su logo. El pie de página ya incluye el texto; si queréis el logo oficial, descargadlo de su web (*About → Logos & Attribution*) y sustituid la etiqueta `TMDB` de `src/components/Footer.jsx`.
