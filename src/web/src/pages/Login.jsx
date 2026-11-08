import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthShell from '../components/AuthShell.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import Icon from '../components/Icon.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { USE_MOCKS } from '../api/config.js';

export default function Login() {
  useDocumentTitle('Entrar');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [alias, setAlias] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!alias.trim() || !password) {
      setError('Escribe tu alias y tu contraseña.');
      return;
    }
    setBusy(true);
    try {
      const user = await login(alias.trim(), password);
      navigate(user.onboarded ? location.state?.from || '/' : '/bienvenida', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Hola de nuevo"
      subtitle="Entra con tu alias para seguir descubriendo películas."
      footer={
        <p>
          ¿Aún no tienes cuenta?{' '}
          <Link to="/registro" className="link">
            Crear cuenta
          </Link>
        </p>
      }
    >
      <form className="form" onSubmit={submit} noValidate>
        {error ? (
          <div className="form__alert" role="alert">
            <Icon name="alert" size={18} /> {error}
          </div>
        ) : null}
        <div className="field">
          <label className="field__label" htmlFor="alias">
            Alias
          </label>
          <input id="alias" className="input" autoComplete="username" value={alias} onChange={(e) => setAlias(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="password">
            Contraseña
          </label>
          <PasswordInput id="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button type="submit" className="btn btn--primary btn--lg btn--block" disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
        {USE_MOCKS ? (
          <div className="form__demo">
            <p className="form__demo-title">Cuentas de prueba (modo sin backend)</p>
            <div className="form__demo-btns">
              <button type="button" className="btn btn--sm" onClick={() => { setAlias('demo'); setPassword('demo1234'); }}>
                Usuario · demo
              </button>
              <button type="button" className="btn btn--sm" onClick={() => { setAlias('admin'); setPassword('admin1234'); }}>
                Administrador · admin
              </button>
            </div>
          </div>
        ) : null}
      </form>
    </AuthShell>
  );
}
