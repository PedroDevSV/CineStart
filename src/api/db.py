"""PostgreSQL (Neon): un pool de conexiones y tres ayudas para no repetir código."""
from datetime import datetime, timezone

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

import config

pool: ConnectionPool | None = None


def abrir():
    global pool
    # conninfo vacío = libpq usa las variables PG* del .env
    pool = ConnectionPool(config.DATABASE_URL, min_size=1, max_size=8, open=True,
                          kwargs={"row_factory": dict_row, "autocommit": True})
    pool.wait(timeout=20)
    preparar_esquema()


def cerrar():
    if pool:
        pool.close()


def filas(sql, params=()):
    with pool.connection() as c:
        return c.execute(sql, params).fetchall()


def fila(sql, params=()):
    with pool.connection() as c:
        return c.execute(sql, params).fetchone()


def ejecutar(sql, params=()):
    with pool.connection() as c:
        return c.execute(sql, params).rowcount


def transaccion():
    """with db.transaccion() as c: c.execute(...); c.execute(...)  -> todo o nada."""
    return _Tx()


class _Tx:
    def __enter__(self):
        self._ctx = pool.connection()
        self.c = self._ctx.__enter__()
        self._tx = self.c.transaction()
        self._tx.__enter__()
        return self.c

    def __exit__(self, *exc):
        self._tx.__exit__(*exc)
        return self._ctx.__exit__(*exc)


def preparar_esquema():
    """Lo único que añade la API al esquema de Neon: la tabla de «Mi lista»."""
    ejecutar("""
        CREATE TABLE IF NOT EXISTS user_list (
            user_id   INTEGER   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            movie_id  INTEGER   NOT NULL,
            added_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (user_id, movie_id)
        )""")


def utc(dt):
    """Fechas de la BD -> datetime UTC sin zona, para poder compararlas siempre igual."""
    if dt is None:
        return None
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def iso(dt):
    dt = utc(dt)
    return dt.isoformat() + "Z" if dt else None


def ahora():
    """Fecha y hora actual en UTC y CON zona: así se guarda bien sea cual sea la zona horaria de la BD."""
    return datetime.now(timezone.utc)


def con_zona(dt):
    """Para pasar a SQL una fecha de Python sin zona (que siempre es UTC en esta API)."""
    return dt.replace(tzinfo=timezone.utc) if dt is not None and dt.tzinfo is None else dt


def siguientes_ids(c, tabla, cuantos=1):
    """En Neon, users.id y recommendations.id no tienen numeración automática (ni SERIAL ni IDENTITY).
    Se reserva el siguiente número con un cerrojo de la transacción para que dos peticiones a la vez
    no cojan el mismo."""
    c.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (tabla,))
    base = c.execute(f"SELECT coalesce(max(id), 0) AS m FROM {tabla}").fetchone()["m"]
    return list(range(base + 1, base + 1 + cuantos))
