import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setAuthToken, setOnUnauthorized } from './api.js';

const AuthContext = createContext(null);
const STORAGE_KEY = 'nexpro_token';

function readStoredToken() {
  try {
    return localStorage.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

function storeToken(token) {
  try {
    if (token) localStorage.setItem(STORAGE_KEY, token);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* almacenamiento no disponible (modo privado, etc.) */
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const clear = useCallback(() => {
    setAuthToken(null);
    storeToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => clear());
    const token = readStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setAuthToken(token);
    api
      .get('/auth/me')
      .then((u) => setUser(u))
      .catch(() => clear())
      .finally(() => setLoading(false));
  }, [clear]);

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    setAuthToken(res.token);
    storeToken(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const acceptInvite = useCallback(async (token, password) => {
    const res = await api.post('/auth/accept-invite', { token, password });
    setAuthToken(res.token);
    storeToken(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(() => clear(), [clear]);

  const changePassword = useCallback(
    (currentPassword, newPassword) => api.post('/auth/change-password', { currentPassword, newPassword }),
    []
  );

  const isAdmin = user?.role === 'admin';
  const canEdit = useCallback(
    (moduleKey) => {
      if (!user) return false;
      if (user.role === 'admin') return true;
      return !!user.permissions?.[moduleKey];
    },
    [user]
  );

  const value = useMemo(
    () => ({ user, loading, isAdmin, canEdit, login, acceptInvite, logout, changePassword }),
    [user, loading, isAdmin, canEdit, login, acceptInvite, logout, changePassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
