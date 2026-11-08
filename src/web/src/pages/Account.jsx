import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useLibrary } from '../context/LibraryContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { GENRES, genreName } from '../lib/genres.js';
import { longDate } from '../lib/format.js';

const maskEmail = (e) => {
  if (!e) return 'No disponible';
  const [u, d] = e.split('@');
  return `${u.slice(0, 2)}${'•'.repeat(Math.max(2, u.length - 2))}@${d}`;
};

export default function Account() {
  useDocumentTitle('Mi cuenta');
  const { user, saveGenres, deleteAccount, logout } = useAuth();
  const lib = useLibrary();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [genres, setGenres] = useState(user?.genre_ids ?? []);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [location.hash]);

  if (!user) return null;
  const dirty = genres.slice().sort().join() !== (user.genre_ids ?? []).slice().sort().join();

  const toggle = (id) =>
    setGenres((g) => (g.includes(id) ? g.filter((x) => x !== id) : g.length < 3 ? [...g, id] : g));

  const save = async () => {
    setSaving(true);
    try {
      await saveGenres(genres);
      toast.show('Géneros favoritos guardados.', { tone: 'success' });
    } catch (err) {
      toast.show(err.message, { tone: 'error' });
    }
    setSaving(false);
  };

  const exportData = () => {
    const payload = {
      exported_at: new Date().toISOString(),
      user: { alias: user.alias, email: user.email, role: user.role, created_at: user.created_at, genre_ids: user.genre_ids },
      ratings: [...lib.ratings.values()],
      dismissed: [...lib.dismissed],
      list: [...lib.list.entries()].map(([movie_id, added_at]) => ({ movie_id, added_at })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cinestart-${user.alias}-datos.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      navigate('/entrar', { replace: true });
    } catch (err) {
      toast.show(err.message, { tone: 'error' });
      setDeleting(false);
    }
  };

  const ids = Object.keys(GENRES)
    .map(Number)
    .filter((id) => ![10770, 10769].includes(id))
    .sort((a, b) => genreName(a).localeCompare(genreName(b)));

  return (
    <div className="page container account">
      <div className="page-head">
        <div className="page-head__text">
          <p className="eyebrow">Tu perfil</p>
          <h1 className="page-title">Mi cuenta</h1>
        </div>
      </div>

      <section className="panel acc-card" aria-labelledby="acc-profile">
        <span className="avatar avatar--xl" aria-hidden="true">
          {user.alias.slice(0, 1).toUpperCase()}
        </span>
        <div className="acc-card__main">
          <h2 id="acc-profile" className="acc-card__alias">
            {user.alias}
          </h2>
          <dl className="acc-facts">
            <div>
              <dt>Email</dt>
              <dd>{maskEmail(user.email)}</dd>
            </div>
            <div>
              <dt>Miembro desde</dt>
              <dd>{longDate(user.created_at)}</dd>
            </div>
            <div>
              <dt>Tipo de cuenta</dt>
              <dd>{user.role === 'admin' ? 'Administrador' : 'Usuario'}</dd>
            </div>
          </dl>
        </div>
        <div className="acc-stats">
          <Link to="/valoraciones" className="acc-stat">
            <span className="acc-stat__n">{lib.ratings.size}</span>
            <span className="acc-stat__l">valoraciones</span>
          </Link>
          <Link to="/mi-lista" className="acc-stat">
            <span className="acc-stat__n">{lib.list.size}</span>
            <span className="acc-stat__l">en Mi lista</span>
          </Link>
          <div className="acc-stat">
            <span className="acc-stat__n">{lib.dismissed.size}</span>
            <span className="acc-stat__l">descartadas</span>
          </div>
        </div>
      </section>

      <section className="acc-section" aria-labelledby="acc-genres">
        <div className="acc-section__head">
          <h2 id="acc-genres" className="acc-section__title">
            Géneros favoritos
          </h2>
          <p className="muted">Hasta 3. Dan un pequeño empujón a esos géneros en tus recomendaciones.</p>
        </div>
        <div className="filters" role="group" aria-label="Géneros favoritos">
          {ids.map((id) => (
            <button
              key={id}
              type="button"
              className="chip"
              aria-pressed={genres.includes(id)}
              disabled={!genres.includes(id) && genres.length >= 3}
              onClick={() => toggle(id)}
            >
              {genreName(id)}
            </button>
          ))}
        </div>
        <div className="acc-section__actions">
          <button type="button" className="btn btn--primary" onClick={save} disabled={!dirty || saving}>
            {saving ? 'Guardando…' : 'Guardar géneros'}
          </button>
          {dirty ? (
            <button type="button" className="btn btn--ghost" onClick={() => setGenres(user.genre_ids ?? [])}>
              Descartar cambios
            </button>
          ) : null}
        </div>
      </section>

      <section className="acc-section" id="privacidad" aria-labelledby="acc-privacy">
        <div className="acc-section__head">
          <h2 id="acc-privacy" className="acc-section__title">
            Privacidad y datos
          </h2>
        </div>
        <div className="privacy-grid">
          <div className="privacy-item">
            <Icon name="shield" size={20} />
            <div>
              <h3>Qué guardamos</h3>
              <p>Tu alias, tu contraseña cifrada (nunca en claro), tus valoraciones, descartes y Mi lista. Tu email se guarda aparte, en el servicio en la nube.</p>
            </div>
          </div>
          <div className="privacy-item">
            <Icon name="lock" size={20} />
            <div>
              <h3>Qué no guardamos</h3>
              <p>Ni nombre, ni edad, ni ubicación. A TMDB solo le pedimos datos de películas: nunca le enviamos nada tuyo.</p>
            </div>
          </div>
          <div className="privacy-item">
            <Icon name="activity" size={20} />
            <div>
              <h3>Para qué</h3>
              <p>Solo para recomendarte películas y medir, de forma agregada, si las recomendaciones funcionan.</p>
            </div>
          </div>
        </div>
        <div className="acc-section__actions">
          <button type="button" className="btn" onClick={exportData}>
            Descargar mis datos (JSON)
          </button>
        </div>
      </section>

      <section className="acc-section danger-zone" aria-labelledby="acc-danger">
        <div className="acc-section__head">
          <h2 id="acc-danger" className="acc-section__title">
            Sesión y cuenta
          </h2>
        </div>
        <div className="danger-zone__rows">
          <div className="danger-zone__row">
            <div>
              <h3>Cerrar sesión</h3>
              <p className="muted">Sales de CineStart en este navegador.</p>
            </div>
            <button
              type="button"
              className="btn"
              onClick={() => {
                logout();
                navigate('/entrar');
              }}
            >
              <Icon name="logout" size={16} /> Cerrar sesión
            </button>
          </div>
          <div className="danger-zone__row">
            <div>
              <h3>Borrar mi cuenta</h3>
              <p className="muted">Se borran tu cuenta, tus valoraciones, tus descartes y Mi lista. No se puede deshacer.</p>
            </div>
            <button type="button" className="btn btn--danger" onClick={() => setConfirm(true)}>
              <Icon name="trash" size={16} /> Borrar cuenta
            </button>
          </div>
        </div>
      </section>

      <ConfirmDialog
        open={confirm}
        title="¿Borrar tu cuenta para siempre?"
        confirmLabel="Borrar mi cuenta"
        danger
        busy={deleting}
        confirmText={user.alias}
        onClose={() => setConfirm(false)}
        onConfirm={remove}
      >
        Se eliminarán tu cuenta y todos tus datos: {lib.ratings.size} valoraciones, {lib.dismissed.size} descartes y {lib.list.size} películas de Mi lista. Esta
        acción no se puede deshacer.
      </ConfirmDialog>
    </div>
  );
}
