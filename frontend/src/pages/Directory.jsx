import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { useLang } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { BadgeCheck, MessageSquare, Mail, Search, Sparkles } from "lucide-react";

export default function Directory() {
  const { t } = useLang();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all | verified | unverified
  const [country, setCountry] = useState("all");
  const [opts, setOpts] = useState({ countries: [] });

  useEffect(() => {
    api.get("/consultants").then((r) => setItems(r.data)).catch(() => {});
    api.get("/options").then((r) => setOpts(r.data)).catch(() => {});
  }, []);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((c) => {
      if (c.alias === user?.alias) return false;
      if (filter === "verified" && !c.verified) return false;
      if (filter === "unverified" && c.verified) return false;
      if (country !== "all" && !(c.countries || []).includes(country)) return false;
      if (q && !(`${c.alias} ${c.primary_industry} ${c.category}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [items, search, filter, country, user]);

  return (
    <div className="flex-1 overflow-y-auto" data-testid="directory-page">
      <div className="px-6 md:px-10 py-10 border-b border-[#262626]">
        <div className="text-[10px] uppercase tracking-[0.3em] text-[#F5A623] mb-2">{t("nav_directory")}</div>
        <h1 className="font-display text-4xl md:text-5xl font-semibold leading-tight mb-2">{t("directory_title")}</h1>
        <p className="text-sm text-[#9CA3AF] max-w-xl">{t("directory_sub")}</p>

        <div className="flex flex-wrap items-center gap-3 mt-8">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search size={14} className="absolute top-1/2 -translate-y-1/2 start-3 text-[#4B5563]" />
            <input
              data-testid="directory-search-input"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("search_consultants")}
              className="w-full bg-[#0A0A0A] border border-[#262626] rounded-sm ps-9 pe-3 py-2.5 text-sm focus:outline-none focus:border-[#F5A623]"
            />
          </div>
          <select
            data-testid="directory-filter-status"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-[#0A0A0A] border border-[#262626] rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-[#F5A623]"
          >
            <option value="all">{t("all")}</option>
            <option value="verified">{t("verified")}</option>
            <option value="unverified">{t("unverified")}</option>
          </select>
          <select
            data-testid="directory-filter-country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="bg-[#0A0A0A] border border-[#262626] rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-[#F5A623]"
          >
            <option value="all">{t("countries")} — {t("all")}</option>
            {opts.countries.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="px-6 md:px-10 py-8 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {list.map((c) => {
          const isBot = c.alias.startsWith("ARM-AI");
          return (
          <div
            key={c.alias}
            data-testid={`directory-card-${c.alias}`}
            className={`bg-[#0A0A0A] border ${isBot ? "border-[#F5A623]/40 hover:border-[#F5A623]" : "border-[#262626] hover:border-[#404040]"} rounded-sm p-5 transition-colors flex flex-col`}
          >
            <div className="flex items-start gap-3 mb-4">
              <div className={`w-12 h-12 border flex items-center justify-center font-semibold text-lg ${isBot ? "bg-[#F5A623]/10 border-[#F5A623]/40 text-[#F5A623]" : "bg-[#1A1A1A] border-[#262626] text-[#F5A623]"}`}>
                {isBot ? <Sparkles size={20} data-testid={`directory-ai-icon-${c.alias}`} /> : c.alias[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium truncate" data-testid={`directory-alias-${c.alias}`}>{c.alias}</span>
                  {isBot && (
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-[#F5A623]/10 border border-[#F5A623]/30 text-[#F5A623] text-[10px] font-medium uppercase tracking-wider"
                      data-testid={`directory-ai-badge-${c.alias}`}
                    >
                      <Sparkles size={10} /> {t("ai_assistant")}
                    </span>
                  )}
                  {c.verified && !isBot && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-[#10B981]/10 border border-[#10B981]/20 text-[#10B981] text-[10px]" data-testid={`directory-verified-${c.alias}`}>
                      <BadgeCheck size={10} /> {t("verified")}
                    </span>
                  )}
                </div>
                <div className="text-xs text-[#9CA3AF] truncate">{c.primary_industry}</div>
              </div>
            </div>

            <div className="space-y-2 text-xs text-[#9CA3AF] mb-4">
              <div><span className="text-[#4B5563]">{t("category")}: </span><span className="text-[#F3F4F6]">{c.category}</span></div>
              <div><span className="text-[#4B5563]">{t("experience")}: </span><span className="text-[#F3F4F6]">{c.experience}</span></div>
              <div className="flex flex-wrap gap-1 mt-2">
                {(c.countries || []).map((cn) => (
                  <span key={cn} className="px-1.5 py-0.5 bg-[#1A1A1A] border border-[#262626] rounded-sm text-[10px]">{cn}</span>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                {(c.areas_of_interest || []).slice(0, 3).map((a) => (
                  <span key={a} className="px-1.5 py-0.5 bg-[#F5A623]/5 border border-[#F5A623]/20 text-[#F5A623] rounded-sm text-[10px]">{a}</span>
                ))}
              </div>
            </div>

            <div className="flex gap-2 mt-auto">
              <button
                data-testid={`directory-chat-${c.alias}`}
                onClick={() => navigate(`/app/chat?with=${c.alias}`)}
                className="flex-1 bg-[#F5A623] text-black text-xs font-semibold rounded-sm px-3 py-2 hover:bg-[#D97706] transition flex items-center justify-center gap-1.5"
              >
                <MessageSquare size={12} /> {t("open_chat")}
              </button>
              <button
                data-testid={`directory-mail-${c.alias}`}
                onClick={() => navigate(`/app/mail?to=${c.alias}`)}
                className="flex-1 bg-transparent border border-[#404040] hover:border-[#F5A623] text-xs rounded-sm px-3 py-2 transition flex items-center justify-center gap-1.5"
              >
                <Mail size={12} /> {t("send_mail")}
              </button>
            </div>
          </div>
          );
        })}
        {list.length === 0 && (
          <div className="col-span-full text-sm text-[#9CA3AF] text-center py-12">No consultants found.</div>
        )}
      </div>
    </div>
  );
}
