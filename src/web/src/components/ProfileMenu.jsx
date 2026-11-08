import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from './Icon.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useLibrary } from '../context/LibraryContext.jsx';

/** Menú del perfil: Mis valoraciones, Mi cuenta, panel de administración y cerrar sesión. */
export default function ProfileMenu() {
  const { user, isAdmin, logout } = useAuth();
  const lib = useLibrary();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const items = () => [...(menuRef.current?.querySelectorAll('[role="menuitem"]') ?? [])];
    items()[0]?.focus();
    const onDoc = (e) => {
      if (!menuRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      const list = items();
      const i = list.indexOf(document.activeElement);
      if (e.key === 'Escape') {
        setOpen(false);
        btnRef.current?.focus();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        list[(i + 1) % list.length]?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        list[(i - 1 + list.length) % list.length]?.focus();
      } else if (e.key === 'Tab') setOpen(false);
    };
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;
  const close = () => setOpen(false);

  return (
    <div className="pmenu">
      <button
        ref={btnRef}
        type="button"
        className="pmenu__btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="avatar" aria-hidden="true">
          {user.alias.slice(0, 1).toUpperCase()}
        </span>
        <span className="pmenu__alias">{user.alias}</span>
        <span className="sr-only">: abrir menú de perfil</span>
        <Icon name="chevronDown" size={14} className="pmenu__chev" />
      </button>
      {open ? (
        <div className="pmenu__panel" ref={menuRef} role="menu" aria-label="Mi perfil">
          <div className="pmenu__head" role="presentation">
            <span className="avatar avatar--lg" aria-hidden="true">
              {user.alias.slice(0, 1).toUpperCase()}
            </span>
            <span>
              <span className="pmenu__name">{user.alias}</span>
              <span className="pmenu__stats">
                {lib.ratings.size} valoraciones · {lib.list.size} en Mi lista
              </span>
            </span>
          </div>
          <Link role="menuitem" to="/mi-lista" className="pmenu__item pmenu__item--mobile" onClick={close}>
            <Icon name="bookmark" size={18} /> Mi lista
          </Link>
          <Link role="menuitem" to="/valoraciones" className="pmenu__item" onClick={close}>
            <Icon name="star" size={18} /> Mis valoraciones
          </Link>
          <Link role="menuitem" to="/cuenta" className="pmenu__item" onClick={close}>
            <Icon name="user" size={18} /> Mi cuenta
          </Link>
          {isAdmin ? (
            <Link role="menuitem" to="/admin" className="pmenu__item" onClick={close}>
              <Icon name="chart" size={18} /> Panel de administración
            </Link>
          ) : null}
          <button
            role="menuitem"
            type="button"
            className="pmenu__item pmenu__item--sep"
            onClick={() => {
              close();
              logout();
              navigate('/entrar');
            }}
          >
            <Icon name="logout" size={18} /> Cerrar sesión
          </button>
        </div>
      ) : null}
    </div>
  );
}
