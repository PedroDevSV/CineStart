import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import MovieCard, { MovieCardSkeleton } from '../components/MovieCard.jsx';
import Icon from '../components/Icon.jsx';
import { EmptyState, ErrorState } from '../components/States.jsx';
import * as api from '../api/index.js';
import { useAsync } from '../hooks/useAsync.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { genreName } from '../lib/genres.js';

export default function Search() {
  const [params] = useSearchParams();
  const q = (params.get('q') ?? '').trim();
  useDocumentTitle(q ? `«${q}»` : 'Buscar');
  const { data, error, loading, reload } = useAsync(() => api.searchMovies(q), [q], { enabled: q.length >= 2 });
  const [genre, setGenre] = useState(null);

  const catalog = data?.catalog ?? [];
  const tmdb = data?.tmdb ?? [];
  const genreOptions = useMemo(() => {
    const counts = new Map();
    catalog.forEach((m) => m.genre_ids.slice(0, 2).forEach((g) => counts.set(g, (counts.get(g) ?? 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([g]) => g);
  }, [catalog]);
  const filtered = genre ? catalog.filter((m) => m.genre_ids.includes(genre)) : catalog;

  if (q.length < 2) {
    return (
      <div className="page container">
        <EmptyState icon="search" title="¿Qué película buscas?">
          Escribe al menos dos letras en el buscador de arriba. Puedes buscar por título, director o actor.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="page container">
      <div className="page-head">
        <div className="page-head__text">
          <p className="eyebrow">Buscador</p>
          <h1 className="page-title">Resultados para «{q}»</h1>
          <p className="muted" aria-live="polite">
            {loading && !data
              ? 'Buscando…'
              : `${catalog.length} ${catalog.length === 1 ? 'película' : 'películas'} en el catálogo${tmdb.length ? ` · ${tmdb.length} más en TMDB` : ''}`}
          </p>
        </div>
      </div>

      {error ? <ErrorState error={error} onRetry={reload} /> : null}

      {genreOptions.length > 1 ? (
        <div className="filters" role="group" aria-label="Filtrar por género">
          <button type="button" className="chip" aria-pressed={genre === null} onClick={() => setGenre(null)}>
            Todos
          </button>
          {genreOptions.map((g) => (
            <button key={g} type="button" className="chip" aria-pressed={genre === g} onClick={() => setGenre(genre === g ? null : g)}>
              {genreName(g)}
            </button>
          ))}
        </div>
      ) : null}

      {loading && !data ? (
        <ul className="grid">
          {Array.from({ length: 12 }, (_, i) => (
            <li key={i}>
              <MovieCardSkeleton />
            </li>
          ))}
        </ul>
      ) : filtered.length ? (
        <ul className="grid">
          {filtered.map((m, i) => (
            <li key={m.id}>
              <MovieCard movie={m} showLongTail showGenre priority={i < 12} />
            </li>
          ))}
        </ul>
      ) : null}

      {tmdb.length ? (
        <section className="tmdb-results" aria-labelledby="tmdb-title">
          <div className="tmdb-results__head">
            <span className="tmdb-results__icon" aria-hidden="true">
              <Icon name="globe" size={22} />
            </span>
            <div>
              <h2 id="tmdb-title" className="section-title">
                {catalog.length ? 'También en TMDB' : 'No está en CineStart, pero sí en TMDB'}
              </h2>
              <p className="muted">
                Al abrir una de estas películas se añade al catálogo de CineStart y empieza a aparecer en las recomendaciones.
              </p>
            </div>
          </div>
          <ul className="grid">
            {tmdb.map((m) => (
              <li key={m.id}>
                <MovieCard movie={m} showGenre />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data && !catalog.length && !tmdb.length ? (
        <EmptyState
          icon="search"
          title="No hemos encontrado nada"
          action={
            <Link to="/" className="btn">
              Volver a Descubrir
            </Link>
          }
        >
          Prueba con otra forma de escribirlo, con el título original en inglés o con el nombre del director.
        </EmptyState>
      ) : null}
    </div>
  );
}
