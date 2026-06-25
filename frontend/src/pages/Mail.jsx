import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { api, formatApiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import { Mail, Send, Plus, BadgeCheck, X } from "lucide-react";
import { toast } from "sonner";

export default function MailPage() {
  const { user } = useAuth();
  const { t } = useLang();
  const location = useLocation();
  const prefilledTo = new URLSearchParams(location.search).get("to") || "";

  const [folder, setFolder] = useState("inbox");
  const [emails, setEmails] = useState([]);
  const [selected, setSelected] = useState(null);
  const [composing, setComposing] = useState(!!prefilledTo);
  const [form, setForm] = useState({ to_alias: prefilledTo, subject: "", body: "" });
  const [sending, setSending] = useState(false);

  const load = async (f) => {
    try { const { data } = await api.get(`/mail/${f}`); setEmails(data); setSelected(null); }
    catch (e) { console.error("mail load failed:", e); }
  };

  useEffect(() => { load(folder); }, [folder]);

  useEffect(() => {
    const handler = (e) => { if (e.detail?.type === "email") load(folder); };
    window.addEventListener("grc:ws", handler);
    return () => window.removeEventListener("grc:ws", handler);
  }, [folder]);

  const openEmail = async (em) => {
    setSelected(em);
    if (folder === "inbox" && !em.read) {
      try { await api.post(`/mail/${em.id}/read`); load(folder); }
      catch (e) { console.error("mark read failed:", e); }
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await api.post("/mail/send", form);
      toast.success(t("success_email_sent"));
      setComposing(false);
      setForm({ to_alias: "", subject: "", body: "" });
      if (folder === "sent") load("sent");
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setSending(false); }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-[200px_320px_1fr] h-full bg-black">
      <div className="border-e border-[#262626] bg-[#0A0A0A] p-4 hidden md:flex flex-col gap-1">
        <button
          data-testid="mail-compose-button"
          onClick={() => setComposing(true)}
          className="bg-[#F5A623] text-black font-semibold rounded-sm px-4 py-2.5 hover:bg-[#D97706] transition flex items-center justify-center gap-2 mb-4"
        >
          <Plus size={16} /> {t("compose")}
        </button>
        {["inbox", "sent"].map((f) => (
          <button
            key={f}
            data-testid={`mail-folder-${f}`}
            onClick={() => setFolder(f)}
            className={`text-start px-3 py-2 rounded-sm text-sm transition ${
              folder === f ? "bg-[#1A1A1A] text-[#F5A623]" : "text-[#9CA3AF] hover:bg-[#1A1A1A] hover:text-[#F3F4F6]"
            }`}
          >
            {t(f)}
          </button>
        ))}
      </div>

      <div className="border-e border-[#262626] bg-black overflow-y-auto" data-testid="mail-list">
        <div className="px-4 py-3 border-b border-[#262626] flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF]">{t(folder)}</div>
          <div className="text-xs text-[#4B5563]">{emails.length}</div>
        </div>
        {emails.length === 0 ? (
          <div className="p-6 text-sm text-[#9CA3AF] text-center" data-testid="mail-empty-state">{t("no_emails")}</div>
        ) : emails.map((em) => (
          <button
            key={em.id}
            data-testid={`mail-item-${em.id}`}
            onClick={() => openEmail(em)}
            className={`w-full text-start p-4 border-b border-[#1A1A1A] hover:bg-[#0A0A0A] transition ${
              selected?.id === em.id ? "bg-[#141414] border-s-2 border-s-[#F5A623]" : ""
            } ${folder === "inbox" && !em.read ? "bg-[#0A0A0A]" : ""}`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className={`text-sm ${folder === "inbox" && !em.read ? "font-semibold text-[#F3F4F6]" : "text-[#9CA3AF]"}`}>
                {folder === "inbox" ? em.from_alias : em.to_alias}
              </span>
              <span className="text-[10px] text-[#4B5563]">{new Date(em.timestamp).toLocaleDateString()}</span>
            </div>
            <div className={`text-sm truncate ${folder === "inbox" && !em.read ? "text-[#F3F4F6]" : "text-[#9CA3AF]"}`}>
              {em.subject}
            </div>
            <div className="text-xs text-[#4B5563] truncate mt-0.5">{em.body}</div>
          </button>
        ))}
      </div>

      <div className="bg-[#0A0A0A] overflow-y-auto flex flex-col" data-testid="mail-reading-pane">
        {composing ? (
          <form onSubmit={submit} className="p-6 md:p-10 flex-1 flex flex-col gap-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-2xl">{t("compose")}</h2>
              <button type="button" onClick={() => setComposing(false)} data-testid="mail-compose-close" className="text-[#9CA3AF] hover:text-[#F3F4F6]">
                <X size={18} />
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF]">{t("to")}</label>
              <input
                data-testid="mail-to-input"
                value={form.to_alias}
                onChange={(e) => setForm({ ...form, to_alias: e.target.value })}
                required
                className="bg-black border border-[#262626] rounded-sm px-4 py-2.5 focus:outline-none focus:border-[#F5A623]"
                placeholder="alias"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF]">{t("subject")}</label>
              <input
                data-testid="mail-subject-input"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                required
                className="bg-black border border-[#262626] rounded-sm px-4 py-2.5 focus:outline-none focus:border-[#F5A623]"
              />
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF]">{t("message")}</label>
              <textarea
                data-testid="mail-body-input"
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                required rows={10}
                className="bg-black border border-[#262626] rounded-sm px-4 py-2.5 focus:outline-none focus:border-[#F5A623] resize-none flex-1"
              />
            </div>
            <div>
              <button
                type="submit" disabled={sending}
                data-testid="mail-send-button"
                className="bg-[#F5A623] text-black font-semibold rounded-sm px-6 py-3 hover:bg-[#D97706] transition flex items-center gap-2 disabled:opacity-50"
              >
                <Send size={16} /> {sending ? t("loading") : t("send_email")}
              </button>
            </div>
          </form>
        ) : !selected ? (
          <div className="flex-1 flex items-center justify-center text-center p-10 text-[#9CA3AF]" data-testid="mail-no-selection">
            <div>
              <Mail size={32} className="mx-auto mb-3 text-[#4B5563]" />
              <div className="font-display text-xl mb-1 text-[#F3F4F6]">{t("select_email")}</div>
            </div>
          </div>
        ) : (
          <div className="p-6 md:p-10">
            <h1 className="font-display text-3xl mb-4" data-testid="mail-detail-subject">{selected.subject}</h1>
            <div className="flex items-center gap-3 pb-6 border-b border-[#262626] mb-6">
              <div className="w-10 h-10 bg-[#1A1A1A] border border-[#262626] flex items-center justify-center text-[#F5A623] font-semibold">
                {(folder === "inbox" ? selected.from_alias : selected.to_alias)[0].toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-medium">{folder === "inbox" ? selected.from_alias : selected.to_alias}</div>
                <div className="text-xs text-[#9CA3AF]">{new Date(selected.timestamp).toLocaleString()}</div>
              </div>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-sm text-[#F3F4F6] leading-relaxed" data-testid="mail-detail-body">
              {selected.body}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
