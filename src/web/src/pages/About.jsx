import { Link } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';

const STEPS = [
  { icon: 'star', title: 'Valoras unas pocas', text: 'Con tres valoraciones ya hay recomendaciones. Cuantas más des, más se parecen a ti.' },
  { icon: 'sparkle', title: 'El motor compara contenido', text: 'Géneros, temática, dirección, reparto y sinopsis de cada película, junto a su nota ponderada.' },
  { icon: 'gem', title: 'Da visibilidad al catálogo', text: 'Reserva sitio para películas poco vistas y evita que una lista sea siempre del mismo género.' },
  { icon: 'refresh', title: 'Aprende contigo', text: 'Cada valoración o «No me interesa» recalcula tus recomendaciones al momento.' },
];

export default function About() {
  useDocumentTitle('Sobre el proyecto');
  return (
    <div className="page container about">
      <div className="about__intro">
        <p className="eyebrow">Sobre el proyecto</p>
        <h1 className="page-title">Recomendaciones de cine desde la primera sesión</h1>
        <p className="about__lead">
          CineStart es un recomendador híbrido de películas pensado para usuarios nuevos: en lugar de enseñar a todo el mundo la misma
          lista de éxitos, aprende tus gustos con muy pocas valoraciones.
        </p>
      </div>
      <ol className="about__steps">
        {STEPS.map((s, i) => (
          <li key={s.title} className="about__step panel">
            <span className="about__num">{String(i + 1).padStart(2, '0')}</span>
            <Icon name={s.icon} size={22} />
            <h2>{s.title}</h2>
            <p>{s.text}</p>
          </li>
        ))}
      </ol>
      <div className="about__credits panel">
        <div>
          <h2 className="acc-section__title">Proyecto académico</h2>
          <p className="muted">
            Curso de especialización en Inteligencia Artificial y Big Data · Módulo C088 · Grupo 2 · 2026–2027.
          </p>
        </div>
        <div className="footer__tmdb">
          <span className="tmdb-mark" aria-hidden="true">
            TMDB
          </span>
          <p>Datos de películas e imágenes de The Movie Database (TMDB). Este producto usa la API de TMDB pero no está respaldado ni certificado por TMDB.</p>
        </div>
      </div>
      <Link to="/" className="btn btn--primary">
        Ir a Descubrir <Icon name="arrowRight" size={16} />
      </Link>
    </div>
  );
}
