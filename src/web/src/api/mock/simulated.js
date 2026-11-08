/**
 * Actividad SIMULADA para el panel de administración en modo mock
 * (la documentación lo recoge como «datos simulados para las demos del panel»).
 *
 * Genera de forma determinista (semilla fija) unos 140 usuarios de prueba con un
 * gusto por géneros, les hace pasar el onboarding y les sirve recomendaciones con
 * el mismo recomendador del mock. Las aceptaciones dependen de si la película
 * encaja con su gusto, así los KPIs salen coherentes con el motor.
 */
import { onboardingSelection, recommend } from './recommender.js';

const DAY = 86_400_000;
export const SIM_DAYS = 90;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = [
  'cinefilo', 'butaca', 'claqueta', 'fotograma', 'travelling', 'planosecuencia', 'palomitas', 'nocheDeCine',
  'cineforum', 'filmoteca', 'montaje', 'contraplano', 'raccord', 'cameo', 'spoiler', 'tercerActo',
  'fundidoNegro', 'zoom', 'steadicam', 'proyector',
];
const PERSONAS = [
  [878, 28, 12], [18, 10749], [35, 10751, 16], [27, 53, 9648], [80, 53, 18], [18, 36, 10752],
  [16, 10751, 14], [28, 80], [10749, 35], [99, 18], [14, 12], [37, 18],
];

export function buildSimulation(index, now = Date.now()) {
  const rand = rng(20261103);
  const start = now - SIM_DAYS * DAY;
  const users = [];
  const events = { ratings: [], dismissals: [], recs: [] };

  const nUsers = 140;
  for (let i = 0; i < nUsers; i++) {
    // más altas en las últimas semanas: crecimiento suave
    const t = start + Math.pow(rand(), 0.75) * SIM_DAYS * DAY;
    const persona = PERSONAS[Math.floor(rand() * PERSONAS.length)];
    const alias = `${NAMES[Math.floor(rand() * NAMES.length)]}_${10 + Math.floor(rand() * 89)}`;
    const user = {
      id: 1000 + i,
      alias,
      role: 'user',
      active: rand() > 0.04,
      created_at: new Date(t).toISOString(),
      genre_ids: persona.slice(0, 1 + Math.floor(rand() * 2)),
      simulated: true,
      ratings_count: 0,
    };
    users.push(user);
    const lib = { ratings: {}, dismissed: {} };
    const likes = (m) => m.genre_ids.some((g) => persona.includes(g));

    // ~14 % abandona el onboarding
    if (rand() < 0.14) continue;

    const onboarding = onboardingSelection(index, user.genre_ids);
    const nOnb = 3 + Math.floor(rand() * 5);
    let at = t + 60_000;
    for (const m of onboarding.slice(0, nOnb + 4)) {
      if (Object.keys(lib.ratings).length >= nOnb) break;
      if (rand() < 0.3) continue; // «No la he visto»
      const rating = likes(m) ? 4 + Math.round(rand()) : 1 + Math.floor(rand() * 3);
      lib.ratings[m.id] = { rating };
      events.ratings.push({ user_id: user.id, movie_id: m.id, rating, source: 'onboarding', at });
      at += 20_000;
    }

    // 1 a 4 sesiones de recomendaciones
    const sessions = 1 + Math.floor(rand() * 4);
    for (let s = 0; s < sessions; s++) {
      const when = at + 120_000 + s * (DAY * (1 + rand() * 9));
      if (when > now - 600_000) break; // sesiones que aún «no han ocurrido»
      const recs = recommend(index, lib, { n: 10, genreIds: user.genre_ids });
      recs.forEach((m, pos) => events.recs.push({ user_id: user.id, movie_id: m.id, position: pos + 1, at: when }));
      for (const m of recs.slice(0, 4 + Math.floor(rand() * 4))) {
        const p = rand();
        if (likes(m) ? p < 0.55 : p < 0.18) {
          const rating = likes(m) ? (rand() < 0.75 ? 4 + Math.round(rand()) : 3) : 2 + Math.round(rand() * 2);
          lib.ratings[m.id] = { rating };
          events.ratings.push({ user_id: user.id, movie_id: m.id, rating, source: 'recommendation', at: when + 90_000 });
        } else if (p < 0.8) {
          lib.dismissed[m.id] = when;
          events.dismissals.push({ user_id: user.id, movie_id: m.id, at: when + 60_000 });
        }
      }
    }
    user.ratings_count = Object.keys(lib.ratings).length;
  }
  return { users, events, start, now };
}
