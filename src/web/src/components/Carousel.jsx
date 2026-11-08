import { useCallback, useEffect, useId, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { MovieCardSkeleton } from './MovieCard.jsx';
import { useInView } from '../hooks/useInView.js';
import { cx } from '../lib/text.js';

/**
 * Fila horizontal de tarjetas con desplazamiento nativo (táctil, rueda, teclado)
 * y flechas que avanzan una «página». Las flechas se desactivan en los extremos.
 */
export function Carousel({ title, subtitle, badge, action, children, className, id }) {
  const trackRef = useRef(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const autoId = useId();
  const headingId = id || `row-${autoId}`;

  const update = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    update();
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [update, children]);

  const page = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  };

  return (
    <section className={cx('row', className)} aria-labelledby={headingId}>
      <div className="row__head container">
        <div className="row__titles">
          <div className="row__title-line">
            <h2 id={headingId} className="row__title">
              {title}
            </h2>
            {badge}
          </div>
          {subtitle ? <p className="row__subtitle">{subtitle}</p> : null}
        </div>
        <div className="row__controls">
          {action}
          <button type="button" className="icon-btn" onClick={() => page(-1)} disabled={atStart} aria-label={`Anteriores: ${title}`}>
            <Icon name="chevronLeft" />
          </button>
          <button type="button" className="icon-btn" onClick={() => page(1)} disabled={atEnd} aria-label={`Siguientes: ${title}`}>
            <Icon name="chevronRight" />
          </button>
        </div>
      </div>
      <div className="row__viewport">
        <ul className="row__track" ref={trackRef} onScroll={update}>
          {children}
        </ul>
      </div>
    </section>
  );
}

export function CarouselSkeleton({ count = 7 }) {
  return Array.from({ length: count }, (_, i) => (
    <li key={i} className="row__item">
      <MovieCardSkeleton />
    </li>
  ));
}

/** Monta el contenido solo cuando la fila se acerca a la pantalla (carga diferida). */
export function LazySection({ children, minHeight = 420 }) {
  const [ref, inView] = useInView({ rootMargin: '400px 0px' });
  return (
    <div ref={ref} style={inView ? undefined : { minHeight }}>
      {inView ? children : null}
    </div>
  );
}
