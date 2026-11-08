/**
 * Biblioteca del usuario: valoraciones, descartes y Mi lista.
 * Las acciones son optimistas (la interfaz responde al momento) y se deshacen
 * si la API falla. `version` cambia con cada valoración o descarte para que
 * las pantallas pidan recomendaciones nuevas (la lista «se recalcula»).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as api from '../api/index.js';
import { useAuth } from './AuthContext.jsx';
import { useToast } from './ToastContext.jsx';

const LibraryContext = createContext(null);

export function LibraryProvider({ children }) {
  const { status, user, setUser } = useAuth();
  const toast = useToast();
  const [ratings, setRatings] = useState(() => new Map()); // movieId -> { rating, source, created_at }
  const [dismissed, setDismissed] = useState(() => new Set());
  const [list, setList] = useState(() => new Map()); // movieId -> added_at
  const [loaded, setLoaded] = useState(false);
  const [version, setVersion] = useState(0);
  const movies = useRef(new Map()); // caché de películas vistas en pantalla

  useEffect(() => {
    if (status !== 'auth') {
      setRatings(new Map());
      setDismissed(new Set());
      setList(new Map());
      setLoaded(false);
      return;
    }
    let alive = true;
    api
      .getLibrary()
      .then((lib) => {
        if (!alive) return;
        setRatings(new Map(lib.ratings.map((r) => [r.movie_id, r])));
        setDismissed(new Set(lib.dismissed));
        setList(new Map(lib.list.map((l) => [l.movie_id, l.added_at])));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      alive = false;
    };
  }, [status, user?.id]);

  const remember = useCallback((movie) => {
    if (movie?.id) movies.current.set(movie.id, movie);
  }, []);

  const fail = useCallback((err) => toast.show(err.message || 'Algo ha fallado. Inténtalo de nuevo.', { tone: 'error' }), [toast]);

  const syncOnboarded = useCallback(
    (count) => {
      if (user && !user.onboarded && count >= 3) setUser({ ...user, onboarded: true, ratings_count: count });
      else if (user) setUser({ ...user, ratings_count: count });
    },
    [user, setUser],
  );

  const rate = useCallback(
    async (movie, value, source = 'recommendation') => {
      remember(movie);
      const prev = ratings.get(movie.id);
      const wasDismissed = dismissed.has(movie.id);
      const next = new Map(ratings);
      next.set(movie.id, { movie_id: movie.id, rating: value, source: prev?.source ?? source, created_at: prev?.created_at ?? new Date().toISOString() });
      setRatings(next);
      if (wasDismissed) setDismissed((d) => new Set([...d].filter((x) => x !== movie.id)));
      try {
        await api.rateMovie(movie.id, value, source);
        setVersion((v) => v + 1);
        syncOnboarded(next.size);
      } catch (err) {
        setRatings(ratings);
        fail(err);
      }
    },
    [ratings, dismissed, remember, fail, syncOnboarded],
  );

  const removeRating = useCallback(
    async (movie) => {
      const prev = ratings;
      const next = new Map(ratings);
      next.delete(movie.id);
      setRatings(next);
      try {
        await api.deleteRating(movie.id);
        setVersion((v) => v + 1);
        syncOnboarded(next.size);
      } catch (err) {
        setRatings(prev);
        fail(err);
      }
    },
    [ratings, fail, syncOnboarded],
  );

  const undismiss = useCallback(
    async (movie) => {
      setDismissed((d) => new Set([...d].filter((x) => x !== movie.id)));
      try {
        await api.undismissMovie(movie.id);
        setVersion((v) => v + 1);
      } catch (err) {
        fail(err);
      }
    },
    [fail],
  );

  const dismiss = useCallback(
    async (movie, { silent = false } = {}) => {
      remember(movie);
      setDismissed((d) => new Set(d).add(movie.id));
      try {
        await api.dismissMovie(movie.id);
        setVersion((v) => v + 1);
        if (!silent)
          toast.show(`«${movie.title}» no volverá a aparecer en tus recomendaciones.`, {
            action: { label: 'Deshacer', onClick: () => undismiss(movie) },
          });
      } catch (err) {
        setDismissed((d) => new Set([...d].filter((x) => x !== movie.id)));
        fail(err);
      }
    },
    [remember, toast, undismiss, fail],
  );

  const toggleList = useCallback(
    async (movie) => {
      remember(movie);
      const inList = list.has(movie.id);
      const prev = list;
      const next = new Map(list);
      if (inList) next.delete(movie.id);
      else next.set(movie.id, new Date().toISOString());
      setList(next);
      try {
        if (inList) await api.removeFromList(movie.id);
        else await api.addToList(movie.id);
        toast.show(inList ? `Quitada de Mi lista: «${movie.title}»` : `Añadida a Mi lista: «${movie.title}»`, {
          tone: inList ? 'default' : 'success',
          action: { label: 'Deshacer', onClick: () => toggleListRef.current(movie) },
        });
      } catch (err) {
        setList(prev);
        fail(err);
      }
    },
    [list, remember, toast, fail],
  );
  const toggleListRef = useRef(toggleList);
  toggleListRef.current = toggleList;

  const value = useMemo(
    () => ({
      loaded,
      version,
      ratings,
      dismissed,
      list,
      movieCache: movies.current,
      remember,
      rate,
      removeRating,
      dismiss,
      undismiss,
      toggleList,
      ratingOf: (id) => ratings.get(id)?.rating ?? 0,
      inList: (id) => list.has(id),
      isDismissed: (id) => dismissed.has(id),
    }),
    [loaded, version, ratings, dismissed, list, remember, rate, removeRating, dismiss, undismiss, toggleList],
  );
  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export const useLibrary = () => useContext(LibraryContext);
