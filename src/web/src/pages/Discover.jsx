import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Poster from '../components/Poster.jsx';
import MovieCard from '../components/MovieCard.jsx';
import StarRating from '../components/StarRating.jsx';
import Icon from '../components/Icon.jsx';
import { Carousel, CarouselSkeleton, LazySection } from '../components/Carousel.jsx';
import { ErrorState } from '../components/States.jsx';
import * as api from '../api/index.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useLibrary } from '../context/LibraryContext.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { genreColor, genreName, genreNames } from '../lib/genres.js';
import { num, rating, runtime, year } from '../lib/format.js';

export default function Discover() {
  useDocumentTitle('Descubrir');
  const { user } = useAuth();
  const lib = useLibrary();
  const location = useLocation();
  const recs = useAsync(() => api.getRecommendations({ n: 10 }), [lib.version]);

  const items = useMemo(
    () => (recs.data?.items ?? []).filter((m) => !lib.isDismissed(m.id) && !lib.ratings.has(m.id)),
    [recs.data, lib],
  );
  const hero = items[0];
  const rest = items.slice(1);
  const favGenres = (user?.genre_ids ?? []).slice(0, 2);

  return (
    <div className="discover">
      {recs.error && !recs.data ? (
        <div className="container">
          <ErrorState error={recs.error} onRetry={recs.reload} />
        </div>
      ) : (
        <Hero movie={hero} loading={!hero && recs.loading} welcome={location.state?.welcome} />
      )}

      <ProfileStrip />

      <Carousel
        title="Recomendadas para ti"
        subtitle="Se actualizan cada vez que valoras o descartas una película"
        badge={recs.loading && recs.data ? <span className="badge">Actualizando…</span> : null}
      >
        {!recs.data
          ? <CarouselSkeleton />
          : rest.map((m, i) => (
              <li key={m.id} className="row__item">
                <MovieCard movie={m} allowDismiss showLongTail priority={i < 6} />
              </li>
            ))}
      </Carousel>

      <MyListRow />

      <LazySection>
        <ApiRow
          title="Joyas por descubrir"
          subtitle="Películas con pocos votos que encajan con tus gustos"
          badge={
            <span className="badge badge--gold">
              <Icon name="gem" size={12} strokeWidth={2.4} /> Poco vistas
            </span>
          }
          load={() => api.getRecommendations({ n: 14, longTail: true }).then((r) => r.items)}
          deps={[lib.version]}
          filterSeen
          cardProps={{ allowDismiss: true }}
        />
      </LazySection>

      {(favGenres.length ? favGenres : [null]).map((g) => (
        <LazySection key={g ?? 'all'}>
          <ApiRow
            title={g ? `Lo más valorado en ${genreName(g)}` : 'Lo más valorado'}
            subtitle={g ? 'Uno de tus géneros favoritos, ordenado por nota ponderada' : 'Ordenado por nota ponderada (media y número de votos)'}
            load={() => api.getTopRated({ genreId: g, limit: 15 })}
            ranked
          />
        </LazySection>
      ))}
    </div>
  );
}

function Hero({ movie, loading, welcome }) {
  const lib = useLibrary();
  if (loading || !movie) {
    return (
      <section className="hero hero--loading" aria-busy="true" aria-label="Cargando recomendación destacada">
        <div className="container hero__inner">
          <div className="hero__text">
            <span className="skeleton" style={{ width: 180, height: 14 }} />
            <span className="skeleton" style={{ width: '70%', height: 64, marginTop: 18 }} />
            <span className="skeleton" style={{ width: '50%', height: 16, marginTop: 18 }} />
            <span className="skeleton" style={{ width: '90%', height: 60, marginTop: 18 }} />
          </div>
          <div className="hero__poster skeleton" />
        </div>
      </section>
    );
  }
  const saved = lib.inList(movie.id);
  const mine = lib.ratingOf(movie.id);
  const facts = [year(movie.release_date), runtime(movie.runtime), genreNames(movie.genre_ids).join(', ')].filter(Boolean);

  return (
    <section className="hero" style={{ '--hero-tint': genreColor(movie.genre_ids?.[0]) }} aria-labelledby="hero-title">
      <div className="hero__backdrop" aria-hidden="true" />
      <div className="container hero__inner">
        <div className="hero__text">
          <p className="eyebrow">{welcome ? 'Tu primera recomendación' : 'Recomendada para ti'}</p>
          <h1 id="hero-title" className="hero__title">
            {movie.title}
          </h1>
          <p className="hero__facts">
            {facts.map((f, i) => (
              <span key={i} className={i ? 'dot-sep' : undefined}>
                {f}
              </span>
            ))}
          </p>
          <p className="hero__people">
            {movie.director ? (
              <>
                <span className="subtle">Dirección</span> {movie.director}
              </>
            ) : null}
            {movie.cast?.length ? (
              <>
                <span className="subtle hero__people-sep">Reparto</span> {movie.cast.slice(0, 3).join(', ')}
              </>
            ) : null}
          </p>
          <p className="hero__overview">{movie.overview}</p>
          <div className="hero__score">
            {movie.vote_average ? (
              <span className="score">
                <span className="score__value">
                  <span className="score__star" aria-hidden="true">★</span> {rating(movie.vote_average)}
                </span>
                <span className="score__label">{num(movie.vote_count)} votos en TMDB</span>
              </span>
            ) : null}
            {movie.long_tail ? (
              <span className="badge badge--gold">
                <Icon name="gem" size={12} strokeWidth={2.4} /> Poco vista
              </span>
            ) : null}
          </div>
          <div className="hero__actions">
            <Link to={`/pelicula/${movie.id}`} className="btn btn--light btn--lg" onClick={() => lib.remember(movie)}>
              Ver ficha
            </Link>
            <button
              type="button"
              className={saved ? 'btn btn--lg btn--active' : 'btn btn--lg'}
              aria-pressed={saved}
              onClick={() => lib.toggleList(movie)}
            >
              <Icon name={saved ? 'check' : 'plus'} size={18} strokeWidth={2.4} /> {saved ? 'En Mi lista' : 'Mi lista'}
            </button>
            <button type="button" className="btn btn--ghost btn--lg" onClick={() => lib.dismiss(movie)}>
              <Icon name="eyeOff" size={18} /> No me interesa
            </button>
          </div>
          <div className="hero__rate">
            <span className="hero__rate-label">¿Ya la has visto?</span>
            <StarRating value={mine} onChange={(v) => lib.rate(movie, v, 'recommendation')} label={`Valora «${movie.title}»`} showText />
          </div>
        </div>
        <Link to={`/pelicula/${movie.id}`} className="hero__poster" tabIndex={-1} aria-hidden="true">
          <Poster movie={movie} size="lg" priority decorative />
        </Link>
      </div>
    </section>
  );
}

function ProfileStrip() {
  const lib = useLibrary();
  const recent = useMemo(
    () =>
      [...lib.ratings.values()]
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
        .slice(0, 5),
    [lib.ratings],
  );
  const ids = recent.map((r) => r.movie_id);
  const { data } = useAsync(() => api.getMoviesByIds(ids), [ids.join(',')], { enabled: ids.length > 0 });
  const byId = new Map((data ?? []).map((m) => [m.id, m]));

  return (
    <section className="pstrip" aria-label="Tu perfil de gustos">
      <div className="container pstrip__inner">
        <p className="pstrip__lead">
          Basado en tus <strong>{lib.ratings.size} valoraciones</strong>
        </p>
        <ul className="pstrip__chips">
          {recent.map((r) => {
            const m = byId.get(r.movie_id);
            return (
              <li key={r.movie_id}>
                <Link to={`/pelicula/${r.movie_id}`} className="chip chip--static pstrip__chip">
                  <span className="pstrip__chip-title">{m?.title ?? '…'}</span>
                  <StarRating value={r.rating} readOnly size={12} />
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="pstrip__links">
          <Link to="/valoraciones" className="link link--plain">
            Mis valoraciones
          </Link>
          <Link to="/bienvenida" state={{ step: 2 }} className="link">
            Valorar más películas →
          </Link>
        </div>
      </div>
    </section>
  );
}

function MyListRow() {
  const lib = useLibrary();
  const ids = useMemo(
    () => [...lib.list.entries()].sort((a, b) => Date.parse(b[1]) - Date.parse(a[1])).map(([id]) => id),
    [lib.list],
  );
  const { data } = useAsync(() => api.getMoviesByIds(ids), [ids.join(',')], { enabled: ids.length > 0 });
  if (!ids.length) return null;
  const byId = new Map((data ?? []).map((m) => [m.id, m]));
  const movies = ids.map((id) => byId.get(id) ?? lib.movieCache.get(id)).filter(Boolean);

  return (
    <Carousel
      title="Mi lista"
      subtitle="Películas que has guardado para ver más tarde"
      action={
        <Link to="/mi-lista" className="btn btn--sm row__see-all">
          Ver todo
        </Link>
      }
    >
      {!movies.length ? (
        <CarouselSkeleton count={Math.min(6, ids.length)} />
      ) : (
        movies.map((m) => (
          <li key={m.id} className="row__item">
            <MovieCard movie={m} />
          </li>
        ))
      )}
    </Carousel>
  );
}

function ApiRow({ title, subtitle, badge, load, deps = [], ranked = false, filterSeen = false, cardProps = {} }) {
  const lib = useLibrary();
  const { data, error, reload } = useAsync(load, deps);
  const movies = (data ?? []).filter((m) => !filterSeen || (!lib.isDismissed(m.id) && !lib.ratings.has(m.id)));
  if (error) {
    return (
      <Carousel title={title} subtitle={subtitle}>
        <li className="row__error">
          No se ha podido cargar esta fila.{' '}
          <button type="button" className="link" onClick={reload} style={{ background: 'none', border: 0 }}>
            Reintentar
          </button>
        </li>
      </Carousel>
    );
  }
  if (data && !movies.length) return null;
  return (
    <Carousel title={title} subtitle={subtitle} badge={badge}>
      {!data ? (
        <CarouselSkeleton />
      ) : (
        movies.map((m, i) => (
          <li key={m.id} className="row__item">
            <MovieCard movie={m} rank={ranked && i < 10 ? i + 1 : undefined} showLongTail={!ranked} {...cardProps} />
          </li>
        ))
      )}
    </Carousel>
  );
}
