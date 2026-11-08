import Icon from '../../components/Icon.jsx';

export default function Pagination({ page, total, pageSize, onChange }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav className="pager" aria-label="Paginación">
      <span className="subtle">
        {from}–{to} de {total}
      </span>
      <div className="pager__btns">
        <button type="button" className="icon-btn icon-btn--sm" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Página anterior">
          <Icon name="chevronLeft" size={18} />
        </button>
        <span className="pager__page" aria-current="page">
          Página {page} de {pages}
        </span>
        <button type="button" className="icon-btn icon-btn--sm" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="Página siguiente">
          <Icon name="chevronRight" size={18} />
        </button>
      </div>
    </nav>
  );
}
