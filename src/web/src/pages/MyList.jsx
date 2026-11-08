import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import MovieCard, { MovieCardSkeleton } from '../components/MovieCard.jsx';
import Icon from '../components/Icon.jsx';
import { EmptyState } from '../components/States.jsx';
import * as api from '../api/index.js';
import { useLibrary } from '../context/LibraryContext.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

const SORTS = {
  added: { label: 'Añadidas recientemente', fn: (a, b, lib) => Date.parse(lib.list.get(b.id)) - Date.parse(lib.list.get(a.id)) },
  title: { label: 'Título (A-Z)', fn: (a, b) => a.title.localeCompare(b.title) },
  rating: { label: 'Mejor valoradas en TMDB', fn: (a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0) },
  year: { label: 'Más recientes', fn: (a, b) => String(b.release_date).localeCompare(String(a.release_date)) },
};

export default function MyList() {
  useDocumentTitle('Mi lista');
  const lib = useLibrary();
  const [sort, setSort] = useState('added');
  // Los ids iniciales se piden una vez; al quitar una película desaparece sin recargar.
  const ids = useMemo(() => [...lib.list.keys()], [lib.loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data, loading } = useAsync(() => api.getMoviesByIds(ids), [ids.join(',')], { enabled: lib.loaded });

  const movies = useMemo(() => {
    const known = new Map((data ?? []).map((m) => [m.id, m]));
    return [...lib.list.keys()]
      .map((id) => known.get(id) ?? lib.movieCache.get(id))
      .filter(Boolean)
      .sort((a, b) => SORTS[sort].fn(a, b, lib));
  }, [data, lib, sort]);

  return (
    <div className="page container">
      <div className="page-head">
        <div className="page-head__text">
          <p className="eyebrow">Tu biblioteca</p>
          <h1 className="page-title">Mi lista</h1>
          <p className="muted">
            {lib.list.size
              ? `${lib.list.size} ${lib.list.size === 1 ? 'película guardada' : 'películas guardadas'} para ver más tarde`
              : 'Guarda aquí las películas que quieras ver'}
          </p>
        </div>
        {lib.list.size > 1 ? (
          <div className="field field--inline">
            <label className="field__label" htmlFor="sort-list">
              Ordenar
            </label>
            <select id="sort-list" className="select" value={sort} onChange={(e) => setSort(e.target.value)}>
              {Object.entries(SORTS).map(([k, s]) => (
                <option key={k} value={k}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {!lib.loaded || (loading && !data && lib.list.size) ? (
        <ul className="grid">
          {Array.from({ length: Math.max(4, Math.min(12, lib.list.size)) }, (_, i) => (
            <li key={i}>
              <MovieCardSkeleton />
            </li>
          ))}
        </ul>
      ) : movies.length ? (
        <ul className="grid">
          {movies.map((m) => (
            <li key={m.id}>
              <MovieCard movie={m} showGenre />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon="bookmark"
          title="Tu lista está vacía"
          action={
            <Link to="/" className="btn btn--primary">
              Descubrir películas <Icon name="arrowRight" size={16} />
            </Link>
          }
        >
          Pulsa el botón <strong>+</strong> en cualquier película para guardarla aquí.
        </EmptyState>
      )}
    </div>
  );
}
