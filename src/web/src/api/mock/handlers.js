/**
 * Backend simulado en el navegador (VITE_USE_MOCKS=true).
 *
 * Imita las respuestas de la API FastAPI descrita en el README para que la web
 * funcione completa sin servidor. Guarda usuarios y valoraciones en localStorage
 * del navegador. NO es seguridad real: el backend usa bcrypt + JWT.
 *
 * Usuarios de prueba:
 *   demo  / demo1234   usuario con onboarding hecho
 *   admin / admin1234  administrador
 */
import { ApiError } from '../http.js';
import { TOKEN_KEY } from '../config.js';
import { storage } from '../../lib/storage.js';
import { normalize } from '../../lib/text.js';
import catalogData from './data/catalog.json';
import { buildIndex, onboardingSelection, recommend } from './recommender.js';
import { TMDB_EXTERNAL } from './tmdbExternal.js';
import { SIM_DAYS, buildSimulation } from './simulated.js';

const DB_KEY = 'cinestart.mock.v2';
const DAY = 86_400_000;
const MODEL_VERSION = 'content-v1.0-mock';

/* ------------------------------------------------------------------ catálogo */
const baseMovies = catalogData.movies.map((m) => ({ ...m, source: 'catalog' }));
const genres = Object.entries(catalogData.genres)
  .map(([id, name]) => ({ id: Number(id), name }))
  .sort((a, b) => a.name.localeCompare(b.name));
const medianWr = [...baseMovies].map((m) => m.weighted_rating).sort((a, b) => a - b)[Math.floor(baseMovies.length / 2)];

let index = null;
function getIndex() {
  if (!index) index = buildIndex([...baseMovies, ...db().extraMovies]);
  return index;
}

/* ------------------------------------------------------------------ almacén */
const DEMO_RATINGS = { 27205: 5, 152601: 5, 244786: 4, 807: 4, 118340: 2 };
const DEMO_LIST = [77, 78, 238];

function seed() {
  const now = Date.now();
  const iso = (d) => new Date(now - d * DAY).toISOString();
  return {
    nextId: 3,
    users: [
      { id: 1, alias: 'admin', email: 'admin@cinestart.dev', pwd: 'mock:admin1234', role: 'admin', active: true, genre_ids: [], created_at: iso(60) },
      { id: 2, alias: 'demo', email: 'demo@cinestart.dev', pwd: 'mock:demo1234', role: 'user', active: true, genre_ids: [878, 53], created_at: iso(12) },
    ],
    lib: {
      1: { ratings: {}, dismissed: {}, list: {} },
      2: {
        ratings: Object.fromEntries(
          Object.entries(DEMO_RATINGS).map(([id, rating], i) => [id, { rating, source: 'onboarding', created_at: iso(12 - i * 0.01) }]),
        ),
        dismissed: {},
        list: Object.fromEntries(DEMO_LIST.map((id, i) => [id, iso(5 - i)])),
      },
    },
    sessions: {},
    recLog: [],
    extraMovies: [],
    overrides: {},
  };
}

let memDb = null;
function db() {
  if (!memDb) memDb = storage.get(DB_KEY) || seed();
  return memDb;
}
function save() {
  storage.set(DB_KEY, memDb);
}

/* ------------------------------------------------------------------ utilidades */
const wait = (ms = 180 + Math.random() * 220) => new Promise((r) => setTimeout(r, ms));
const clone = (x) => (x === undefined ? x : JSON.parse(JSON.stringify(x)));

async function hashPassword(pw) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`cinestart:${pw}`));
    return 'sha256:' + [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return `mock:${pw}`;
  }
}
async function checkPassword(user, pw) {
  if (user.pwd.startsWith('mock:')) return user.pwd === `mock:${pw}`;
  return user.pwd === (await hashPassword(pw));
}

function publicUser(u) {
  const lib = db().lib[u.id];
  const n = lib ? Object.keys(lib.ratings).length : 0;
  return {
    id: u.id,
    alias: u.alias,
    email: u.email,
    role: u.role,
    genre_ids: u.genre_ids,
    created_at: u.created_at,
    onboarded: u.role === 'admin' || n >= 3,
    ratings_count: n,
  };
}

function currentUser() {
  const token = storage.get(TOKEN_KEY);
  const userId = token ? db().sessions[token] : null;
  const user = db().users.find((u) => u.id === userId);
  if (!user) throw new ApiError(401, 'Tu sesión ha caducado. Vuelve a entrar.');
  if (!user.active) throw new ApiError(403, 'Esta cuenta está desactivada.');
  return user;
}
function currentLib() {
  const u = currentUser();
  const d = db();
  d.lib[u.id] ??= { ratings: {}, dismissed: {}, list: {} };
  return { user: u, lib: d.lib[u.id] };
}
function requireAdmin() {
  const u = currentUser();
  if (u.role !== 'admin') throw new ApiError(403, 'Solo para administradores.');
  return u;
}
function issueToken(user) {
  const token = `mock.${user.id}.${Math.random().toString(36).slice(2)}`;
  db().sessions[token] = user.id;
  save();
  return token;
}
const movie = (id) => getIndex().byId.get(Number(id));
/** Película del catálogo; si llega del buscador desde TMDB, se incorpora al catálogo primero. */
const ensureMovie = (id) => {
  const m = movie(id);
  if (m) return m;
  const ext = TMDB_EXTERNAL.find((x) => x.id === Number(id));
  return ext ? addExternalToCatalog(ext) : null;
};
const strip = ({ similar, score, ...m }) => m;

/* ------------------------------------------------------------------ auth */
export async function login({ alias, password }) {
  await wait();
  const user = db().users.find((u) => u.alias.toLowerCase() === String(alias).trim().toLowerCase());
  if (!user || !(await checkPassword(user, password))) throw new ApiError(401, 'Alias o contraseña incorrectos.');
  if (!user.active) throw new ApiError(403, 'Esta cuenta está desactivada. Contacta con el administrador.');
  return { access_token: issueToken(user), token_type: 'bearer', user: publicUser(user) };
}

export async function register({ alias, email, password }) {
  await wait();
  alias = String(alias || '').trim();
  const errors = [];
  if (!/^[A-Za-z0-9_.-]{3,30}$/.test(alias)) errors.push({ loc: ['body', 'alias'], msg: 'El alias debe tener entre 3 y 30 caracteres: letras, números, punto, guion o guion bajo.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''))) errors.push({ loc: ['body', 'email'], msg: 'Introduce un email válido.' });
  if (String(password || '').length < 8) errors.push({ loc: ['body', 'password'], msg: 'La contraseña debe tener al menos 8 caracteres.' });
  if (errors.length) throw new ApiError(422, errors.map((e) => e.msg).join(' · '), errors);
  const d = db();
  if (d.users.some((u) => u.alias.toLowerCase() === alias.toLowerCase())) {
    throw new ApiError(409, 'Ese alias ya está en uso. Prueba con otro.', [{ loc: ['body', 'alias'], msg: 'Ese alias ya está en uso.' }]);
  }
  const user = {
    id: d.nextId++,
    alias,
    email: String(email).trim(),
    pwd: await hashPassword(password),
    role: 'user',
    active: true,
    genre_ids: [],
    created_at: new Date().toISOString(),
  };
  d.users.push(user);
  d.lib[user.id] = { ratings: {}, dismissed: {}, list: {} };
  save();
  return { access_token: issueToken(user), token_type: 'bearer', user: publicUser(user) };
}

export async function getMe() {
  await wait(120);
  return publicUser(currentUser());
}

export async function deleteMe() {
  await wait();
  const u = currentUser();
  const d = db();
  d.users = d.users.filter((x) => x.id !== u.id);
  delete d.lib[u.id];
  d.recLog = d.recLog.filter((r) => r.user_id !== u.id);
  Object.keys(d.sessions).forEach((t) => d.sessions[t] === u.id && delete d.sessions[t]);
  save();
  return null;
}

export async function saveMyGenres(genreIds) {
  await wait(150);
  const u = currentUser();
  u.genre_ids = [...new Set(genreIds.map(Number))].slice(0, 3);
  save();
  return publicUser(u);
}

/* ------------------------------------------------------------------ catálogo */
export async function getGenres() {
  await wait(100);
  return clone(genres);
}

export async function getOnboardingMovies({ genreIds = [] } = {}) {
  await wait();
  return onboardingSelection(getIndex(), genreIds).map(strip);
}

export async function getMovie(id) {
  await wait();
  id = Number(id);
  // Si llega del buscador desde TMDB, se guarda en el catálogo (HU-06)
  const m = ensureMovie(id);
  if (!m) throw new ApiError(404, 'No hemos encontrado esa película.');
  const similar = (m.similar || []).map(movie).filter(Boolean).map(strip);
  return { ...strip(m), similar };
}

function addExternalToCatalog(ext) {
  const d = db();
  if (!d.extraMovies.some((x) => x.id === ext.id)) {
    const g = new Set(ext.genre_ids);
    const similar = baseMovies
      .map((m) => {
        const inter = m.genre_ids.filter((x) => g.has(x)).length;
        const jac = inter / (new Set([...m.genre_ids, ...ext.genre_ids]).size || 1);
        const dir = m.director && ext.director.includes(m.director) ? 0.6 : 0;
        return { id: m.id, s: jac + dir + m.weighted_rating / 50 };
      })
      .sort((a, b) => b.s - a.s)
      .slice(0, 12)
      .map((x) => x.id);
    d.extraMovies.push({ ...ext, source: 'catalog', added_from_tmdb: true, weighted_rating: medianWr, similar });
    save();
    index = null; // reconstruir con la película nueva
  }
  return movie(ext.id);
}

export async function searchMovies(q) {
  await wait(160);
  const nq = normalize(q);
  if (nq.length < 2) return { catalog: [], tmdb: [] };
  const scored = [];
  for (const m of getIndex().movies) {
    const t = normalize(m.title);
    const o = normalize(m.original_title || '');
    let s = 0;
    if (t === nq || o === nq) s = 100;
    else if (t.startsWith(nq)) s = 60;
    else if (t.includes(nq) || o.includes(nq)) s = 40;
    else if (normalize(m.director || '').includes(nq)) s = 25;
    else if (m.cast.some((c) => normalize(c).includes(nq))) s = 15;
    if (s) scored.push({ m, s: s + m.weighted_rating / 10 });
  }
  scored.sort((a, b) => b.s - a.s);
  const catalog = scored.slice(0, 30).map((x) => strip(x.m));
  const exact = scored.some((x) => x.s >= 100);
  const inCatalog = new Set(getIndex().movies.map((m) => m.id));
  const tmdb = exact
    ? []
    : TMDB_EXTERNAL.filter(
        (m) =>
          !inCatalog.has(m.id) &&
          (normalize(m.title).includes(nq) || normalize(m.original_title || '').includes(nq) || normalize(m.director).includes(nq)),
      ).map(strip);
  return { catalog, tmdb };
}

export async function getTopRated({ genreId, limit = 20 } = {}) {
  await wait();
  return getIndex()
    .movies.filter((m) => !genreId || m.genre_ids.includes(Number(genreId)))
    .sort((a, b) => b.weighted_rating - a.weighted_rating)
    .slice(0, limit)
    .map(strip);
}

export async function getMoviesByIds(ids) {
  await wait(140);
  return ids.map(ensureMovie).filter(Boolean).map(strip);
}

/* ------------------------------------------------------------------ recomendaciones */
export async function getRecommendations({ n = 10, longTail = false } = {}) {
  await wait(260 + Math.random() * 200);
  const { user, lib } = currentLib();
  const items = recommend(getIndex(), lib, { n, genreIds: user.genre_ids, longTailOnly: longTail }).map(strip);
  const now = new Date().toISOString();
  const d = db();
  items.forEach((m, i) => d.recLog.push({ user_id: user.id, movie_id: m.id, position: i + 1, at: Date.now() }));
  if (d.recLog.length > 3000) d.recLog = d.recLog.slice(-3000);
  save();
  return { items, model_version: MODEL_VERSION, generated_at: now };
}

/* ------------------------------------------------------------------ biblioteca */
export async function getLibrary() {
  await wait(150);
  const { lib } = currentLib();
  return {
    ratings: Object.entries(lib.ratings).map(([id, r]) => ({ movie_id: Number(id), ...r })),
    dismissed: Object.keys(lib.dismissed).map(Number),
    list: Object.entries(lib.list).map(([id, at]) => ({ movie_id: Number(id), added_at: at })),
  };
}

export async function rateMovie(movieId, rating, source = 'recommendation') {
  await wait(120);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new ApiError(422, 'La valoración debe estar entre 1 y 5.');
  if (!ensureMovie(movieId)) throw new ApiError(404, 'Película no encontrada.');
  const { lib } = currentLib();
  const prev = lib.ratings[movieId];
  lib.ratings[movieId] = { rating, source: prev?.source ?? source, created_at: prev?.created_at ?? new Date().toISOString() };
  delete lib.dismissed[movieId];
  save();
  return { movie_id: Number(movieId), ...lib.ratings[movieId] };
}

export async function deleteRating(movieId) {
  await wait(120);
  const { lib } = currentLib();
  delete lib.ratings[movieId];
  save();
  return null;
}

export async function dismissMovie(movieId) {
  await wait(120);
  const { lib } = currentLib();
  lib.dismissed[movieId] = new Date().toISOString();
  save();
  return null;
}

export async function undismissMovie(movieId) {
  await wait(120);
  const { lib } = currentLib();
  delete lib.dismissed[movieId];
  save();
  return null;
}

export async function addToList(movieId) {
  await wait(110);
  if (!ensureMovie(movieId)) throw new ApiError(404, 'Película no encontrada.');
  const { lib } = currentLib();
  lib.list[movieId] ??= new Date().toISOString();
  save();
  return null;
}

export async function removeFromList(movieId) {
  await wait(110);
  const { lib } = currentLib();
  delete lib.list[movieId];
  save();
  return null;
}

/* ------------------------------------------------------------------ administración */
let sim = null;
function getSim() {
  if (!sim) sim = buildSimulation(buildIndex(baseMovies));
  return sim;
}

/** Eventos simulados + los reales de esta sesión del navegador. */
function allEvents() {
  const s = getSim();
  const d = db();
  const ratings = [...s.events.ratings];
  const dismissals = [...s.events.dismissals];
  for (const [uid, lib] of Object.entries(d.lib)) {
    for (const [mid, r] of Object.entries(lib.ratings)) {
      ratings.push({ user_id: Number(uid), movie_id: Number(mid), rating: r.rating, source: r.source, at: Date.parse(r.created_at) });
    }
    for (const [mid, at] of Object.entries(lib.dismissed)) {
      dismissals.push({ user_id: Number(uid), movie_id: Number(mid), at: Date.parse(at) });
    }
  }
  return { ratings, dismissals, recs: [...s.events.recs, ...d.recLog] };
}

function allUsers() {
  const d = db();
  const s = getSim();
  const real = d.users.map((u) => ({ ...publicUser(u), active: u.active, simulated: false }));
  const simulated = s.users
    .filter((u) => !d.overrides[u.id]?.deleted)
    .map((u) => ({ ...u, active: d.overrides[u.id]?.active ?? u.active }));
  return [...real, ...simulated];
}

function bucketer(days, now) {
  const size = days <= 31 ? DAY : 7 * DAY;
  const start = now - days * DAY;
  const n = Math.ceil((days * DAY) / size);
  const fmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
  const labels = Array.from({ length: n }, (_, i) => fmt.format(new Date(start + i * size)));
  return { start, n, labels, idx: (t) => Math.min(n - 1, Math.floor((t - start) / size)) };
}

const jaccard = (a, b) => {
  const A = new Set(a);
  const inter = b.filter((x) => A.has(x)).length;
  return inter / (new Set([...a, ...b]).size || 1);
};

function kpisFor(from, to, ev, idx) {
  const recs = ev.recs.filter((r) => r.at >= from && r.at < to);
  if (!recs.length) return null;
  const distinct = new Set(recs.map((r) => r.movie_id));
  const lists = new Map();
  for (const r of recs) {
    const k = `${r.user_id}|${Math.floor(r.at / 60000)}`;
    if (!lists.has(k)) lists.set(k, []);
    lists.get(k).push(r.movie_id);
  }
  let divSum = 0;
  let divN = 0;
  for (const ids of lists.values()) {
    const ms = ids.map((id) => idx.byId.get(id)).filter(Boolean);
    let s = 0;
    let p = 0;
    for (let i = 0; i < ms.length; i++)
      for (let j = i + 1; j < ms.length; j++) {
        s += jaccard(ms[i].genre_ids, ms[j].genre_ids);
        p++;
      }
    if (p) {
      divSum += 1 - s / p;
      divN++;
    }
  }
  const lt = recs.filter((r) => idx.byId.get(r.movie_id)?.long_tail).length;
  const recRatings = ev.ratings.filter((r) => r.source === 'recommendation' && r.at >= from && r.at < to);
  const dis = ev.dismissals.filter((r) => r.at >= from && r.at < to);
  const pos = recRatings.filter((r) => r.rating >= 4).length;
  return {
    coverage: distinct.size / idx.movies.length,
    diversity: divN ? divSum / divN : 0,
    novelty: lt / recs.length,
    acceptance: recRatings.length + dis.length ? pos / (recRatings.length + dis.length) : 0,
    recs: recs.length,
  };
}

export async function adminGetKpis({ days = 30 } = {}) {
  await wait(300);
  requireAdmin();
  const idx = getIndex();
  const ev = allEvents();
  const now = Date.now();
  const from = now - days * DAY;
  const cur = kpisFor(from, now + 1, ev, idx) ?? { coverage: 0, diversity: 0, novelty: 0, acceptance: 0, recs: 0 };
  const prev = days * 2 <= SIM_DAYS ? kpisFor(from - days * DAY, from, ev, idx) : null;

  const b = bucketer(days, now);
  const acc = Array.from({ length: b.n }, () => ({ pos: 0, tot: 0 }));
  ev.ratings.filter((r) => r.source === 'recommendation' && r.at >= from).forEach((r) => {
    const a = acc[b.idx(r.at)];
    a.tot++;
    if (r.rating >= 4) a.pos++;
  });
  ev.dismissals.filter((r) => r.at >= from).forEach((r) => acc[b.idx(r.at)].tot++);

  const recsWin = ev.recs.filter((r) => r.at >= from);
  const byGenre = new Map();
  const byCluster = new Map();
  const times = new Map();
  for (const r of recsWin) {
    const m = idx.byId.get(r.movie_id);
    if (!m) continue;
    const g = m.genre_ids[0];
    byGenre.set(g, (byGenre.get(g) ?? 0) + 1);
    if (m.cluster_id !== null) byCluster.set(m.cluster_id, (byCluster.get(m.cluster_id) ?? 0) + 1);
    times.set(m.id, (times.get(m.id) ?? 0) + 1);
  }
  const catByCluster = new Map();
  idx.movies.forEach((m) => m.cluster_id !== null && catByCluster.set(m.cluster_id, (catByCluster.get(m.cluster_id) ?? 0) + 1));
  const clusters = [...catByCluster.keys()].sort((a, b) => a - b).map((c) => ({
    cluster: `G${c}`,
    catalog: (catByCluster.get(c) ?? 0) / idx.movies.length,
    recommended: recsWin.length ? (byCluster.get(c) ?? 0) / recsWin.length : 0,
  }));

  return {
    period_days: days,
    model_version: MODEL_VERSION,
    simulated: true,
    kpis: {
      coverage: { value: cur.coverage, previous: prev?.coverage ?? null },
      diversity: { value: cur.diversity, previous: prev?.diversity ?? null },
      novelty: { value: cur.novelty, previous: prev?.novelty ?? null },
      acceptance: { value: cur.acceptance, previous: prev?.acceptance ?? null },
    },
    recommendations_served: cur.recs,
    acceptance_series: b.labels.map((label, i) => ({ label, value: acc[i].tot ? acc[i].pos / acc[i].tot : null, n: acc[i].tot })),
    recs_by_genre: [...byGenre.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([genre_id, count]) => ({ genre_id, count })),
    clusters,
    top_recommended: [...times.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id, count]) => ({ ...strip(idx.byId.get(id)), times_recommended: count })),
    ratings_distribution: [1, 2, 3, 4, 5].map((stars) => ({
      stars,
      count: ev.ratings.filter((r) => r.source === 'recommendation' && r.at >= from && r.rating === stars).length,
    })),
    never_recommended: idx.movies.length - times.size,
    catalog_size: idx.movies.length,
  };
}

export async function adminGetMovies({ q, neverRecommended, page = 1, pageSize = 20, sort = 'recommended' } = {}) {
  await wait(220);
  requireAdmin();
  const idx = getIndex();
  const ev = allEvents();
  const times = new Map();
  ev.recs.forEach((r) => times.set(r.movie_id, (times.get(r.movie_id) ?? 0) + 1));
  const rsum = new Map();
  ev.ratings.forEach((r) => {
    const x = rsum.get(r.movie_id) ?? { s: 0, n: 0 };
    x.s += r.rating;
    x.n++;
    rsum.set(r.movie_id, x);
  });
  const nq = normalize(q || '');
  let items = idx.movies
    .filter((m) => !nq || normalize(m.title).includes(nq) || normalize(m.director || '').includes(nq))
    .map((m) => {
      const r = rsum.get(m.id);
      return {
        ...strip(m),
        times_recommended: times.get(m.id) ?? 0,
        app_rating: r ? r.s / r.n : null,
        app_ratings_count: r?.n ?? 0,
      };
    });
  if (neverRecommended) items = items.filter((m) => m.times_recommended === 0);
  const sorters = {
    recommended: (a, b) => b.times_recommended - a.times_recommended,
    rating: (a, b) => (b.weighted_rating ?? 0) - (a.weighted_rating ?? 0),
    votes: (a, b) => (b.vote_count ?? 0) - (a.vote_count ?? 0),
    title: (a, b) => a.title.localeCompare(b.title),
  };
  items.sort(sorters[sort] ?? sorters.recommended);
  const total = items.length;
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total, page, page_size: pageSize };
}

export async function adminGetUsers({ q, status } = {}) {
  await wait(220);
  requireAdmin();
  const nq = normalize(q || '');
  return allUsers()
    .filter((u) => !nq || normalize(u.alias).includes(nq))
    .filter((u) => !status || (status === 'active' ? u.active : !u.active))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .map((u) => ({ id: u.id, alias: u.alias, role: u.role, active: u.active, created_at: u.created_at, ratings_count: u.ratings_count, simulated: !!u.simulated }));
}

export async function adminSetUserActive(id, active) {
  await wait(160);
  const me = requireAdmin();
  if (id === me.id) throw new ApiError(400, 'No puedes desactivar tu propia cuenta.');
  const d = db();
  const real = d.users.find((u) => u.id === id);
  if (real) real.active = active;
  else d.overrides[id] = { ...d.overrides[id], active };
  save();
  return null;
}

export async function adminDeleteUser(id) {
  await wait(200);
  const me = requireAdmin();
  if (id === me.id) throw new ApiError(400, 'No puedes borrar tu propia cuenta desde el panel.');
  const d = db();
  if (d.users.some((u) => u.id === id)) {
    d.users = d.users.filter((u) => u.id !== id);
    delete d.lib[id];
  } else d.overrides[id] = { ...d.overrides[id], deleted: true };
  save();
  return null;
}

export async function adminGetUsage({ days = 30 } = {}) {
  await wait(260);
  requireAdmin();
  const now = Date.now();
  const from = now - days * DAY;
  const b = bucketer(days, now);
  const ev = allEvents();
  const users = allUsers().filter((u) => u.role !== 'admin');
  const series = b.labels.map((label) => ({ label, registrations: 0, ratings: 0, dismissals: 0 }));
  const newUsers = users.filter((u) => Date.parse(u.created_at) >= from);
  newUsers.forEach((u) => series[b.idx(Date.parse(u.created_at))].registrations++);
  ev.ratings.filter((r) => r.at >= from).forEach((r) => series[b.idx(r.at)].ratings++);
  ev.dismissals.filter((r) => r.at >= from).forEach((r) => series[b.idx(r.at)].dismissals++);

  const ratingsByUser = new Map();
  ev.ratings.forEach((r) => ratingsByUser.set(r.user_id, (ratingsByUser.get(r.user_id) ?? 0) + 1));
  const recUsers = new Set(ev.recs.map((r) => r.user_id));
  const recRaters = new Set(ev.ratings.filter((r) => r.source === 'recommendation').map((r) => r.user_id));
  const onboarded = newUsers.filter((u) => (ratingsByUser.get(u.id) ?? 0) >= 3);

  return {
    period_days: days,
    simulated: true,
    totals: {
      registrations: newUsers.length,
      ratings: series.reduce((a, s) => a + s.ratings, 0),
      dismissals: series.reduce((a, s) => a + s.dismissals, 0),
      active_users: users.filter((u) => u.active).length,
    },
    onboarding_completion: newUsers.length ? onboarded.length / newUsers.length : 0,
    funnel: [
      { step: 'Registrados', value: newUsers.length },
      { step: 'Onboarding completo', value: onboarded.length },
      { step: 'Recibieron recomendaciones', value: newUsers.filter((u) => recUsers.has(u.id)).length },
      { step: 'Valoraron una recomendación', value: newUsers.filter((u) => recRaters.has(u.id)).length },
    ],
    series,
  };
}
