import { useRef, useState } from 'react';
import { cx } from '../lib/text.js';

const LABELS = ['', 'No me gustó', 'Regular', 'Está bien', 'Me gustó', 'Me encantó'];

/**
 * Valoración de 1 a 5 estrellas accesible: grupo de radios con foco itinerante.
 * Flechas izquierda/derecha cambian el valor; Inicio/Fin van a 1 y 5.
 */
export default function StarRating({ value = 0, onChange, size = 22, label = 'Tu valoración', readOnly = false, showText = false, className }) {
  const [hover, setHover] = useState(0);
  const refs = useRef([]);
  const shown = hover || value;

  if (readOnly) {
    return (
      <span className={cx('stars', 'stars--readonly', className)} role="img" aria-label={`${value} de 5 estrellas`}>
        {[1, 2, 3, 4, 5].map((s) => (
          <Star key={s} filled={s <= value} size={size} />
        ))}
      </span>
    );
  }

  const set = (v) => {
    onChange?.(v);
    refs.current[v - 1]?.focus();
  };
  const onKeyDown = (e) => {
    const cur = value || 0;
    let next = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(5, cur + 1);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = Math.max(1, cur - 1 || 1);
    if (e.key === 'Home') next = 1;
    if (e.key === 'End') next = 5;
    if (next !== null) {
      e.preventDefault();
      set(next);
    }
  };

  return (
    <span className={cx('stars-wrap', className)}>
      <span className="stars" role="radiogroup" aria-label={label} onMouseLeave={() => setHover(0)} onKeyDown={onKeyDown}>
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            ref={(el) => (refs.current[s - 1] = el)}
            type="button"
            role="radio"
            aria-checked={value === s}
            aria-label={`${s} ${s === 1 ? 'estrella' : 'estrellas'}: ${LABELS[s]}`}
            tabIndex={value ? (value === s ? 0 : -1) : s === 1 ? 0 : -1}
            className="stars__btn"
            onMouseEnter={() => setHover(s)}
            onFocus={() => setHover(0)}
            onClick={() => set(s)}
          >
            <Star filled={s <= shown} size={size} preview={hover > 0 && s <= hover && s > value} />
          </button>
        ))}
      </span>
      {showText ? <span className="stars__text" aria-hidden="true">{shown ? LABELS[shown] : 'Sin valorar'}</span> : null}
    </span>
  );
}

function Star({ filled, size, preview }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={cx('star', filled && 'is-filled', preview && 'is-preview')}>
      <path d="M12 2.8l2.8 6.1 6.6.7-4.9 4.5 1.4 6.6L12 17.3l-5.9 3.4 1.4-6.6-4.9-4.5 6.6-.7z" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
