import { useEffect, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { useLang } from "@/context/LanguageContext";
import { BadgeCheck, X } from "lucide-react";
import { toast } from "sonner";

export default function Admin() {
  const { t } = useLang();
  const [tab, setTab] = useState("pending");
  const [items, setItems] = useState([]);

  const load = async () => {
    try {
      const path = tab === "pending" ? "/admin/pending" : "/admin/all";
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

  return (
    <div className="flex-1 overflow-y-auto" data-testid="admin-page">
      <div className="px-6 md:px-10 py-10 border-b border-[#262626]">
        <div className="text-[10px] uppercase tracking-[0.3em] text-[#F5A623] mb-2">{t("nav_admin")}</div>
        <h1 className="font-display text-4xl md:text-5xl font-semibold leading-tight mb-2">{t("admin_title")}</h1>
        <p className="text-sm text-[#9CA3AF]">{t("admin_sub")}</p>

        <div className="flex gap-2 mt-8">
          {["pending", "all"].map((tk) => (
            <button
              key={tk}
              data-testid={`admin-tab-${tk}`}
              onClick={() => setTab(tk)}
              className={`px-4 py-2 rounded-sm text-xs uppercase tracking-[0.2em] border transition ${
                tab === tk ? "border-[#F5A623] bg-[#F5A623]/10 text-[#F5A623]" : "border-[#262626] text-[#9CA3AF] hover:border-[#404040]"
              }`}
            >
              {tk === "pending" ? t("unverified") : t("all")}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 md:px-10 py-8 space-y-3">
        {items.length === 0 ? (
          <div className="text-sm text-[#9CA3AF] py-12 text-center" data-testid="admin-empty-state">{t("no_pending")}</div>
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
              <div className="flex items-center gap-1.5">
                <span className="font-medium">{c.alias}</span>
                {c.verified && <BadgeCheck size={14} className="text-[#10B981]" />}
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
