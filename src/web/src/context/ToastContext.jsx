import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import Icon from '../components/Icon.jsx';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
  }, []);

  const show = useCallback(
    (message, { tone = 'default', action, duration = 5000 } = {}) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((t) => [...t.slice(-2), { id, message, tone, action }]);
      timers.current.set(id, setTimeout(() => dismiss(id), duration));
      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone}`}>
            {t.tone === 'error' ? <Icon name="alert" size={18} /> : t.tone === 'success' ? <Icon name="check" size={18} /> : null}
            <span className="toast__msg">{t.message}</span>
            {t.action ? (
              <button
                type="button"
                className="toast__action"
                onClick={() => {
                  t.action.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            ) : null}
            <button type="button" className="toast__close" onClick={() => dismiss(t.id)} aria-label="Cerrar aviso">
              <Icon name="x" size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
