import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import { BadgeCheck, Sparkles } from "lucide-react";

export default function Profile() {
  const { user } = useAuth();
  const { t } = useLang();
  if (!user) return null;

  return (
    <div className="flex-1 overflow-y-auto" data-testid="profile-page">
      <div className="px-6 md:px-10 py-10 border-b border-[#262626]">
        <div className="text-[10px] uppercase tracking-[0.3em] text-[#F5A623] mb-2">{t("nav_profile")}</div>
        <h1 className="font-display text-4xl md:text-5xl font-semibold leading-tight">{t("profile_title")}</h1>
      </div>

      <div className="px-6 md:px-10 py-10 max-w-3xl">
        <div className="bg-[#0A0A0A] border border-[#262626] rounded-sm p-6 md:p-8">
          <div className="flex items-start gap-5 mb-8">
            <div className="w-20 h-20 bg-[#1A1A1A] border border-[#262626] flex items-center justify-center text-[#F5A623] font-semibold text-3xl">
              {user.alias[0].toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h2 className="font-display text-3xl" data-testid="profile-alias">{user.alias}</h2>
                {user.verified ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-[#10B981]/10 border border-[#10B981]/20 text-[#10B981] text-xs" data-testid="profile-verified-badge">
                    <BadgeCheck size={12} /> {t("verified")}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-[#F5A623]/10 border border-[#F5A623]/20 text-[#F5A623] text-xs" data-testid="profile-pending-badge">
                    {t("unverified")}
                  </span>
                )}
                {user.share_knowledge && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-[#F5A623]/10 border border-[#F5A623]/30 text-[#F5A623] text-xs uppercase tracking-wider"
                    data-testid="profile-sharer-badge"
                  >
                    <Sparkles size={12} /> {t("share_knowledge_yes")}
                  </span>
                )}
              </div>
              <div className="text-sm text-[#9CA3AF]">{user.primary_industry}</div>
              <div className="text-xs text-[#4B5563] mt-1">
                {t("member_since")} {user.created_at ? new Date(user.created_at).toLocaleDateString() : "—"}
              </div>
            </div>
          </div>

          <div className="mb-8">
            <div className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF] mb-2">{t("profile_bio")}</div>
            {user.bio ? (
              <p data-testid="profile-bio" className="text-sm text-[#F3F4F6] leading-relaxed whitespace-pre-wrap">{user.bio}</p>
            ) : (
              <p className="text-sm text-[#4B5563] italic">{t("profile_no_bio")}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <Info label={t("category")} value={user.category} />
            <Info label={t("experience")} value={user.experience} />
            <Info label={t("areas_of_interest")} chips={user.areas_of_interest} accent="amber" />
            <Info label={t("countries")} chips={user.countries} accent="green" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, chips, accent = "amber" }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF] mb-2">{label}</div>
      {value && <div className="text-[#F3F4F6]">{value}</div>}
      {chips && (
        <div className="flex flex-wrap gap-1.5">
          {chips.length === 0 && <span className="text-[#4B5563] text-xs">—</span>}
          {chips.map((c) => (
            <span
              key={c}
              className={`px-2 py-1 rounded-sm border text-xs ${
                accent === "green"
                  ? "bg-[#10B981]/5 border-[#10B981]/20 text-[#10B981]"
                  : "bg-[#F5A623]/5 border-[#F5A623]/20 text-[#F5A623]"
              }`}
            >
              {c}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
