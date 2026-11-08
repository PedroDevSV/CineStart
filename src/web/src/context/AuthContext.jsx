import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as api from '../api/index.js';
import { TOKEN_KEY } from '../api/config.js';
import { storage } from '../lib/storage.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | anon | auth

  const refreshUser = useCallback(async () => {
    const me = await api.getMe();
    setUser(me);
    return me;
  }, []);

  useEffect(() => {
    if (!storage.get(TOKEN_KEY)) {
      setStatus('anon');
      return;
    }
    refreshUser()
      .then(() => setStatus('auth'))
      .catch((err) => {
        // Solo se olvida el token si el servidor lo rechaza (no por un fallo de red).
        if (err?.status === 401 || err?.status === 403) storage.remove(TOKEN_KEY);
        setStatus('anon');
      });
  }, [refreshUser]);

  const startSession = useCallback(({ access_token, user: u }) => {
    storage.set(TOKEN_KEY, access_token);
    setUser(u);
    setStatus('auth');
    return u;
  }, []);

  const login = useCallback(async (alias, password) => startSession(await api.login({ alias, password })), [startSession]);
  const register = useCallback(
    async (alias, email, password) => startSession(await api.register({ alias, email, password })),
    [startSession],
  );

  const logout = useCallback(() => {
    storage.remove(TOKEN_KEY);
    setUser(null);
    setStatus('anon');
  }, []);

  useEffect(() => {
    const onUnauthorized = () => logout();
    window.addEventListener('cinestart:unauthorized', onUnauthorized);
    return () => window.removeEventListener('cinestart:unauthorized', onUnauthorized);
  }, [logout]);

  const deleteAccount = useCallback(async () => {
    await api.deleteMe();
    logout();
  }, [logout]);

  const saveGenres = useCallback(async (ids) => {
    const u = await api.saveMyGenres(ids);
    setUser(u);
    return u;
  }, []);

  const value = useMemo(
    () => ({ user, status, isAdmin: user?.role === 'admin', login, register, logout, deleteAccount, refreshUser, saveGenres, setUser }),
    [user, status, login, register, logout, deleteAccount, refreshUser, saveGenres],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
