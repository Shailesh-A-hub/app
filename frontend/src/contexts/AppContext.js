import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('dpdp_token') || '');
  const [sessionId, setSessionId] = useState(localStorage.getItem('dpdp_session') || '');
  const [adminEmail, setAdminEmail] = useState(localStorage.getItem('dpdp_email') || '');
  const [breachState, setBreachState] = useState({ active: false });
  const [theme, setTheme] = useState(localStorage.getItem('dpdp_theme') || 'dark');

  const isAuthenticated = !!token;

  const authHeaders = useCallback(() => ({
    headers: { Authorization: `Bearer ${token}` }
  }), [token]);

  const login = async (email, password) => {
    const res = await axios.post(`${API}/auth/login`, { email, password });
    const { token: t, session_id, email: e } = res.data;
    setToken(t);
    setSessionId(session_id);
    setAdminEmail(e);
    localStorage.setItem('dpdp_token', t);
    localStorage.setItem('dpdp_session', session_id);
    localStorage.setItem('dpdp_email', e);
    return res.data;
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, { session_id: sessionId });
    } catch {}
    setToken('');
    setSessionId('');
    setAdminEmail('');
    localStorage.removeItem('dpdp_token');
    localStorage.removeItem('dpdp_session');
    localStorage.removeItem('dpdp_email');
  };

  const fetchBreachStatus = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API}/breach/status`, authHeaders());
      setBreachState(res.data);
    } catch {}
  }, [token, authHeaders]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('dpdp_theme', next);
    if (next === 'dark') {
      document.body.classList.remove('light');
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
      document.body.classList.add('light');
    }
  };

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light');
      document.body.classList.remove('dark');
    } else {
      document.body.classList.add('dark');
      document.body.classList.remove('light');
    }
  }, [theme]);

  useEffect(() => {
    if (token) fetchBreachStatus();
  }, [token, fetchBreachStatus]);

  // Poll breach status
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(fetchBreachStatus, breachState.active ? 2000 : 10000);
    return () => clearInterval(interval);
  }, [token, breachState.active, fetchBreachStatus]);

  return (
    <AppContext.Provider value={{
      token, isAuthenticated, adminEmail, sessionId, breachState,
      theme, toggleTheme, login, logout, authHeaders, fetchBreachStatus,
      API, setBreachState,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}
