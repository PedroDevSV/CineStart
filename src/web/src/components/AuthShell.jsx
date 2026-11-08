import Logo from './Logo.jsx';
import Poster from './Poster.jsx';
import * as api from '../api/index.js';
import { useAsync } from '../hooks/useAsync.js';

/** Pantalla partida para entrar y registrarse: muro de carteles a un lado, formulario al otro. */
export default function AuthShell({ title, subtitle, children, footer }) {
  const { data: wall } = useAsync(() => api.getTopRated({ limit: 18 }), []);
  return (
    <div className="auth">
      <aside className="auth__art" aria-hidden="true">
        <div className="auth__wall">
          {(wall ?? []).map((m, i) => (
            <div key={m.id} className="auth__tile" style={{ '--i': i }}>
              <Poster movie={m} decorative />
            </div>
          ))}
        </div>
        <div className="auth__art-copy">
          <p className="auth__quote">Cinco películas que te gustan bastan para empezar.</p>
          <p className="auth__quote-sub">Valora unas pocas y CineStart te propone qué ver hoy, también del cine que nadie te ha contado.</p>
        </div>
      </aside>
      <section className="auth__panel">
        <div className="auth__top">
          <Logo to="/entrar" />
        </div>
        <div className="auth__form-wrap">
          <h1 className="auth__title">{title}</h1>
          {subtitle ? <p className="auth__subtitle">{subtitle}</p> : null}
          {children}
        </div>
        {footer ? <div className="auth__footer">{footer}</div> : null}
      </section>
    </div>
  );
}
