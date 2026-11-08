import { useMemo, useState } from 'react';
import Icon from '../../components/Icon.jsx';
import ConfirmDialog from '../../components/ConfirmDialog.jsx';
import { ErrorState } from '../../components/States.jsx';
import Pagination from './Pagination.jsx';
import * as api from '../../api/index.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDebounce } from '../../hooks/useDebounce.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { date, num } from '../../lib/format.js';

const PAGE_SIZE = 15;

export default function AdminUsers() {
  useDocumentTitle('Panel · Usuarios');
  const { user: me } = useAuth();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(null);
  const dq = useDebounce(q.trim(), 250);
  const { data, error, loading, reload } = useAsync(() => api.adminGetUsers({ q: dq, status }), [dq, status]);

  const rows = useMemo(() => (data ?? []).slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [data, page]);
  const counts = useMemo(() => ({ active: (data ?? []).filter((u) => u.active).length, total: data?.length ?? 0 }), [data]);

  const toggleActive = async (u) => {
    setBusy(u.id);
    try {
      await api.adminSetUserActive(u.id, !u.active);
      toast.show(u.active ? `Cuenta «${u.alias}» desactivada: ya no podrá entrar.` : `Cuenta «${u.alias}» reactivada.`, { tone: 'success' });
      await reload();
    } catch (err) {
      toast.show(err.message, { tone: 'error' });
    }
    setBusy(null);
  };

  const remove = async () => {
    const u = toDelete;
    setBusy(u.id);
    try {
      await api.adminDeleteUser(u.id);
      toast.show(`Cuenta «${u.alias}» y todos sus datos borrados.`, { tone: 'success' });
      setToDelete(null);
      await reload();
    } catch (err) {
      toast.show(err.message, { tone: 'error' });
    }
    setBusy(null);
  };

  return (
    <div className="admin-page">
      <header className="admin-head">
        <div>
          <p className="eyebrow">Panel de administración</p>
          <h1 className="page-title">Usuarios</h1>
          <p className="muted">
            {num(counts.total)} cuentas · {num(counts.active)} activas. Nunca se muestran contraseñas ni su hash.
          </p>
        </div>
      </header>

      <div className="atoolbar">
        <div className="atoolbar__search">
          <Icon name="search" size={16} className="atoolbar__icon" />
          <label htmlFor="usr-q" className="sr-only">
            Buscar por alias
          </label>
          <input
            id="usr-q"
            className="input input--sm"
            type="search"
            placeholder="Buscar por alias…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="segmented" role="group" aria-label="Estado">
          {[
            ['', 'Todas'],
            ['active', 'Activas'],
            ['inactive', 'Desactivadas'],
          ].map(([v, l]) => (
            <button
              key={v}
              type="button"
              aria-pressed={status === v}
              onClick={() => {
                setStatus(v);
                setPage(1);
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <>
          <div className={loading ? 'atable-wrap is-loading' : 'atable-wrap'}>
            <table className="atable">
              <thead>
                <tr>
                  <th scope="col">Alias</th>
                  <th scope="col">Alta</th>
                  <th scope="col" className="num">Valoraciones</th>
                  <th scope="col">Estado</th>
                  <th scope="col" className="atable__actions-col">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => {
                  const self = u.id === me?.id;
                  return (
                    <tr key={u.id}>
                      <td>
                        <span className="atable__user">
                          <span className="avatar" aria-hidden="true">
                            {u.alias.slice(0, 1).toUpperCase()}
                          </span>
                          <span className="atable__title">{u.alias}</span>
                          {u.role === 'admin' ? <span className="badge badge--accent">Admin</span> : null}
                          {self ? <span className="badge">Tú</span> : null}
                          {u.simulated ? <span className="badge badge--info" title="Usuario generado para la demo">Simulado</span> : null}
                        </span>
                      </td>
                      <td>{date(u.created_at)}</td>
                      <td className="num">{num(u.ratings_count)}</td>
                      <td>{u.active ? <span className="badge badge--success">Activa</span> : <span className="badge badge--danger">Desactivada</span>}</td>
                      <td className="atable__actions">
                        {self || u.role === 'admin' ? null : (
                          <>
                            <button type="button" className="btn btn--sm" disabled={busy === u.id} onClick={() => toggleActive(u)}>
                              {u.active ? 'Desactivar' : 'Reactivar'}
                            </button>
                            <button
                              type="button"
                              className="icon-btn icon-btn--sm"
                              aria-label={`Borrar la cuenta de ${u.alias}`}
                              disabled={busy === u.id}
                              onClick={() => setToDelete(u)}
                            >
                              <Icon name="trash" size={16} />
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {data && !rows.length ? (
                  <tr>
                    <td colSpan={5} className="atable__empty">
                      No hay cuentas que cumplan el filtro.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {data ? <Pagination page={page} total={data.length} pageSize={PAGE_SIZE} onChange={setPage} /> : null}
        </>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title={`¿Borrar la cuenta de ${toDelete?.alias}?`}
        confirmLabel="Borrar cuenta"
        danger
        busy={busy === toDelete?.id}
        confirmText={toDelete?.alias}
        onClose={() => setToDelete(null)}
        onConfirm={remove}
      >
        Se borrarán la cuenta y todas sus valoraciones, descartes y Mi lista. No se puede deshacer.
      </ConfirmDialog>
    </div>
  );
}
