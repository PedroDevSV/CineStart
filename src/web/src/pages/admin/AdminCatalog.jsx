import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import Poster from '../../components/Poster.jsx';
import { ErrorState } from '../../components/States.jsx';
import Pagination from './Pagination.jsx';
import * as api from '../../api/index.js';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { genreNames } from '../../lib/genres.js';
import { num, rating, year } from '../../lib/format.js';

const PAGE_SIZE = 15;

export default function AdminCatalog() {
  useDocumentTitle('Panel · Catálogo');
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const never = params.get('nunca') === '1';
  const sort = params.get('orden') ?? 'recommended';
  const page = Number(params.get('pagina') ?? 1);
  const dq = useDebounce(q.trim(), 250);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v === null || v === '' || v === false ? next.delete(k) : next.set(k, String(v))));
    setParams(next, { replace: true });
  };
  useEffect(() => {
    if ((params.get('q') ?? '') !== dq) update({ q: dq, pagina: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dq]);

  const { data, error, loading, reload } = useAsync(
    () => api.adminGetMovies({ q: dq, neverRecommended: never, page, pageSize: PAGE_SIZE, sort }),
    [dq, never, page, sort],
  );

  return (
    <div className="admin-page">
      <header className="admin-head">
        <div>
          <p className="eyebrow">Panel de administración</p>
          <h1 className="page-title">Catálogo</h1>
          <p className="muted">Consulta qué películas llegan a los usuarios y cuáles se quedan sin visibilidad.</p>
        </div>
      </header>

      <div className="atoolbar">
        <div className="atoolbar__search">
          <Icon name="search" size={16} className="atoolbar__icon" />
          <label htmlFor="cat-q" className="sr-only">
            Buscar por título o director
          </label>
          <input id="cat-q" className="input input--sm" type="search" placeholder="Título o director…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <label className="checkbox atoolbar__check" htmlFor="cat-never">
          <input id="cat-never" type="checkbox" checked={never} onChange={(e) => update({ nunca: e.target.checked ? 1 : null, pagina: null })} />
          <span>Solo nunca recomendadas</span>
        </label>
        <div className="field field--inline">
          <label className="field__label" htmlFor="cat-sort">
            Ordenar
          </label>
          <select id="cat-sort" className="select" value={sort} onChange={(e) => update({ orden: e.target.value, pagina: null })}>
            <option value="recommended">Más recomendadas</option>
            <option value="rating">Nota ponderada</option>
            <option value="votes">Votos en TMDB</option>
            <option value="title">Título (A-Z)</option>
          </select>
        </div>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <>
          <p className="subtle atable-count" aria-live="polite">
            {data ? `${num(data.total)} películas` : 'Cargando…'}
          </p>
          <div className={loading ? 'atable-wrap is-loading' : 'atable-wrap'}>
            <table className="atable">
              <thead>
                <tr>
                  <th scope="col">Película</th>
                  <th scope="col">Géneros</th>
                  <th scope="col" className="num">Nota TMDB</th>
                  <th scope="col" className="num">Votos</th>
                  <th scope="col" className="num">Recomendada</th>
                  <th scope="col" className="num">Nota en la app</th>
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((m) => (
                  <tr key={m.id}>
                    <td>
                      <Link to={`/pelicula/${m.id}`} className="atable__movie">
                        <Poster movie={m} size="sm" decorative className="atable__thumb" />
                        <span>
                          <span className="atable__title">{m.title}</span>
                          <span className="atable__sub">
                            {year(m.release_date)}
                            {m.director ? ` · ${m.director}` : ''}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <span className="atable__genres">{genreNames(m.genre_ids, 2).join(', ')}</span>
                      {m.long_tail ? <span className="badge badge--gold atable__badge">Poco vista</span> : null}
                    </td>
                    <td className="num">{rating(m.vote_average)}</td>
                    <td className="num">{num(m.vote_count)}</td>
                    <td className="num">
                      {m.times_recommended ? (
                        `${num(m.times_recommended)} veces`
                      ) : (
                        <span className="badge badge--danger">Nunca</span>
                      )}
                    </td>
                    <td className="num">
                      {m.app_rating ? (
                        <>
                          {rating(m.app_rating)} <span className="subtle">({m.app_ratings_count})</span>
                        </>
                      ) : (
                        <span className="subtle">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {data && !data.items.length ? (
                  <tr>
                    <td colSpan={6} className="atable__empty">
                      No hay películas que cumplan el filtro.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {data ? <Pagination page={page} total={data.total} pageSize={PAGE_SIZE} onChange={(p) => update({ pagina: p === 1 ? null : p })} /> : null}
        </>
      )}
    </div>
  );
}
