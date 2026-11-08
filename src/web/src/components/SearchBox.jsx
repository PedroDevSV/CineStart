import { useEffect, useId, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import Poster from './Poster.jsx';
import * as api from '../api/index.js';
import { useDebounce } from '../hooks/useDebounce.js';
import { year } from '../lib/format.js';
import { cx } from '../lib/text.js';

/**
 * Buscador con sugerencias (patrón combobox de ARIA).
 * ↑/↓ recorren las sugerencias, Enter abre la elegida o la página de resultados, Esc cierra.
 */
export default function SearchBox({ className, autoFocus = false, onDone }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [q, setQ] = useState(() => new URLSearchParams(location.search).get('q') ?? '');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [results, setResults] = useState({ catalog: [], tmdb: [] });
  const [loading, setLoading] = useState(false);
  const debounced = useDebounce(q.trim(), 220);
  const listId = useId();
  const inputRef = useRef(null);
  const boxRef = useRef(null);

  useEffect(() => {
    if (location.pathname !== '/buscar') return;
    setQ(new URLSearchParams(location.search).get('q') ?? '');
  }, [location]);

  useEffect(() => {
    if (debounced.length < 2) {
      setResults({ catalog: [], tmdb: [] });
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    api
      .searchMovies(debounced, { signal: ctrl.signal })
      .then((r) => setResults(r))
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [debounced]);

  useEffect(() => {
    const onDoc = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, []);

  const options = [
    ...results.catalog.slice(0, 5).map((m) => ({ movie: m, from: 'catalog' })),
    ...results.tmdb.slice(0, 3).map((m) => ({ movie: m, from: 'tmdb' })),
  ];
  const showList = open && q.trim().length >= 2;

  const goResults = () => {
    const term = q.trim();
    if (!term) return;
    setOpen(false);
    navigate(`/buscar?q=${encodeURIComponent(term)}`);
    onDone?.();
  };
  const goMovie = (m) => {
    setOpen(false);
    navigate(`/pelicula/${m.id}`);
    onDone?.();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(options.length, a + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(-1, a - 1));
    } else if (e.key === 'Escape') {
      if (open) setOpen(false);
      else setQ('');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0 && active < options.length) goMovie(options[active].movie);
      else goResults();
    }
  };

  const activeId = active >= 0 ? `${listId}-opt-${active}` : undefined;

  return (
    <div className={cx('search', className)} ref={boxRef}>
      <form role="search" onSubmit={(e) => e.preventDefault()} className="search__form">
        <label htmlFor={`${listId}-input`} className="sr-only">
          Buscar películas por título, director o actor
        </label>
        <Icon name="search" size={18} className="search__icon" />
        <input
          ref={inputRef}
          id={`${listId}-input`}
          className="search__input"
          type="search"
          placeholder="Busca una película, director o actor…"
          autoComplete="off"
          autoFocus={autoFocus}
          value={q}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {q ? (
          <button
            type="button"
            className="search__clear"
            aria-label="Borrar búsqueda"
            onClick={() => {
              setQ('');
              inputRef.current?.focus();
            }}
          >
            <Icon name="x" size={16} />
          </button>
        ) : null}
      </form>

      {showList ? (
        <div className="search__popover">
          <ul id={listId} role="listbox" aria-label="Sugerencias" className="search__list">
            {options.map((o, i) => (
              <li
                key={`${o.from}-${o.movie.id}`}
                id={`${listId}-opt-${i}`}
                role="option"
                aria-selected={active === i}
                className={cx('search__option', active === i && 'is-active')}
                onPointerEnter={() => setActive(i)}
                onClick={() => goMovie(o.movie)}
              >
                <Poster movie={o.movie} size="sm" decorative className="search__thumb" />
                <span className="search__opt-text">
                  <span className="search__opt-title">{o.movie.title}</span>
                  <span className="search__opt-meta">
                    {year(o.movie.release_date)}
                    {o.movie.director ? <span className="dot-sep">{o.movie.director}</span> : null}
                  </span>
                </span>
                {o.from === 'tmdb' ? <span className="badge badge--info">Desde TMDB</span> : null}
              </li>
            ))}
            <li
              id={`${listId}-opt-${options.length}`}
              role="option"
              aria-selected={active === options.length}
              className={cx('search__option search__option--all', active === options.length && 'is-active')}
              onPointerEnter={() => setActive(options.length)}
              onClick={goResults}
            >
              <Icon name="search" size={16} />
              <span>
                {loading && !options.length ? 'Buscando…' : options.length ? 'Ver todos los resultados de' : 'Buscar'} «{q.trim()}»
              </span>
              <Icon name="arrowRight" size={16} className="search__go" />
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}
