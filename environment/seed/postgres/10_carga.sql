-- Carga del catálogo (no se cargan los usuarios de ejemplo: sus hashes son falsos y no pueden entrar).
COPY genres FROM '/docker-entrypoint-initdb.d/genres.csv' WITH (FORMAT csv, HEADER true);

-- runtime_min viene como «162.0» en el CSV: se carga como numérico y se convierte
CREATE TEMP TABLE movies_tmp (LIKE movies);
ALTER TABLE movies_tmp ALTER COLUMN runtime_min TYPE NUMERIC;
COPY movies_tmp FROM '/docker-entrypoint-initdb.d/movies.csv' WITH (FORMAT csv, HEADER true);
INSERT INTO movies SELECT id, title, overview, overview_es, release_date, round(runtime_min)::integer,
       vote_average, vote_count, popularity, weighted_rating, director, poster_path, cluster_id, long_tail
FROM movies_tmp;
DROP TABLE movies_tmp;

COPY movie_genre FROM '/docker-entrypoint-initdb.d/movie_genre.csv' WITH (FORMAT csv, HEADER true);
