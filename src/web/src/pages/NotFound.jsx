import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

export default function NotFound() {
  useDocumentTitle('Página no encontrada');
  return (
    <div className="page container notfound">
      <p className="notfound__code" aria-hidden="true">
        404
      </p>
      <h1 className="page-title">Fundido a negro</h1>
      <p className="muted">Esta página no existe o se ha movido.</p>
      <Link to="/" className="btn btn--primary">
        Volver a Descubrir
      </Link>
    </div>
  );
}
