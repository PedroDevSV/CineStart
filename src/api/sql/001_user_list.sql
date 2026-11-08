-- Mi lista: películas que el usuario guarda para ver más tarde.
-- No estaba en el esquema de Neon. La API la crea sola al arrancar si no existe;
-- este archivo es por si preferís crearla a mano desde la consola de Neon.
CREATE TABLE IF NOT EXISTS user_list (
    user_id   INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    movie_id  INTEGER     NOT NULL,
    added_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, movie_id)
);
