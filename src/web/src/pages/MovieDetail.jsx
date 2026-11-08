import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Poster from '../components/Poster.jsx';
import MovieCard from '../components/MovieCard.jsx';
import StarRating from '../components/StarRating.jsx';
import Icon from '../components/Icon.jsx';
import { Carousel } from '../components/Carousel.jsx';
import { EmptyState, ErrorState, PageLoader } from '../components/States.jsx';
import * as api from '../api/index.js';
import { useLibrary } from '../context/LibraryContext.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { genreColor, genreName } from '../lib/genres.js';
import { date, num, rating, runtime, year } from '../lib/format.js';

const LANG = { en: 'Inglés', es: 'Español', fr: 'Francés', de: 'Alemán', it: 'Italiano', ja: 'Japonés', ko: 'Coreano', zh: 'Chino', hi: 'Hindi', ru: 'Ruso', pt: 'Portugués', cn: 'Cantonés', da: 'Danés', sv: 'Sueco' };

export default function MovieDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const lib = useLibrary();
  const { data: movie, error, loading, reload } = useAsync(() => api.getMovie(id), [id]);
  useDocumentTitle(movie?.title);

  useEffect(() => {
    if (movie) lib.remember(movie);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movie]);

  if (loading && !movie) return <PageLoader label="Cargando película…" />;
  if (error) {
    return (
      <div className="page container">
        {error.status === 404 ? (
          <EmptyState
            icon="film"
            title="Esta película no está disponible"
            action={
              <Link to="/" className="btn">
                Volver a Descubrir
              </Link>
            }
          >
            Puede que el enlace sea incorrecto o que la película ya no esté en el catálogo.
          </EmptyState>
        ) : (
          <ErrorState error={error} onRetry={reload} />
        )}
      </div>
    );
  }
  if (!movie) return null;

  const mine = lib.ratingOf(movie.id);
  const saved = lib.inList(movie.id);
  const dismissed = lib.isDismissed(movie.id);
  const fromTmdb = movie.added_from_tmdb || movie.source === 'tmdb';

  return (
    <article className="detail" style={{ '--hero-tint': genreColor(movie.genre_ids?.[0]) }}>
      <div className="detail__backdrop" aria-hidden="true" />
      <div className="container">
        <button type="button" className="btn btn--ghost btn--sm detail__back" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}>
          <Icon name="arrowLeft" size={16} /> Volver
        </button>

        <div className="detail__main">
          <div className="detail__poster">
            <Poster movie={movie} size="lg" priority />
          </div>

          <div className="detail__info">
            <p className="detail__genres">
              {movie.genre_ids.map((g, i) => (
                <span key={g} className={i ? 'dot-sep' : undefined}>
                  {genreName(g)}
                </span>
              ))}
            </p>
            <h1 className="detail__title">{movie.title}</h1>
            {movie.original_title ? <p className="detail__original">Título original: {movie.original_title}</p> : null}
            <p className="detail__facts">
              <span>{year(movie.release_date)}</span>
              {movie.runtime ? <span className="dot-sep">{runtime(movie.runtime)}</span> : null}
              {movie.original_language ? <span className="dot-sep">{LANG[movie.original_language] ?? movie.original_language.toUpperCase()}</span> : null}
            </p>

            {fromTmdb ? (
              <p className="notice">
                <Icon name="globe" size={16} /> Nueva en CineStart: la hemos traído de TMDB a partir de tu búsqueda.
              </p>
            ) : null}

            <div className="detail__scores">
              {movie.vote_average ? (
                <div className="score score--lg">
                  <span className="score__value">
                    <span className="score__star" aria-hidden="true">★</span> {rating(movie.vote_average)}
                    <span className="score__max">/10</span>
                  </span>
                  <span className="score__label">{num(movie.vote_count)} votos en TMDB</span>
                </div>
              ) : null}
              {movie.long_tail ? (
                <span className="badge badge--gold">
                  <Icon name="gem" size={12} strokeWidth={2.4} /> Poco vista
                </span>
              ) : null}
            </div>

            <div className="detail__actions">
              <button type="button" className={saved ? 'btn btn--lg btn--active' : 'btn btn--lg btn--primary'} aria-pressed={saved} onClick={() => lib.toggleList(movie)}>
                <Icon name={saved ? 'check' : 'plus'} size={18} strokeWidth={2.4} /> {saved ? 'En Mi lista' : 'Añadir a Mi lista'}
              </button>
              {dismissed ? (
                <button type="button" className="btn btn--lg" onClick={() => lib.undismiss(movie)}>
                  <Icon name="undo" size={18} /> Volver a recomendármela
                </button>
              ) : (
                <button type="button" className="btn btn--lg btn--ghost" onClick={() => lib.dismiss(movie)} disabled={!!mine}>
                  <Icon name="eyeOff" size={18} /> No me interesa
                </button>
              )}
            </div>

            <div className="rate-box">
              <div>
                <h2 className="rate-box__title">{mine ? 'Tu valoración' : '¿La has visto?'}</h2>
                <p className="rate-box__hint">{mine ? 'Puedes cambiarla cuando quieras.' : 'Valórala para afinar tus recomendaciones.'}</p>
              </div>
              <div className="rate-box__control">
                <StarRating value={mine} onChange={(v) => lib.rate(movie, v, 'recommendation')} label={`Valora «${movie.title}»`} size={26} showText />
                {mine ? (
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => lib.removeRating(movie)}>
                    Quitar valoración
                  </button>
                ) : null}
              </div>
            </div>

            <section className="detail__section" aria-labelledby="sinopsis">
              <h2 id="sinopsis" className="detail__h2">
                Sinopsis
              </h2>
              <p className="detail__overview">{movie.overview || 'Sin sinopsis disponible.'}</p>
            </section>

            <dl className="credits">
              {movie.director ? (
                <div className="credits__row">
                  <dt>Dirección</dt>
                  <dd>{movie.director}</dd>
                </div>
              ) : null}
              {movie.cast?.length ? (
                <div className="credits__row">
                  <dt>Reparto</dt>
                  <dd>{movie.cast.join(', ')}</dd>
                </div>
              ) : null}
              <div className="credits__row">
                <dt>Estreno</dt>
                <dd>{date(movie.release_date)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      {movie.similar?.length ? (
        <Carousel title="Películas similares" subtitle="Del mismo estilo que esta">
          {movie.similar.map((m) => (
            <li key={m.id} className="row__item">
              <MovieCard movie={m} showLongTail />
            </li>
          ))}
        </Carousel>
      ) : null}
    </article>
  );
}
