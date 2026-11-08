/**
 * Recomendador de ejemplo que imita al motor real (especificación §6) para que
 * la web se comporte de forma creíble sin backend:
 *
 *   score = w_c · similitud_con_el_perfil + w_p · nota_ponderada_normalizada
 *           + bonus_cola_larga + bonus_género_favorito
 *   w_c = n / (n + 3)   w_p = 3 / (n + 3)   (n = valoraciones del usuario)
 *
 * La similitud usa los 12 vecinos que trae cada película (calculados con los
 * embeddings reales de features.py). Reglas: fuera lo valorado y lo descartado,
 * máximo 3 películas por género principal y al menos 2 de cola larga en el top-10.
 */
const K = 3;
const LONG_TAIL_BONUS = 0.05;
const GENRE_BONUS = 0.08;
const MAX_PER_GENRE = 3;
const MIN_LONG_TAIL = 2;

export function buildIndex(movies) {
  const byId = new Map(movies.map((m) => [m.id, m]));
  const wr = movies.map((m) => m.weighted_rating ?? 0);
  const lo = Math.min(...wr);
  const hi = Math.max(...wr);
  const wrNorm = new Map(movies.map((m) => [m.id, hi > lo ? ((m.weighted_rating ?? lo) - lo) / (hi - lo) : 0.5]));
  // similitud simétrica por rango de vecino: 1 para el más parecido, decreciente
  const sim = new Map();
  for (const m of movies) {
    (m.similar || []).forEach((otherId, rank) => {
      const s = 1 - rank / ((m.similar.length || 12) + 2);
      for (const [a, b] of [
        [m.id, otherId],
        [otherId, m.id],
      ]) {
        if (!sim.has(a)) sim.set(a, new Map());
        const row = sim.get(a);
        row.set(b, Math.max(row.get(b) ?? 0, s));
      }
    });
  }
  return { movies, byId, wrNorm, sim };
}

/**
 * @param index   resultado de buildIndex
 * @param lib     { ratings: {id: {rating}}, dismissed: {id: ts} }
 * @param options { n, genreIds, longTailOnly }
 */
export function recommend(index, lib, { n = 10, genreIds = [], longTailOnly = false } = {}) {
  const ratings = Object.entries(lib.ratings || {}).map(([id, r]) => [Number(id), r.rating]);
  const dismissed = Object.keys(lib.dismissed || {}).map(Number);
  const seen = new Set([...ratings.map(([id]) => id), ...dismissed]);

  const signals = [...ratings.map(([id, r]) => [id, r - 3]), ...dismissed.map((id) => [id, -1])].filter(
    ([, w]) => w !== 0,
  );
  const totalW = signals.reduce((acc, [, w]) => acc + Math.abs(w), 0) || 1;

  const nRated = ratings.length;
  const wc = nRated / (nRated + K);
  const wp = K / (nRated + K);
  const favGenres = new Set(genreIds);

  const scored = [];
  for (const m of index.movies) {
    if (seen.has(m.id)) continue;
    if (longTailOnly && !m.long_tail) continue;
    let content = 0;
    for (const [id, w] of signals) content += w * (index.sim.get(id)?.get(m.id) ?? 0);
    content /= totalW;
    const pop = index.wrNorm.get(m.id) ?? 0;
    let score = wc * content + wp * pop;
    if (m.long_tail) score += LONG_TAIL_BONUS;
    if (m.genre_ids?.some((g) => favGenres.has(g))) score += GENRE_BONUS;
    scored.push({ movie: m, score, content });
  }
  scored.sort((a, b) => b.score - a.score);

  // reglas de diversidad y visibilidad
  const out = [];
  const perGenre = new Map();
  for (const s of scored) {
    if (out.length >= n) break;
    const g = s.movie.genre_ids?.[0];
    if ((perGenre.get(g) ?? 0) >= MAX_PER_GENRE) continue;
    perGenre.set(g, (perGenre.get(g) ?? 0) + 1);
    out.push(s);
  }
  if (!longTailOnly && n >= 10) {
    const have = out.filter((s) => s.movie.long_tail).length;
    if (have < MIN_LONG_TAIL) {
      const extra = scored.filter((s) => s.movie.long_tail && !out.includes(s)).slice(0, MIN_LONG_TAIL - have);
      for (const e of extra) {
        const idx = out.map((s) => s.movie.long_tail).lastIndexOf(false);
        if (idx >= 0) out.splice(idx, 1, e);
      }
      out.sort((a, b) => b.score - a.score);
    }
  }
  return out.map((s) => ({ ...s.movie, score: Number(s.score.toFixed(4)) }));
}

/** ~20 películas conocidas y variadas: 2 por grupo de K-means, priorizando los géneros elegidos. */
export function onboardingSelection(index, genreIds = [], size = 20) {
  const fav = new Set(genreIds);
  const clusters = new Map();
  for (const m of index.movies) {
    if (m.vote_count < 1200) continue;
    if (!clusters.has(m.cluster_id)) clusters.set(m.cluster_id, []);
    clusters.get(m.cluster_id).push(m);
  }
  const affinity = (list) => (fav.size ? list.filter((m) => m.genre_ids.some((g) => fav.has(g))).length / list.length : 0);
  const ordered = [...clusters.values()]
    .map((list) => list.sort((a, b) => b.weighted_rating - a.weighted_rating))
    .sort((a, b) => affinity(b) - affinity(a));

  const picked = [];
  const perCluster = fav.size ? [3, 3, 2] : [];
  ordered.forEach((list, i) => {
    const take = perCluster[i] ?? 2;
    picked.push(...list.slice(0, take));
  });
  // si faltan, completar con las más votadas
  if (picked.length < size) {
    const rest = index.movies
      .filter((m) => !picked.includes(m))
      .sort((a, b) => b.vote_count - a.vote_count)
      .slice(0, size - picked.length);
    picked.push(...rest);
  }
  // mezcla estable para no agrupar por cluster
  return picked
    .slice(0, size)
    .map((m, i) => ({ m, k: (m.id * 9301 + i * 49297) % 233280 }))
    .sort((a, b) => a.k - b.k)
    .map(({ m }) => m);
}
