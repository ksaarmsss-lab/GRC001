import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useOutletContext } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import { Send, Search, BadgeCheck } from "lucide-react";
import { toast } from "sonner";

export default function Chat() {
  const { user } = useAuth();
  const { t } = useLang();
  const { online = [] } = useOutletContext() || {};
  const location = useLocation();
  const initialAlias = new URLSearchParams(location.search).get("with");

  const [convs, setConvs] = useState([]);
  const [consultants, setConsultants] = useState([]);
  const [active, setActive] = useState(initialAlias || null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const bottomRef = useRef(null);

  const loadConvs = async () => {
    try { const { data } = await api.get("/chat/conversations"); setConvs(data); }
    catch (e) { console.error("loadConvs failed:", e); }
  };
  const loadConsultants = async () => {
    try { const { data } = await api.get("/consultants"); setConsultants(data.filter((c) => c.alias !== user?.alias)); }
    catch (e) { console.error("loadConsultants failed:", e); }
  };
  const loadMessages = async (alias) => {
    if (!alias) return;
    try { const { data } = await api.get(`/chat/messages/${alias}`); setMessages(data); }
    catch (e) { console.error("loadMessages failed:", e); }
  };

  useEffect(() => { loadConvs(); loadConsultants(); }, []);
  useEffect(() => { loadMessages(active); }, [active]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // listen for WS broadcasts from AppShell
  useEffect(() => {
    const handler = (e) => {
      const msg = e.detail;
      if (msg?.type === "message") {
        const m = msg.data;
        const involves = m.from_alias === user?.alias || m.to_alias === user?.alias;
        if (!involves) return;
        const other = m.from_alias === user?.alias ? m.to_alias : m.from_alias;
        if (other === active) {
          setMessages((prev) => (prev.find((x) => x.id === m.id) ? prev : [...prev, m]));
        }
        loadConvs();
      }
    };
    window.addEventListener("grc:ws", handler);
    return () => window.removeEventListener("grc:ws", handler);
  }, [active, user]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() || !active) return;
    try {
      await api.post("/chat/send", { to_alias: active, content: text.trim() });
      setText("");
    } catch (err) { toast.error(formatApiError(err)); }
  };

  const list = useMemo(() => {
    const seen = new Set();
    const items = [];
    convs.forEach((c) => { items.push({ ...c, _conv: true }); seen.add(c.alias); });
    consultants.forEach((c) => {
      if (!seen.has(c.alias)) items.push({ alias: c.alias, last_message: "", _conv: false, verified: c.verified, category: c.category });
    });
    const q = search.trim().toLowerCase();
    return q ? items.filter((i) => i.alias.toLowerCase().includes(q)) : items;
  }, [convs, consultants, search]);

  const activeUser = consultants.find((c) => c.alias === active) || (active ? { alias: active } : null);

  return (
    <div className="flex h-full bg-black">
      <div className="w-80 flex-shrink-0 border-e border-[#262626] flex flex-col bg-[#0A0A0A]" data-testid="chat-sidebar">
        <div className="p-4 border-b border-[#262626]">
          <h2 className="font-display text-xl mb-3">{t("conversations")}</h2>
          <div className="relative">
            <Search size={14} className="absolute top-1/2 -translate-y-1/2 start-3 text-[#4B5563]" />
            <input
              data-testid="chat-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("search_consultants")}
              className="w-full bg-[#000] border border-[#262626] text-sm rounded-sm ps-9 pe-3 py-2 focus:outline-none focus:border-[#F5A623] placeholder:text-[#4B5563]"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {list.map((c) => (
            <button
              key={c.alias}
              data-testid={`chat-conv-${c.alias}`}
              onClick={() => setActive(c.alias)}
              className={`w-full text-start px-4 py-3 border-b border-[#1A1A1A] hover:bg-[#141414] transition flex items-center gap-3 ${
                active === c.alias ? "bg-[#141414] border-s-2 border-s-[#F5A623]" : ""
              }`}
            >
              <div className="relative">
                <div className="w-10 h-10 bg-[#1A1A1A] border border-[#262626] flex items-center justify-center text-[#F5A623] font-semibold">
                  {c.alias[0].toUpperCase()}
                </div>
                {online.includes(c.alias) && <span className="absolute -bottom-0.5 -end-0.5 w-2.5 h-2.5 rounded-full bg-[#10B981] ring-2 ring-[#0A0A0A]" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 text-sm font-medium truncate">
                  {c.alias}
                  {c.verified && <BadgeCheck size={12} className="text-[#10B981]" />}
                </div>
                <div className="text-xs text-[#9CA3AF] truncate">{c.last_message || c.category || ""}</div>
              </div>
              {c.unread > 0 && (
                <span className="bg-[#F5A623] text-black text-[10px] rounded-full px-1.5 py-0.5 font-bold" data-testid={`chat-unread-${c.alias}`}>
                  {c.unread}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-black">
        {!active ? (
          <div className="flex-1 flex items-center justify-center text-center p-10" data-testid="chat-empty-state">
            <div>
              <div className="font-display text-2xl mb-2">{t("no_conversation")}</div>
              <div className="text-sm text-[#9CA3AF]">{t("no_conversation_sub")}</div>
            </div>
          </div>
        ) : (
          <>
            <div className="border-b border-[#262626] px-6 py-4 flex items-center gap-3 bg-[#0A0A0A]">
              <div className="w-10 h-10 bg-[#1A1A1A] border border-[#262626] flex items-center justify-center text-[#F5A623] font-semibold">
                {active[0].toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-1 font-medium" data-testid="chat-active-alias">
                  {active}
                  {activeUser?.verified && <BadgeCheck size={14} className="text-[#10B981]" />}
                </div>
                <div className="text-xs text-[#9CA3AF]">
                  {online.includes(active) ? <span className="text-[#10B981]">● {t("online")}</span> : t("offline")}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3 grain" data-testid="chat-messages-pane">
              {messages.map((m) => {
                const mine = m.from_alias === user?.alias;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      data-testid={`chat-message-${m.id}`}
                      className={`max-w-[70%] px-4 py-2.5 rounded-2xl ${
                        mine
                          ? "bg-[#F5A623]/15 border border-[#F5A623]/30 text-[#F3F4F6] rounded-ee-sm"
                          : "bg-[#1A1A1A] border border-[#262626] text-[#F3F4F6] rounded-es-sm"
                      }`}
                    >
                      <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>
                      <div className="text-[10px] text-[#9CA3AF] mt-1 text-end">
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={send} className="border-t border-[#262626] p-4 flex items-center gap-3 bg-[#0A0A0A]">
              <input
                data-testid="chat-message-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t("type_message")}
                className="flex-1 bg-black border border-[#262626] text-[#F3F4F6] rounded-sm px-4 py-2.5 focus:outline-none focus:border-[#F5A623] placeholder:text-[#4B5563]"
              />
              <button
                type="submit"
                data-testid="chat-send-button"
                className="bg-[#F5A623] text-black font-semibold rounded-sm px-5 py-2.5 hover:bg-[#D97706] transition flex items-center gap-2"
              >
                <Send size={16} /> {t("send")}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
