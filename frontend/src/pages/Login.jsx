import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import { formatApiError } from "@/lib/api";
import { Languages, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { ARMLogo } from "@/components/ARMLogo";

const HERO_IMG = "https://images.unsplash.com/photo-1619218070141-bcfeb8b93074?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NzB8MHwxfHNlYXJjaHwyfHxtb2Rlcm4lMjBkYXJrJTIwY29ycG9yYXRlJTIwYXJjaGl0ZWN0dXJlJTIwZXh0ZXJpb3J8ZW58MHx8fHwxNzgyNDI4NDA1fDA&ixlib=rb-4.1.0&q=85";

export default function Login() {
  const { login } = useAuth();
  const { t, lang, toggle } = useLang();
  const navigate = useNavigate();
  const [alias, setAlias] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const u = await login(alias.trim(), password);
      toast.success(t("success_login"));
      navigate(u.role === "admin" ? "/app/admin" : "/app/chat");
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-black text-[#F3F4F6]">
      <div className="flex flex-col p-8 md:p-14 relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5" data-testid="auth-brand">
            <ARMLogo size={40} />
            <span className="font-display text-lg leading-tight max-w-[240px]">{t("brand")}</span>
          </div>
          <button
            data-testid="auth-language-toggle"
            onClick={toggle}
            className="flex items-center gap-2 text-xs text-[#9CA3AF] hover:text-[#F5A623] transition-colors uppercase tracking-[0.2em]"
          >
            <Languages size={14} />
            {lang === "en" ? "العربية" : "English"}
          </button>
        </div>

        <div className="flex-1 flex items-center max-w-md w-full mx-auto fade-up">
          <div className="w-full">
            <div className="text-[10px] uppercase tracking-[0.3em] text-[#F5A623] mb-3">{t("login")}</div>
            <h1 className="font-display text-4xl md:text-5xl font-semibold leading-[1.05] mb-3" data-testid="login-title">
              {t("welcome_back")}
            </h1>
            <p className="text-sm text-[#9CA3AF] mb-10">{t("welcome_back_sub")}</p>

            <form onSubmit={onSubmit} className="space-y-5" autoComplete="on">
              <div>
                <label className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF] mb-1.5 block">{t("alias")}</label>
                <input
                  data-testid="login-alias-input"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  required
                  autoFocus
                  autoComplete="username"
                  spellCheck="false"
                  className="w-full bg-[#0A0A0A] border border-[#262626] text-[#F3F4F6] rounded-sm px-4 py-3 focus:outline-none focus:border-[#F5A623] focus:ring-1 focus:ring-[#F5A623] transition placeholder:text-[#4B5563]"
                  placeholder="riskmaverick"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF] mb-1.5 block">{t("password")}</label>
                <input
                  data-testid="login-password-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full bg-[#0A0A0A] border border-[#262626] text-[#F3F4F6] rounded-sm px-4 py-3 focus:outline-none focus:border-[#F5A623] focus:ring-1 focus:ring-[#F5A623] transition placeholder:text-[#4B5563]"
                  placeholder="••••••••"
                />
              </div>
              {error && (
                <div className="text-sm text-[#DC2626] border border-[#DC2626]/30 bg-[#DC2626]/5 px-3 py-2 rounded-sm" data-testid="login-error">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                data-testid="login-submit-button"
                className="w-full bg-[#F5A623] text-black font-semibold rounded-sm px-6 py-3 hover:bg-[#D97706] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? t("loading") : t("submit_login")} <ArrowRight size={16} />
              </button>
            </form>

            <div className="mt-8 text-sm text-[#9CA3AF]">
              {t("no_account")}{" "}
              <Link to="/register" data-testid="go-to-register" className="text-[#F5A623] hover:underline">
                {t("register_here")}
              </Link>
            </div>
          </div>
        </div>

        <div className="text-[10px] text-[#4B5563] uppercase tracking-[0.3em]">© {t("brand")} · {new Date().getFullYear()}</div>
      </div>

      <div className="hidden lg:block relative">
        <img src={HERO_IMG} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute bottom-0 left-0 right-0 p-14">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#F5A623] mb-3">An invitation-only network</div>
          <div className="font-display text-3xl md:text-4xl leading-tight max-w-md">
            {t("tagline")}
          </div>
        </div>
      </div>
    </div>
  );
}
