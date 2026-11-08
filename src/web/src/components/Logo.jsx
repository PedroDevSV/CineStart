import { Link } from 'react-router-dom';

export default function Logo({ to = '/', className = '' }) {
  return (
    <Link to={to} className={`logo ${className}`} aria-label="CineStart, ir a Descubrir">
      <svg className="logo__mark" width="26" height="26" viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="22" fill="none" stroke="currentColor" strokeWidth="7" />
        <circle cx="32" cy="32" r="7" fill="currentColor" />
      </svg>
      <span className="logo__word">
        CineStart<span className="logo__dot">.</span>
      </span>
    </Link>
  );
}
