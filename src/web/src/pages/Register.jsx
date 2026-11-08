import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthShell from '../components/AuthShell.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import Icon from '../components/Icon.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

const ALIAS_RE = /^[A-Za-z0-9_.-]{3,30}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(v) {
  const e = {};
  if (!ALIAS_RE.test(v.alias.trim())) e.alias = 'Entre 3 y 30 caracteres: letras, números, punto, guion o guion bajo.';
  if (!EMAIL_RE.test(v.email.trim())) e.email = 'Introduce un email válido.';
  if (v.password.length < 8) e.password = 'Al menos 8 caracteres.';
  if (v.confirm !== v.password) e.confirm = 'Las contraseñas no coinciden.';
  if (!v.privacy) e.privacy = 'Necesitamos que aceptes el aviso de privacidad.';
  return e;
}

function strength(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}
const STRENGTH = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Fuerte'];

export default function Register() {
  useDocumentTitle('Crear cuenta');
  const { register } = useAuth();
  const navigate = useNavigate();
  const [v, setV] = useState({ alias: '', email: '', password: '', confirm: '', privacy: false });
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => {
    const next = { ...v, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value };
    setV(next);
    if (touched) setErrors(validate(next));
  };

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    setServerError('');
    const errs = validate(v);
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.getElementById(`reg-${Object.keys(errs)[0]}`)?.focus();
      return;
    }
    setBusy(true);
    try {
      await register(v.alias.trim(), v.email.trim(), v.password);
      navigate('/bienvenida', { replace: true });
    } catch (err) {
      const fieldErrors = {};
      (Array.isArray(err.details) ? err.details : []).forEach((d) => {
        const f = d.loc?.[d.loc.length - 1];
        if (f) fieldErrors[f] = d.msg;
      });
      if (Object.keys(fieldErrors).length) setErrors(fieldErrors);
      else setServerError(err.message);
      setBusy(false);
    }
  };

  const s = strength(v.password);
  const err = (k) =>
    errors[k] ? (
      <span className="field__error" id={`reg-${k}-err`}>
        <Icon name="alert" size={14} /> {errors[k]}
      </span>
    ) : null;

  return (
    <AuthShell
      title="Crea tu cuenta"
      subtitle="Solo necesitas un alias. En dos minutos tendrás tus primeras recomendaciones."
      footer={
        <p>
          ¿Ya tienes cuenta?{' '}
          <Link to="/entrar" className="link">
            Entrar
          </Link>
        </p>
      }
    >
      <form className="form" onSubmit={submit} noValidate>
        {serverError ? (
          <div className="form__alert" role="alert">
            <Icon name="alert" size={18} /> {serverError}
          </div>
        ) : null}
        <div className="field">
          <label className="field__label" htmlFor="reg-alias">
            Alias
          </label>
          <input
            id="reg-alias"
            className="input"
            autoComplete="username"
            value={v.alias}
            onChange={set('alias')}
            aria-invalid={!!errors.alias}
            aria-describedby={errors.alias ? 'reg-alias-err' : 'reg-alias-hint'}
            autoFocus
          />
          {err('alias') || (
            <span className="field__hint" id="reg-alias-hint">
              Es tu nombre en CineStart. Puede ser un seudónimo.
            </span>
          )}
        </div>
        <div className="field">
          <label className="field__label" htmlFor="reg-email">
            Email
          </label>
          <input
            id="reg-email"
            className="input"
            type="email"
            autoComplete="email"
            value={v.email}
            onChange={set('email')}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? 'reg-email-err' : undefined}
          />
          {err('email')}
        </div>
        <div className="form__row">
          <div className="field">
            <label className="field__label" htmlFor="reg-password">
              Contraseña
            </label>
            <PasswordInput
              id="reg-password"
              autoComplete="new-password"
              value={v.password}
              onChange={set('password')}
              aria-invalid={!!errors.password}
              aria-describedby="reg-password-meter"
            />
            {err('password') || (
              <span className="meter" id="reg-password-meter" aria-live="polite">
                <span className="meter__bars" aria-hidden="true">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className={i < s ? `is-on s${s}` : ''} />
                  ))}
                </span>
                <span className="field__hint">{v.password ? `Seguridad: ${STRENGTH[s]}` : 'Mínimo 8 caracteres'}</span>
              </span>
            )}
          </div>
          <div className="field">
            <label className="field__label" htmlFor="reg-confirm">
              Repite la contraseña
            </label>
            <PasswordInput
              id="reg-confirm"
              autoComplete="new-password"
              value={v.confirm}
              onChange={set('confirm')}
              aria-invalid={!!errors.confirm}
              aria-describedby={errors.confirm ? 'reg-confirm-err' : undefined}
            />
            {err('confirm')}
          </div>
        </div>
        <div className="field">
          <label className="checkbox" htmlFor="reg-privacy">
            <input id="reg-privacy" type="checkbox" checked={v.privacy} onChange={set('privacy')} aria-invalid={!!errors.privacy} />
            <span>
              He leído el aviso de privacidad: CineStart guarda tu alias y tu contraseña cifrada; tu email se guarda aparte en el
              servicio en la nube. No pedimos nombre, edad ni ubicación y puedes borrar tu cuenta y todos tus datos cuando quieras.
            </span>
          </label>
          {err('privacy')}
        </div>
        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy}>
          {busy ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>
    </AuthShell>
  );
}
