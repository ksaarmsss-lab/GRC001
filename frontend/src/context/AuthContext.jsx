import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(null);

const clearAuthStorage = () => {
  // Purge every plausible auth artefact — token, any legacy keys, and
  // sessionStorage for good measure. Language pref is kept intentionally.
  try {
    localStorage.removeItem("grc_token");
    localStorage.removeItem("grc_user");
    sessionStorage.clear();
  } catch (e) {
    console.error("clearAuthStorage failed:", e);
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // user | false | null(loading)
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
      clearAuthStorage();
      setToken(null);
      setUser(false);
    }
  }, []);

  useEffect(() => { loadMe(); }, [loadMe]);

  const login = useCallback(async (alias, password) => {
    const { data } = await api.post("/auth/login", { alias, password });
    localStorage.setItem("grc_token", data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    localStorage.setItem("grc_token", data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    // 1) Ask the server to bump token_version so this JWT (and any copies)
    //    stops working immediately for all future requests.
    try { await api.post("/auth/logout"); }
    catch (e) { console.warn("server logout failed (proceeding with client cleanup):", e?.message); }
    // 2) Wipe all client-side auth storage.
    clearAuthStorage();
    setToken(null);
    setUser(false);
    // 3) Hard reload to the login page. This purges every piece of in-memory
    //    React state (cached chats, mail, directory, WS connection) so a
    //    subsequent browser user can never see the previous user's data —
    //    even via the browser Back button or React Router history.
    window.location.replace("/login");
  }, []);

  const value = useMemo(
    () => ({ user, token, login, register, logout, refresh: loadMe }),
    [user, token, login, register, logout, loadMe],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
