import { Link } from 'react-router-dom';
import { USE_MOCKS } from '../api/config.js';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__inner container">
        <div className="footer__brand">
          <span className="footer__logo">
            CineStart<span className="logo__dot">.</span>
          </span>
          <p className="footer__tag">Recomendaciones de cine desde tu primera sesión.</p>
          {USE_MOCKS ? (
            <p className="mock-note" title="VITE_USE_MOCKS=true">
              Modo sin backend: datos de ejemplo
            </p>
          ) : null}
        </div>
        <div className="footer__tmdb">
          <span className="tmdb-mark" aria-hidden="true">
            TMDB
          </span>
          <p>
            Este producto usa la API de TMDB pero no está respaldado ni certificado por TMDB. Catálogo base: TMDB 5000 Movie
            Dataset (hasta febrero de 2017), ampliado con TMDB al buscar.
          </p>
        </div>
        <nav className="footer__nav" aria-label="Pie de página">
          <Link to="/cuenta#privacidad">Privacidad</Link>
          <Link to="/cuenta">Mi cuenta</Link>
          <Link to="/acerca">Sobre el proyecto</Link>
        </nav>
      </div>
    </footer>
  );
}
