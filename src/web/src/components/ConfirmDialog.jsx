import { useEffect, useId, useRef, useState } from 'react';

/**
 * Diálogo de confirmación con <dialog> nativo (atrapa el foco y cierra con Esc).
 * `confirmText`: si se indica, hay que escribirlo para habilitar el botón (acciones irreversibles).
 */
export default function ConfirmDialog({ open, title, children, confirmLabel = 'Confirmar', danger = false, confirmText, busy = false, onConfirm, onClose }) {
  const ref = useRef(null);
  const [typed, setTyped] = useState('');
  const id = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setTyped('');
      d.showModal();
    } else if (!open && d.open) d.close();
  }, [open]);

  const ok = !confirmText || typed.trim() === confirmText;

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={`${id}-t`}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose?.()}
    >
      <form
        method="dialog"
        className="dialog__body"
        onSubmit={(e) => {
          e.preventDefault();
          if (ok && !busy) onConfirm?.();
        }}
      >
        <h2 id={`${id}-t`} className="dialog__title">
          {title}
        </h2>
        <div className="dialog__text">{children}</div>
        {confirmText ? (
          <div className="field">
            <label className="field__label" htmlFor={`${id}-c`}>
              Escribe <strong>{confirmText}</strong> para confirmar
            </label>
            <input id={`${id}-c`} className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </div>
        ) : null}
        <div className="dialog__actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className={danger ? 'btn btn--danger-solid' : 'btn btn--primary'} disabled={!ok || busy}>
            {busy ? 'Un momento…' : confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
