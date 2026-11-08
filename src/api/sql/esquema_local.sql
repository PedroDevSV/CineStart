-- SOLO PARA PROBAR EN LOCAL: copia exacta del esquema de Neon (CineStartUsuariosdb, revisado el 8/11/2026).
-- En Neon estas tablas ya existen; no ejecutéis esto allí.
CREATE TABLE genres (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE);
CREATE TABLE movies (
    id INTEGER PRIMARY KEY, title TEXT NOT NULL, overview TEXT, overview_es TEXT, release_date DATE,
    runtime_min INTEGER, vote_average NUMERIC, vote_count INTEGER, popularity DOUBLE PRECISION, weighted_rating NUMERIC,
    director TEXT, poster_path TEXT, cluster_id INTEGER, long_tail BOOLEAN
);
CREATE TABLE movie_genre (movie_id INTEGER NOT NULL REFERENCES movies(id), genre_id INTEGER NOT NULL REFERENCES genres(id),
    PRIMARY KEY (movie_id, genre_id));
CREATE TABLE users (                       -- ojo: id SIN numeración automática, como en Neon
    id INTEGER PRIMARY KEY, alias TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role = ANY (ARRAY['user', 'admin'])), active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE user_genre (user_id INTEGER NOT NULL REFERENCES users(id), genre_id INTEGER NOT NULL REFERENCES genres(id),
    PRIMARY KEY (user_id, genre_id));
CREATE TABLE ratings (
    user_id INTEGER NOT NULL REFERENCES users(id), movie_id INTEGER NOT NULL REFERENCES movies(id),
    rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5), source TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (user_id, movie_id)
);
CREATE TABLE dismissals (user_id INTEGER NOT NULL REFERENCES users(id), movie_id INTEGER NOT NULL REFERENCES movies(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (user_id, movie_id));
CREATE TABLE recommendations (             -- id también SIN numeración automática
    id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), movie_id INTEGER NOT NULL REFERENCES movies(id),
    batch_id TEXT, position INTEGER, score NUMERIC, generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
