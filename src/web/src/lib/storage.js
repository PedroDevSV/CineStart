// localStorage puede no existir o lanzar (modo privado, cookies bloqueadas): siempre con try/catch.
export const storage = {
  get(key, fallback = null) {
    try {
      const raw = window.localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* sin almacenamiento: la sesión vive solo en memoria */
    }
  },
  remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* nada */
    }
  },
};
