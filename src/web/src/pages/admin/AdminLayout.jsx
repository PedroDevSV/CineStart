import { Suspense } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import Icon from '../../components/Icon.jsx';
import { PageLoader } from '../../components/States.jsx';
import { USE_MOCKS } from '../../api/config.js';
import '../../styles/admin.css';

const NAV = [
  { to: '/admin', end: true, icon: 'chart', label: 'Resumen' },
  { to: '/admin/catalogo', icon: 'film', label: 'Catálogo' },
  { to: '/admin/usuarios', icon: 'users', label: 'Usuarios' },
  { to: '/admin/uso', icon: 'activity', label: 'Uso de la app' },
];

export default function AdminLayout() {
  return (
    <div className="admin container">
      <aside className="admin__side">
        <p className="admin__side-title">Administración</p>
        <nav aria-label="Panel de administración" className="admin__nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="admin__link">
              <Icon name={n.icon} size={18} /> {n.label}
            </NavLink>
          ))}
        </nav>
        {USE_MOCKS ? (
          <p className="admin__note">
            <Icon name="info" size={16} /> Con datos simulados: unos 140 usuarios de prueba generados con el propio recomendador, más tu actividad en este navegador.
          </p>
        ) : null}
        <p className="admin__note admin__note--plain">
          <Icon name="lock" size={16} /> Solo consulta: el panel no permite editar películas ni ver contraseñas.
        </p>
      </aside>
      <div className="admin__main">
        <Suspense fallback={<PageLoader />}>
          <Outlet />
        </Suspense>
      </div>
    </div>
  );
}
