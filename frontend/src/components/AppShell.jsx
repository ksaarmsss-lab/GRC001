import { NavLink, Outlet } from "react-router-dom";
import { MessagesSquare, Mail, Users, User, ShieldCheck, LogOut, Languages, BadgeCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import { useEffect, useMemo, useRef, useState } from "react";
import { BACKEND_URL } from "@/lib/api";

export default function AppShell() {
  const { user, logout, token } = useAuth();
  const { t, lang, toggle } = useLang();
  const [online, setOnline] = useState([]);
  const wsRef = useRef(null);
  const outletCtx = useMemo(() => ({ online }), [online]);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    let reconnectTimer = null;
    let attempts = 0;

    const proto = BACKEND_URL.startsWith("https") ? "wss" : "ws";
    const host = BACKEND_URL.replace(/^https?:\/\//, "");
    const url = `${proto}://${host}/api/ws?token=${encodeURIComponent(token)}`;

    const connect = () => {
      if (cancelled) return;
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => { attempts = 0; };
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "online") setOnline(msg.data || []);
          window.dispatchEvent(new CustomEvent("grc:ws", { detail: msg }));
        } catch (err) { console.error("ws parse failed:", err); }
      };
      const scheduleReconnect = () => {
        if (cancelled) return;
        attempts += 1;
        const delay = Math.min(30000, 1000 * 2 ** Math.min(attempts, 5));
        reconnectTimer = setTimeout(connect, delay);
      };
      ws.onclose = scheduleReconnect;
      ws.onerror = () => { try { ws.close(); } catch (err) { console.error("ws close failed:", err); } };
    };

    connect();
    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      try { wsRef.current && wsRef.current.close(); }
      catch (err) { console.error("ws cleanup failed:", err); }
    };
  }, [token]);

  const items = [
    { to: "/app/chat", label: t("nav_chat"), icon: MessagesSquare, testid: "nav-chat-link" },
    { to: "/app/mail", label: t("nav_mail"), icon: Mail, testid: "nav-mail-link" },
    { to: "/app/directory", label: t("nav_directory"), icon: Users, testid: "nav-directory-link" },
    { to: "/app/profile", label: t("nav_profile"), icon: User, testid: "nav-profile-link" },
  ];
  if (user?.role === "admin") {
    items.push({ to: "/app/admin", label: t("nav_admin"), icon: ShieldCheck, testid: "nav-admin-link" });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-black text-[#F3F4F6]" data-testid="app-shell">
      <aside className="w-20 lg:w-64 flex-shrink-0 border-e border-[#262626] bg-[#0A0A0A] flex flex-col">
        <div className="px-4 lg:px-6 py-6 border-b border-[#262626]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#F5A623] flex items-center justify-center" data-testid="brand-mark">
              <span className="text-black font-bold">G</span>
            </div>
            <div className="hidden lg:block">
              <div className="font-display text-lg leading-tight">{t("brand")}</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF]">PORTAL</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-2 lg:px-3 py-4 space-y-1">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              data-testid={it.testid}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm transition-colors ${
                  isActive
                    ? "bg-[#1A1A1A] text-[#F5A623] border-s-2 border-[#F5A623]"
                    : "text-[#9CA3AF] hover:bg-[#1A1A1A] hover:text-[#F3F4F6]"
                }`
              }
            >
              <it.icon size={18} />
              <span className="hidden lg:inline">{it.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="px-2 lg:px-3 py-4 border-t border-[#262626] space-y-1">
          <button
            data-testid="language-toggle"
            onClick={toggle}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm text-[#9CA3AF] hover:bg-[#1A1A1A] hover:text-[#F3F4F6] transition-colors"
          >
            <Languages size={18} />
            <span className="hidden lg:inline">{lang === "en" ? "العربية" : "English"}</span>
          </button>
          <button
            data-testid="logout-button"
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm text-[#9CA3AF] hover:bg-[#1A1A1A] hover:text-[#F3F4F6] transition-colors"
          >
            <LogOut size={18} />
            <span className="hidden lg:inline">{t("logout")}</span>
          </button>
        </div>

        <div className="px-3 lg:px-6 py-4 border-t border-[#262626] hidden lg:block">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-[#1A1A1A] border border-[#262626] flex items-center justify-center text-sm font-semibold text-[#F5A623]">
              {user?.alias?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium truncate flex items-center gap-1" data-testid="sidebar-user-alias">
                {user?.alias}
                {user?.verified && <BadgeCheck size={14} className="text-[#10B981]" data-testid="sidebar-verified-badge" />}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-[#9CA3AF]">{user?.role}</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <Outlet context={outletCtx} />
      </main>
    </div>
  );
}
