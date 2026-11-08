import Icon from './Icon.jsx';

export function EmptyState({ icon = 'film', title, children, action }) {
  return (
    <div className="state">
      <span className="state__icon" aria-hidden="true">
        <Icon name={icon} size={26} />
      </span>
      <h2 className="state__title">{title}</h2>
      {children ? <div className="state__text">{children}</div> : null}
      {action ? <div className="state__action">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="state state--error" role="alert">
      <span className="state__icon" aria-hidden="true">
        <Icon name="alert" size={26} />
      </span>
      <h2 className="state__title">No hemos podido cargar esto</h2>
      <p className="state__text">{error?.message || 'Ha ocurrido un error inesperado.'}</p>
      {onRetry ? (
        <button type="button" className="btn" onClick={onRetry}>
          <Icon name="refresh" size={16} /> Reintentar
        </button>
      ) : null}
    </div>
  );
}

export function PageLoader({ label = 'Cargando…' }) {
  return (
    <div className="page-loader" role="status">
      <span className="spinner" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
