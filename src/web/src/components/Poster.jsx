import { useState } from 'react';
import { TMDB_IMAGE_BASE } from '../api/config.js';
import { genreColor } from '../lib/genres.js';
import { year } from '../lib/format.js';
import { cx } from '../lib/text.js';

/**
 * Cartel de una película.
 * - Con `poster_path` (lo da la API de TMDB): imagen con carga diferida.
 * - Sin él, o si la imagen falla: cartel tipográfico generado con el color del género.
 */
export default function Poster({ movie, size = 'md', priority = false, decorative = false, className }) {
  const [failed, setFailed] = useState(false);
  const label = decorative ? undefined : `Cartel de ${movie.title}${movie.release_date ? ` (${year(movie.release_date)})` : ''}`;
  const width = size === 'lg' ? 'w500' : size === 'sm' ? 'w185' : 'w342';

  if (movie.poster_path && !failed) {
    return (
      <div className={cx('poster', `poster--${size}`, className)}>
        <img
          src={`${TMDB_IMAGE_BASE}/${width}${movie.poster_path}`}
          alt={decorative ? '' : label}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          fetchPriority={priority ? 'high' : 'auto'}
          onError={() => setFailed(true)}
        />
      </div>
    );
  }
  return <GeneratedPoster movie={movie} size={size} label={label} className={className} />;
}

function GeneratedPoster({ movie, size, label, className }) {
  const bg = genreColor(movie.genre_ids?.[0]);
  const motif = movie.id % 4;
  const len = movie.title.length;
  const titleClass = len > 34 ? 'is-xlong' : len > 22 ? 'is-long' : len > 12 ? 'is-mid' : 'is-short';
  return (
    <div
      className={cx('poster', 'poster--generated', `poster--${size}`, className)}
      style={{ '--poster-bg': bg }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <svg className="poster__motif" viewBox="0 0 200 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        {motif === 0 && <circle cx="150" cy="70" r="70" fill="none" stroke="currentColor" strokeWidth="1.2" />}
        {motif === 1 && (
          <g stroke="currentColor" strokeWidth="1">
            {Array.from({ length: 9 }, (_, i) => (
              <line key={i} x1="0" x2="200" y1={40 + i * 9} y2={40 + i * 9} />
            ))}
          </g>
        )}
        {motif === 2 && <path d="M-20 210 L220 30 L220 90 L-20 270 Z" fill="currentColor" opacity="0.5" />}
        {motif === 3 && (
          <g fill="currentColor">
            {Array.from({ length: 36 }, (_, i) => (
              <circle key={i} cx={110 + (i % 6) * 14} cy={30 + Math.floor(i / 6) * 14} r="1.6" />
            ))}
          </g>
        )}
      </svg>
      <span className="poster__year">{year(movie.release_date)}</span>
      <span className={cx('poster__title', titleClass)}>{movie.title}</span>
      {movie.director ? <span className="poster__director">{movie.director}</span> : <span />}
    </div>
  );
}
