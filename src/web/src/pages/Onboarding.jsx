import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import Poster from '../components/Poster.jsx';
import StarRating from '../components/StarRating.jsx';
import Icon from '../components/Icon.jsx';
import { ErrorState } from '../components/States.jsx';
import * as api from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useLibrary } from '../context/LibraryContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { GENRES, genreName } from '../lib/genres.js';
import { year } from '../lib/format.js';
import { cx } from '../lib/text.js';

const MIN_RATINGS = 3;
const MAX_GENRES = 3;

export default function Onboarding() {
  useDocumentTitle('Bienvenida');
  const { user, saveGenres, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(location.state?.step === 2 ? 2 : 1);
  const [genres, setGenres] = useState(user?.genre_ids ?? []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  return (
    <div className="onb">
      <header className="onb__bar">
        <div className="container onb__bar-inner">
          <Logo to="/bienvenida" />
          <ol className="steps" aria-label="Progreso">
            <li className={cx('steps__item', step === 1 && 'is-current', step > 1 && 'is-done')} aria-current={step === 1 ? 'step' : undefined}>
              <span className="steps__num">{step > 1 ? <Icon name="check" size={14} strokeWidth={3} /> : 1}</span> Tus géneros
            </li>
            <li className={cx('steps__item', step === 2 && 'is-current')} aria-current={step === 2 ? 'step' : undefined}>
              <span className="steps__num">2</span> Valora películas
            </li>
          </ol>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => {
              logout();
              navigate('/entrar');
            }}
          >
            Salir
          </button>
        </div>
      </header>

      {step === 1 ? (
        <GenreStep
          alias={user?.alias}
          selected={genres}
          onChange={setGenres}
          onNext={async (skip) => {
            const ids = skip ? [] : genres;
            await saveGenres(ids).catch(() => {});
            if (skip) setGenres([]);
            setStep(2);
          }}
        />
      ) : (
        <RateStep
          genres={genres}
          onBack={() => setStep(1)}
          onDone={async () => {
            await refreshUser().catch(() => {});
            navigate('/', { replace: true, state: { welcome: true } });
          }}
        />
      )}
    </div>
  );
}

function GenreStep({ alias, selected, onChange, onNext }) {
  const [busy, setBusy] = useState(false);
  const toggle = (id) => {
    if (selected.includes(id)) onChange(selected.filter((g) => g !== id));
    else if (selected.length < MAX_GENRES) onChange([...selected, id]);
  };
  const ids = Object.keys(GENRES)
    .map(Number)
    .filter((id) => ![10770, 10769].includes(id))
    .sort((a, b) => genreName(a).localeCompare(genreName(b)));

  const go = async (skip) => {
    setBusy(true);
    await onNext(skip);
    setBusy(false);
  };

  return (
    <section className="onb__step container" aria-labelledby="onb-g-title">
      <p className="eyebrow">Paso 1 de 2</p>
      <h1 id="onb-g-title" className="onb__title">
        {alias ? `Hola, ${alias}. ` : ''}¿Qué te apetece ver?
      </h1>
      <p className="onb__lead">
        Elige hasta {MAX_GENRES} géneros favoritos. Nos ayudan a escoger qué películas te enseñamos ahora. Puedes saltarte este paso.
      </p>
      <div className="genre-grid" role="group" aria-label={`Géneros favoritos, máximo ${MAX_GENRES}`}>
        {ids.map((id) => {
          const on = selected.includes(id);
          const full = !on && selected.length >= MAX_GENRES;
          return (
            <button
              key={id}
              type="button"
              className={cx('genre-tile', on && 'is-on')}
              style={{ '--g': GENRES[id].color }}
              aria-pressed={on}
              disabled={full}
              onClick={() => toggle(id)}
            >
              <span className="genre-tile__name">{genreName(id)}</span>
              <span className="genre-tile__check" aria-hidden="true">
                <Icon name="check" size={16} strokeWidth={3} />
              </span>
            </button>
          );
        })}
      </div>
      <div className="onb__actions">
        <p className="subtle" aria-live="polite">
          {selected.length ? `${selected.length} de ${MAX_GENRES} elegidos: ${selected.map((g) => genreName(g)).join(', ')}` : 'Ningún género elegido'}
        </p>
        <div className="onb__btns">
          <button type="button" className="btn" onClick={() => go(true)} disabled={busy}>
            Saltar
          </button>
          <button type="button" className="btn btn--primary btn--lg" onClick={() => go(false)} disabled={busy || !selected.length}>
            Continuar <Icon name="arrowRight" size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}

function RateStep({ genres, onBack, onDone }) {
  const lib = useLibrary();
  const toast = useToast();
  const { data: movies, error, loading, reload } = useAsync(() => api.getOnboardingMovies({ genreIds: genres }), [genres.join(',')]);
  const [unseen, setUnseen] = useState(() => new Set());
  const [finishing, setFinishing] = useState(false);
  const count = lib.ratings.size;
  const ready = count >= MIN_RATINGS;

  const finish = async () => {
    setFinishing(true);
    toast.show('¡Listo! Estas son tus primeras recomendaciones.', { tone: 'success' });
    await onDone();
  };

  return (
    <section className="onb__step onb__step--rate container" aria-labelledby="onb-r-title">
      <p className="eyebrow">Paso 2 de 2</p>
      <h1 id="onb-r-title" className="onb__title">
        Valora las que hayas visto
      </h1>
      <p className="onb__lead">
        Puntúa al menos {MIN_RATINGS} películas de 1 a 5 estrellas. Cuantas más valores, más se parecerán las recomendaciones a lo que te gusta.
      </p>

      {error ? <ErrorState error={error} onRetry={reload} /> : null}

      <ul className="onb-grid">
        {loading && !movies
          ? Array.from({ length: 12 }, (_, i) => (
              <li key={i} className="onb-card" aria-hidden="true">
                <div className="skeleton" style={{ aspectRatio: '2/3' }} />
              </li>
            ))
          : (movies ?? []).map((m, i) => {
              const r = lib.ratingOf(m.id);
              const hidden = unseen.has(m.id) && !r;
              return (
                <li key={m.id} className={cx('onb-card', r && 'is-rated', hidden && 'is-unseen')}>
                  <div className="onb-card__poster">
                    <Poster movie={m} priority={i < 6} />
                    {r ? (
                      <span className="onb-card__badge" aria-hidden="true">
                        <Icon name="check" size={14} strokeWidth={3} />
                      </span>
                    ) : null}
                  </div>
                  <h2 className="onb-card__title">{m.title}</h2>
                  <p className="onb-card__meta">
                    {year(m.release_date)}
                    {m.genre_ids?.[0] ? <span className="dot-sep">{genreName(m.genre_ids[0])}</span> : null}
                  </p>
                  <StarRating
                    value={r}
                    size={20}
                    label={`Valora «${m.title}»`}
                    onChange={(v) => {
                      setUnseen((s) => {
                        const n = new Set(s);
                        n.delete(m.id);
                        return n;
                      });
                      lib.rate(m, v, 'onboarding');
                    }}
                  />
                  <button
                    type="button"
                    className={cx('onb-card__unseen', hidden && 'is-on')}
                    aria-pressed={hidden}
                    onClick={() => {
                      if (r) lib.removeRating(m);
                      setUnseen((s) => {
                        const n = new Set(s);
                        n.has(m.id) ? n.delete(m.id) : n.add(m.id);
                        return n;
                      });
                    }}
                  >
                    {hidden ? 'Marcada como no vista' : 'No la he visto'}
                  </button>
                </li>
              );
            })}
      </ul>

      <div className="onb-dock" role="region" aria-label="Progreso de valoraciones">
        <div className="container onb-dock__inner">
          <button type="button" className="btn btn--ghost" onClick={onBack}>
            <Icon name="arrowLeft" size={18} /> Géneros
          </button>
          <div className="onb-dock__progress">
            <span className="onb-dock__count" aria-live="polite">
              {ready ? `${count} valoraciones · ya puedes continuar` : `${count} de ${MIN_RATINGS} valoraciones mínimas`}
            </span>
            <span className="progress" aria-hidden="true">
              <span className="progress__bar" style={{ width: `${Math.min(100, (count / MIN_RATINGS) * 100)}%` }} />
            </span>
          </div>
          <button type="button" className="btn btn--primary btn--lg" disabled={!ready || finishing} onClick={finish}>
            Ver mis recomendaciones <Icon name="arrowRight" size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}
