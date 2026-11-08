import { Link } from 'react-router-dom';
import Poster from './Poster.jsx';
import Icon from './Icon.jsx';
import { useLibrary } from '../context/LibraryContext.jsx';
import { rating, year } from '../lib/format.js';
import { genreName } from '../lib/genres.js';
import { cx } from '../lib/text.js';

/**
 * Tarjeta de película: cartel + título + año y nota.
 * Acciones fuera del enlace (no se anidan controles dentro de <a>):
 * añadir/quitar de Mi lista y, en recomendaciones, «No me interesa».
 */
export default function MovieCard({ movie, rank, showLongTail = false, allowDismiss = false, priority = false, showGenre = false, className }) {
  const lib = useLibrary();
  const mine = lib.ratingOf(movie.id);
  const saved = lib.inList(movie.id);

  return (
    <article className={cx('mcard', rank && 'mcard--ranked', className)}>
      <Link to={`/pelicula/${movie.id}`} className="mcard__link" onClick={() => lib.remember(movie)}>
        <div className="mcard__poster">
          <Poster movie={movie} decorative priority={priority} />
          {rank ? (
            <span className="mcard__rank" aria-hidden="true">
              {rank}
            </span>
          ) : null}
          {showLongTail && movie.long_tail ? (
            <span className="mcard__flag badge badge--gold">
              <Icon name="gem" size={12} strokeWidth={2.4} /> Poco vista
            </span>
          ) : null}
          {movie.source === 'tmdb' ? <span className="mcard__flag badge badge--info">TMDB</span> : null}
        </div>
        <span className="mcard__title">{movie.title}</span>
        <span className="mcard__meta">
          {rank ? <span className="sr-only">Puesto {rank}. </span> : null}
          <span>{year(movie.release_date)}</span>
          {showGenre && movie.genre_ids?.[0] ? <span className="dot-sep">{genreName(movie.genre_ids[0])}</span> : null}
          {mine ? (
            <span className="dot-sep mcard__mine">
              <Icon name="star" size={13} filled strokeWidth={0} /> Tu nota {mine}
            </span>
          ) : movie.vote_average ? (
            <span className="dot-sep">
              <span className="mcard__star" aria-hidden="true">★</span> {rating(movie.vote_average)}
              <span className="sr-only"> de nota media en TMDB</span>
            </span>
          ) : null}
        </span>
      </Link>

      <div className="mcard__actions">
        <button
          type="button"
          className={cx('mcard__btn', saved && 'is-on')}
          aria-pressed={saved}
          aria-label={saved ? `Quitar «${movie.title}» de Mi lista` : `Añadir «${movie.title}» a Mi lista`}
          title={saved ? 'En Mi lista' : 'Añadir a Mi lista'}
          onClick={() => lib.toggleList(movie)}
        >
          <Icon name={saved ? 'check' : 'plus'} size={18} strokeWidth={2.4} />
        </button>
        {allowDismiss ? (
          <button
            type="button"
            className="mcard__btn mcard__btn--secondary"
            aria-label={`No me interesa «${movie.title}»`}
            title="No me interesa"
            onClick={() => lib.dismiss(movie)}
          >
            <Icon name="eyeOff" size={17} />
          </button>
        ) : null}
      </div>
    </article>
  );
}

export function MovieCardSkeleton() {
  return (
    <div className="mcard mcard--skeleton" aria-hidden="true">
      <div className="mcard__poster skeleton" />
      <span className="skeleton skeleton--text" style={{ width: '80%' }} />
      <span className="skeleton skeleton--text" style={{ width: '45%' }} />
    </div>
  );
}
