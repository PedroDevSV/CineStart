import { useState } from 'react';
import Icon from './Icon.jsx';

export default function PasswordInput({ id, ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div className="input-wrap">
      <input id={id} className="input" type={show ? 'text' : 'password'} {...props} />
      <button
        type="button"
        className="icon-btn icon-btn--sm input-wrap__action"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={show}
      >
        <Icon name={show ? 'eyeOff' : 'eye'} size={18} />
      </button>
    </div>
  );
}
