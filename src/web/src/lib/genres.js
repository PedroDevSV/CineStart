/**
 * Nombres en castellano y color de cartel por género (id de TMDB).
 * La API devuelve los nombres en inglés; la web los traduce por id.
 */
export const GENRES = {
  28: { es: 'Acción', color: '#5a1f24' },
  12: { es: 'Aventura', color: '#4b3b1c' },
  16: { es: 'Animación', color: '#1f4a4d' },
  35: { es: 'Comedia', color: '#5b4318' },
  80: { es: 'Crimen', color: '#2b2b33' },
  99: { es: 'Documental', color: '#33402f' },
  18: { es: 'Drama', color: '#3d2f3f' },
  10751: { es: 'Familia', color: '#2c4a3a' },
  14: { es: 'Fantasía', color: '#3b2a4a' },
  10769: { es: 'Extranjera', color: '#46372a' },
  36: { es: 'Historia', color: '#4a3520' },
  27: { es: 'Terror', color: '#3a1518' },
  10402: { es: 'Música', color: '#4a2440' },
  9648: { es: 'Misterio', color: '#23304f' },
  10749: { es: 'Romance', color: '#5a2a35' },
  878: { es: 'Ciencia ficción', color: '#1f3b4d' },
  10770: { es: 'Película de TV', color: '#383838' },
  53: { es: 'Suspense', color: '#2f3a2a' },
  10752: { es: 'Bélica', color: '#3b3a26' },
  37: { es: 'Western', color: '#5a3a22' },
};

export const genreName = (id, fallback = '') => GENRES[id]?.es ?? fallback;
export const genreColor = (id) => GENRES[id]?.color ?? '#2b2722';
export const genreNames = (ids = [], max = 3) => ids.slice(0, max).map((id) => genreName(id)).filter(Boolean);
