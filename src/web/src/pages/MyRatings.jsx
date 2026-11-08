import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Poster from '../components/Poster.jsx';
import StarRating from '../components/StarRating.jsx';
import Icon from '../components/Icon.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { EmptyState } from '../components/States.jsx';
import * as api from '../api/index.js';
import { useLibrary } from '../context/LibraryContext.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { genreName } from '../lib/genres.js';
import { date, relative, year } from '../lib/format.js';

const SOURCE = { onboarding: 'Bienvenida', recommendation: 'Recomendación' };

export default function MyRatings() {
  useDocumentTitle('Mis valoraciones');
  const lib = useLibrary();
  const [stars, setStars] = useState(0);
  const [sort, setSort] = useState('recent');
  const [toDelete, setToDelete] = useState(null);

  const ids = useMemo(() => [...lib.ratings.keys()], [lib.loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data } = useAsync(() => api.getMoviesByIds(ids), [ids.join(',')], { enabled: lib.loaded && ids.length > 0 });
  const known = useMemo(() => new Map((data ?? []).map((m) => [m.id, m])), [data]);

  const rows = useMemo(() => {
    const list = [...lib.ratings.values()]
      .map((r) => ({ ...r, movie: known.get(r.movie_id) ?? lib.movieCache.get(r.movie_id) }))
      .filter((r) => r.movie && (!stars || r.rating === stars));
    const sorters = {
      recent: (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at),
      high: (a, b) => b.rating - a.rating || a.movie.title.localeCompare(b.movie.title),
      low: (a, b) => a.rating - b.rating || a.movie.title.localeCompare(b.movie.title),
      title: (a, b) => a.movie.title.localeCompare(b.movie.title),
    };
    return list.sort(sorters[sort]);
  }, [lib.ratings, lib.movieCache, known, stars, sort]);

  const dist = [5, 4, 3, 2, 1].map((s) => ({ s, n: [...lib.ratings.values()].filter((r) => r.rating === s).length }));
  const total = lib.ratings.size;
  const avg = total ? [...lib.ratings.values()].reduce((a, r) => a + r.rating, 0) / total : 0;
  const maxN = Math.max(1, ...dist.map((d) => d.n));

  if (lib.loaded && !total) {
    return (
      <div className="page container">
        <EmptyState
          icon="star"
          title="Aún no has valorado ninguna película"
          action={
            <Link to="/bienvenida" state={{ step: 2 }} className="btn btn--primary">
              Valorar películas
            </Link>
          }
        >
          Tus valoraciones son lo que usa CineStart para elegir tus recomendaciones.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="page container">
      <div className="page-head">
        <div className="page-head__text">
          <p className="eyebrow">Tu perfil</p>
          <h1 className="page-title">Mis valoraciones</h1>
          <p className="muted">Cambia una nota o bórrala y tus recomendaciones se recalculan.</p>
        </div>
      </div>

      <div className="ratings-layout">
        <aside className="ratings-summary panel" aria-label="Resumen">
          <div className="ratings-summary__big">
            <span className="ratings-summary__avg">{avg.toLocaleString('es-ES', { maximumFractionDigits: 1 })}</span>
            <StarRating value={Math.round(avg)} readOnly size={16} />
            <span className="subtle">
              Media de {total} {total === 1 ? 'valoración' : 'valoraciones'}
            </span>
          </div>
          <div className="dist" role="group" aria-label="Filtrar por estrellas">
            {dist.map(({ s, n }) => (
              <button key={s} type="button" className="dist__row" aria-pressed={stars === s} onClick={() => setStars(stars === s ? 0 : s)}>
                <span className="dist__label">
                  {s} <span aria-hidden="true">★</span>
                  <span className="sr-only">estrellas</span>
                </span>
                <span className="dist__bar" aria-hidden="true">
                  <span style={{ width: `${(n / maxN) * 100}%` }} />
                </span>
                <span className="dist__n">{n}</span>
              </button>
            ))}
          </div>
          {stars ? (
            <button type="button" className="btn btn--sm btn--block" onClick={() => setStars(0)}>
              Ver todas
            </button>
          ) : null}
        </aside>

        <section aria-label="Lista de valoraciones">
          <div className="list-toolbar">
            <p className="subtle" aria-live="polite">
              {stars ? `${rows.length} con ${stars} ${stars === 1 ? 'estrella' : 'estrellas'}` : `${rows.length} películas`}
            </p>
            <div className="field field--inline">
              <label className="field__label" htmlFor="sort-ratings">
                Ordenar
              </label>
              <select id="sort-ratings" className="select" value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="recent">Más recientes</option>
                <option value="high">Nota más alta</option>
                <option value="low">Nota más baja</option>
                <option value="title">Título (A-Z)</option>
              </select>
            </div>
          </div>
          <ul className="rlist">
            {!lib.loaded || (!data && ids.length && !rows.length)
              ? Array.from({ length: 5 }, (_, i) => <li key={i} className="rlist__item skeleton" style={{ height: 112 }} aria-hidden="true" />)
              : rows.map((r) => (
                  <li key={r.movie_id} className="rlist__item">
                    <Link to={`/pelicula/${r.movie_id}`} className="rlist__poster" tabIndex={-1} aria-hidden="true">
                      <Poster movie={r.movie} size="sm" decorative />
                    </Link>
                    <div className="rlist__info">
                      <Link to={`/pelicula/${r.movie_id}`} className="rlist__title">
                        {r.movie.title}
                      </Link>
                      <span className="rlist__meta">
                        {year(r.movie.release_date)}
                        {r.movie.genre_ids?.[0] ? <span className="dot-sep">{genreName(r.movie.genre_ids[0])}</span> : null}
                        {r.movie.director ? <span className="dot-sep">{r.movie.director}</span> : null}
                      </span>
                      <span className="rlist__when">
                        <span className={r.source === 'onboarding' ? 'badge' : 'badge badge--accent'}>{SOURCE[r.source] ?? r.source}</span>
                        <time dateTime={r.created_at} title={date(r.created_at)}>
                          {relative(r.created_at)}
                        </time>
                      </span>
                    </div>
                    <div className="rlist__rate">
                      <StarRating value={r.rating} onChange={(v) => lib.rate(r.movie, v, r.source)} label={`Tu valoración de «${r.movie.title}»`} size={22} />
                    </div>
                    <button type="button" className="icon-btn rlist__del" aria-label={`Borrar la valoración de «${r.movie.title}»`} onClick={() => setToDelete(r)}>
                      <Icon name="trash" size={18} />
                    </button>
                  </li>
                ))}
          </ul>
        </section>
      </div>

      <ConfirmDialog
        open={!!toDelete}
        title="¿Borrar esta valoración?"
        confirmLabel="Borrar valoración"
        danger
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          lib.removeRating(toDelete.movie);
          setToDelete(null);
        }}
      >
        Quitaremos tu nota de «{toDelete?.movie.title}» y tus recomendaciones se recalcularán sin ella.
        {lib.ratings.size <= 3 ? ' Ten en cuenta que necesitas al menos 3 valoraciones para recibir recomendaciones personalizadas.' : ''}
      </ConfirmDialog>
    </div>
  );
}
