# CineStart · API

FastAPI que une la web con **Neon (PostgreSQL)**, **MongoDB Atlas**, la **API de TMDB** y el **motor** de `models/`.
Cumple el contrato que espera la web (rutas y JSON del README de `web/`).

## Arrancar (Windows)

```bash
cd api
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

- Comprueba que todo conecta: http://localhost:8000/salud
- Todas las rutas, para probarlas a mano: http://localhost:8000/docs

Después, en otra terminal, la web contra la API:

```bash
cd web
npm run dev -- --port 5180
```

`web/.env` ya tiene `VITE_USE_MOCKS=false` y `VITE_API_URL=http://localhost:8000`. Para volver a los datos de ejemplo, pon `VITE_USE_MOCKS=true`.

Las claves van en `api/.env`, que no se sube a GitHub. Para otro ordenador, copia `.env.example` como `.env` y rellénalo.

## Qué hace cada archivo

| Archivo | Qué hace |
|---|---|
| `main.py` | Crea la app, CORS, conecta todo al arrancar y registra las rutas |
| `config.py` | Lee el `.env` |
| `db.py` | Pool de conexiones a Neon y ayudas (`filas`, `fila`, `ejecutar`, `transaccion`) |
| `mongo.py` | Fichas de película (`movie_details`) y email de cada usuario (`user_contacts`) |
| `tmdb.py` | Llamadas a TMDB: póster, sinopsis en castellano, búsqueda y películas nuevas |
| `catalogo.py` | Catálogo en memoria + motor de recomendación + lo que falta de TMDB |
| `seguridad.py` | bcrypt, JWT y las dependencias `get_user` / `require_admin` |
| `rutas/` | `auth`, `peliculas` (y recomendaciones), `biblioteca`, `admin` |
| `prueba_api.py` | 53 comprobaciones de toda la API contra una copia local exacta del esquema de Neon (`sql/esquema_local.sql`), sin tocar los servicios reales |

## Cómo usa cada servicio

**Neon (PostgreSQL)**
- Tablas: `users`, `ratings`, `dismissals`, `user_genre`, `genres`, `movies`, `movie_genre` y `recommendations`.
- Cada lista que se le enseña a un usuario se guarda en `recommendations`, y de ahí salen los KPIs del panel.
- La API crea sola **una tabla nueva**, `user_list` (Mi lista), porque no existía. El SQL está en `sql/001_user_list.sql`.
- En Neon, `users.id` y `recommendations.id` no tienen numeración automática. La API reserva el siguiente número ella misma (`db.siguientes_ids`), así que no hace falta cambiar el esquema.
- Las fechas se guardan en UTC con zona horaria (las columnas son `timestamptz`).
- En `ratings.source` guarda `onboarding` o `manual`, como los datos que ya teníais.

**MongoDB Atlas**
- Base de datos `cinestart`, colección `movie_details`. De ahí saca el reparto (para la ficha y para buscar por actor) y el título original.
- Las películas que entran desde TMDB se guardan ahí con el mismo formato que las demás.
- El **email** de cada usuario va en la colección `user_contacts`, fuera de PostgreSQL, como dice la documentación (es un dato personal, IIP).
- Sin `MONGO_URI` la API funciona igual, pero no guarda emails y el reparto se pide a TMDB.

**TMDB**
- Solo para lo que falta:
  - el póster y la sinopsis en castellano, que se guardan en `movies` la primera vez y no se vuelven a pedir;
  - buscar películas que no están en el catálogo.
- Al abrir, valorar o guardar una de esas películas, entra en Neon (`movies` + `movie_genre`), en Mongo y en el motor, sin reentrenar.

**Motor** (`../models` + `../artefactos`)
- Se carga una vez al arrancar.
- Recomendaciones, "Películas similares" y la selección del onboarding.

## Avisos

- **IP en MongoDB Atlas:** Atlas solo deja entrar a las IP de su lista (*Network Access*). Si la API dice que no puede conectar con MongoDB, añade tu IP en Atlas > Network Access > *Add current IP address*.
- **Usuarios de ejemplo de Neon:** `admin_cinestart`, `lucia_cine` y `carlos_m` tienen contraseñas de relleno y no pueden entrar.
  1. Regístrate desde la web.
  2. Para hacerte administrador, ejecuta en la consola SQL de Neon: `UPDATE users SET role = 'admin' WHERE alias = 'tu_alias';`
- **Sin sesión** solo se puede ver `/generos` y la lista de mejor valoradas (para los pósters de la pantalla de entrar).
