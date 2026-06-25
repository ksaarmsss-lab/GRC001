import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);   // user | false | null(loading)
  const [token, setToken] = useState(() => localStorage.getItem("grc_token"));

  const loadMe = useCallback(async () => {
    if (!localStorage.getItem("grc_token")) {
      setUser(false);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      localStorage.removeItem("grc_token");
      setToken(null);
      setUser(false);
    }
  }, []);

  useEffect(() => { loadMe(); }, [loadMe]);

  const login = async (alias, password) => {
    const { data } = await api.post("/auth/login", { alias, password });
    localStorage.setItem("grc_token", data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    localStorage.setItem("grc_token", data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem("grc_token");
    setToken(null);
    setUser(false);
  };

  const value = useMemo(() => ({ user, token, login, register, logout, refresh: loadMe }), [user, token, loadMe]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
