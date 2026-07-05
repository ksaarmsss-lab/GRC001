import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { useLang } from "@/context/LanguageContext";
import { BadgeCheck, Sparkles, X, MessageSquare } from "lucide-react";
import { toast } from "sonner";

export default function Admin() {
  const { t } = useLang();
  const [tab, setTab] = useState("pending");
  const [items, setItems] = useState([]);

  const load = async () => {
    try {
      const path = tab === "pending" ? "/admin/pending" : tab === "sharers" ? "/admin/sharers" : "/admin/all";
      const { data } = await api.get(path);
      setItems(data);
    } catch (e) { toast.error(formatApiError(e)); }
  };
  useEffect(() => { load(); }, [tab]);

  const toggle = async (alias, verified) => {
    try {
      await api.post(`/admin/verify/${alias}`, { verified });
      toast.success(t("success_verified"));
      load();
    } catch (e) { toast.error(formatApiError(e)); }
  };

  const tabs = [
    { k: "pending", label: t("unverified") },
    { k: "sharers", label: t("admin_tab_sharers") },
    { k: "all",     label: t("all") },
  ];

  return (
    <div className="flex-1 overflow-y-auto" data-testid="admin-page">
      <div className="px-6 md:px-10 py-10 border-b border-[#262626]">
        <div className="text-[10px] uppercase tracking-[0.3em] text-[#F5A623] mb-2">{t("nav_admin")}</div>
        <h1 className="font-display text-4xl md:text-5xl font-semibold leading-tight mb-2">{t("admin_title")}</h1>
        <p className="text-sm text-[#9CA3AF]">{t("admin_sub")}</p>

        <div className="flex gap-2 mt-8 flex-wrap">
          {tabs.map((tk) => (
            <button
              key={tk.k}
              data-testid={`admin-tab-${tk.k}`}
              onClick={() => setTab(tk.k)}
              className={`px-4 py-2 rounded-sm text-xs uppercase tracking-[0.2em] border transition ${
                tab === tk.k ? "border-[#F5A623] bg-[#F5A623]/10 text-[#F5A623]" : "border-[#262626] text-[#9CA3AF] hover:border-[#404040]"
              }`}
            >
              {tk.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 md:px-10 py-8 space-y-4">
        {items.length === 0 ? (
          <div className="text-sm text-[#9CA3AF] py-12 text-center" data-testid="admin-empty-state">
            {tab === "sharers" ? t("admin_no_sharers") : t("no_pending")}
          </div>
        ) : tab === "sharers" ? (
          items.map((c) => <SharerRow key={c.alias} c={c} onSaved={load} />)
        ) : items.map((c) => (
          <div
            key={c.alias}
            data-testid={`admin-row-${c.alias}`}
            className="bg-[#0A0A0A] border border-[#262626] rounded-sm p-4 flex flex-wrap items-center gap-4"
          >
            <div className="w-10 h-10 bg-[#1A1A1A] border border-[#262626] flex items-center justify-center text-[#F5A623] font-semibold">
              {c.alias[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-medium">{c.alias}</span>
                {c.verified && <BadgeCheck size={14} className="text-[#10B981]" />}
                {c.share_knowledge && <Sparkles size={12} className="text-[#F5A623]" />}
              </div>
              <div className="text-xs text-[#9CA3AF]">{c.primary_industry} · {c.category} · {c.experience}</div>
              <div className="flex flex-wrap gap-1 mt-1">
                {(c.countries || []).map((cn) => (
                  <span key={cn} className="px-1.5 py-0.5 bg-[#1A1A1A] border border-[#262626] rounded-sm text-[10px] text-[#9CA3AF]">{cn}</span>
                ))}
              </div>
            </div>
            {c.verified ? (
              <button
                data-testid={`admin-revoke-${c.alias}`}
                onClick={() => toggle(c.alias, false)}
                className="bg-transparent border border-[#404040] hover:border-[#DC2626] hover:text-[#DC2626] text-xs rounded-sm px-4 py-2 transition flex items-center gap-1.5"
              >
                <X size={12} /> {t("revoke")}
              </button>
            ) : (
              <button
                data-testid={`admin-approve-${c.alias}`}
                onClick={() => toggle(c.alias, true)}
                className="bg-[#10B981] text-black text-xs font-semibold rounded-sm px-4 py-2 hover:bg-[#059669] transition flex items-center gap-1.5"
              >
                <BadgeCheck size={12} /> {t("approve")}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SharerRow({ c, onSaved }) {
  const { t } = useLang();
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setSaving(true);
    try {
      await api.post(`/admin/comments/${c.alias}`, { comment: comment.trim() });
      setComment("");
      toast.success(t("admin_comment_save"));
      onSaved();
    } catch (err) { toast.error(formatApiError(err)); }
    finally { setSaving(false); }
  };

  const comments = c.admin_comments || [];
  return (
    <div
      data-testid={`admin-sharer-row-${c.alias}`}
      className="bg-[#0A0A0A] border border-[#262626] rounded-sm p-5"
    >
      <div className="flex items-start gap-4 mb-4">
        <div className="w-10 h-10 bg-[#1A1A1A] border border-[#262626] flex items-center justify-center text-[#F5A623] font-semibold">
          {c.alias[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className="font-medium">{c.alias}</span>
            {c.verified && <BadgeCheck size={14} className="text-[#10B981]" />}
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-[#F5A623]/10 border border-[#F5A623]/30 text-[#F5A623] text-[10px] uppercase tracking-wider">
              <Sparkles size={10} /> {t("share_knowledge_yes")}
            </span>
          </div>
          <div className="text-xs text-[#9CA3AF] mb-2">{c.primary_industry} · {c.category} · {c.experience}</div>
          {c.bio && (
            <p className="text-xs text-[#F3F4F6] whitespace-pre-wrap border-s-2 border-[#F5A623]/40 ps-3 py-1">{c.bio}</p>
          )}
        </div>
      </div>

      <div className="mt-4 border-t border-[#262626] pt-4">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF] mb-2 flex items-center gap-1.5">
          <MessageSquare size={11} /> Admin comments ({comments.length})
        </div>
        {comments.length === 0 ? (
          <div className="text-xs text-[#4B5563] italic mb-3" data-testid={`admin-sharer-no-comments-${c.alias}`}>
            {t("admin_no_comments")}
          </div>
        ) : (
          <div className="space-y-2 mb-3">
            {comments.map((cm) => (
              <div key={cm.id} className="bg-[#141414] border border-[#262626] rounded-sm p-3">
                <div className="text-sm text-[#F3F4F6] whitespace-pre-wrap">{cm.comment}</div>
                <div className="text-[10px] text-[#4B5563] mt-1">
                  {t("posted_by")} <span className="text-[#F5A623]">{cm.by}</span> · {new Date(cm.at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={save} className="flex flex-col md:flex-row gap-2">
          <textarea
            data-testid={`admin-comment-input-${c.alias}`}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder={t("admin_comment_placeholder")}
            className="flex-1 bg-black border border-[#262626] text-sm rounded-sm px-3 py-2 focus:outline-none focus:border-[#F5A623] resize-none"
          />
          <button
            type="submit"
            disabled={saving || !comment.trim()}
            data-testid={`admin-comment-save-${c.alias}`}
            className="bg-[#F5A623] text-black text-xs font-semibold rounded-sm px-4 py-2 hover:bg-[#D97706] transition disabled:opacity-40 md:self-start"
          >
            {saving ? t("loading") : t("admin_comment_save")}
          </button>
        </form>
      </div>
    </div>
  );
}
