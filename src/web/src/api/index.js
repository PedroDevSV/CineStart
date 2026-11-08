/**
 * Puerta única entre la web y el backend.
 *
 * Cada función tiene dos implementaciones:
 *   - real : llama a la API FastAPI (rutas en el README, sección «Contrato de la API»)
 *   - mock : datos de ejemplo en el navegador (src/api/mock), para trabajar sin backend
 *
 * Se elige con VITE_USE_MOCKS. Las pantallas solo importan desde aquí,
 * así que conectar el backend no obliga a tocar ningún componente.
 */
import { USE_MOCKS } from './config.js';
import { http } from './http.js';

// El mock (y su catálogo de ~460 KB) solo se descarga si se usa.
let mockPromise;
const mock = () => (mockPromise ??= import('./mock/handlers.js'));
const pick = (name, real) => (...args) => (USE_MOCKS ? mock().then((m) => m[name](...args)) : real(...args));

/* ---------------- autenticación y cuenta ---------------- */
// -> { access_token, user }
export const login = pick('login', ({ alias, password }) =>
  http('/auth/login', { method: 'POST', body: { alias, password } }));

// -> { access_token, user }
export const register = pick('register', ({ alias, email, password }) =>
  http('/auth/registro', { method: 'POST', body: { alias, email, password } }));

// -> user { id, alias, email, role, genre_ids, onboarded, created_at }
export const getMe = pick('getMe', () => http('/auth/yo'));

export const deleteMe = pick('deleteMe', () => http('/auth/yo', { method: 'DELETE' }));

export const saveMyGenres = pick('saveMyGenres', (genreIds) =>
  http('/usuarios/yo/generos', { method: 'PUT', body: { genre_ids: genreIds } }));

/* ---------------- catálogo ---------------- */
// -> [{ id, name }]
export const getGenres = pick('getGenres', () => http('/generos'));

// -> [movie] (unas 20, variadas)
export const getOnboardingMovies = pick('getOnboardingMovies', ({ genreIds = [] } = {}) =>
  http('/onboarding/peliculas', { query: { generos: genreIds.join(',') } }));

// -> movie + { similar: [movie] }
export const getMovie = pick('getMovie', (id) => http(`/peliculas/${id}`));

// -> { catalog: [movie], tmdb: [movie] }   (tmdb: solo si no está en el catálogo)
export const searchMovies = pick('searchMovies', (q, { signal } = {}) =>
  http('/peliculas/buscar', { query: { q }, signal }));

// -> [movie]
export const getTopRated = pick('getTopRated', ({ genreId, limit = 20 } = {}) =>
  http('/peliculas', { query: { genero: genreId, orden: 'nota', limite: limit } }));

/* ---------------- recomendaciones ---------------- */
// -> { items: [movie], model_version, generated_at }
export const getRecommendations = pick('getRecommendations', ({ n = 10, longTail = false } = {}) =>
  http('/recomendaciones', { query: { n, cola_larga: longTail || undefined } }));

/* ---------------- biblioteca del usuario ---------------- */
// -> { ratings: [{ movie_id, rating, source, created_at }], dismissed: [movie_id], list: [{ movie_id, added_at }] }
export const getLibrary = pick('getLibrary', async () => {
  const [ratings, dismissed, list] = await Promise.all([http('/valoraciones'), http('/descartes'), http('/lista')]);
  return { ratings, dismissed, list };
});

export const rateMovie = pick('rateMovie', (movieId, rating, source) =>
  http(`/valoraciones/${movieId}`, { method: 'PUT', body: { rating, source } }));

export const deleteRating = pick('deleteRating', (movieId) =>
  http(`/valoraciones/${movieId}`, { method: 'DELETE' }));

export const dismissMovie = pick('dismissMovie', (movieId) =>
  http('/descartes', { method: 'POST', body: { movie_id: movieId } }));

export const undismissMovie = pick('undismissMovie', (movieId) =>
  http(`/descartes/${movieId}`, { method: 'DELETE' }));

export const addToList = pick('addToList', (movieId) => http(`/lista/${movieId}`, { method: 'PUT' }));

export const removeFromList = pick('removeFromList', (movieId) =>
  http(`/lista/${movieId}`, { method: 'DELETE' }));

// Varias películas a la vez (para pintar valoraciones y Mi lista) -> [movie]
export const getMoviesByIds = pick('getMoviesByIds', (ids) =>
  ids.length ? http('/peliculas', { query: { ids: ids.join(',') } }) : Promise.resolve([]));

/* ---------------- administración ---------------- */
export const adminGetKpis = pick('adminGetKpis', ({ days = 30 } = {}) =>
  http('/admin/kpis', { query: { dias: days } }));

export const adminGetMovies = pick('adminGetMovies', ({ q, neverRecommended, page = 1, pageSize = 20, sort } = {}) =>
  http('/admin/peliculas', {
    query: { buscar: q, nunca_recomendadas: neverRecommended || undefined, pagina: page, tam: pageSize, orden: sort },
  }));

export const adminGetUsers = pick('adminGetUsers', ({ q, status } = {}) =>
  http('/admin/usuarios', { query: { buscar: q, estado: status } }));

export const adminSetUserActive = pick('adminSetUserActive', (id, active) =>
  http(`/admin/usuarios/${id}`, { method: 'PATCH', body: { active } }));

export const adminDeleteUser = pick('adminDeleteUser', (id) =>
  http(`/admin/usuarios/${id}`, { method: 'DELETE' }));

export const adminGetUsage = pick('adminGetUsage', ({ days = 30 } = {}) =>
  http('/admin/uso', { query: { dias: days } }));

export { USE_MOCKS };
