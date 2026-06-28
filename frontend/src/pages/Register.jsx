import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";
import { api, formatApiError } from "@/lib/api";
import { ArrowLeft, ArrowRight, Check, Languages } from "lucide-react";
import { toast } from "sonner";

export default function Register() {
  const { register } = useAuth();
  const { t, lang, toggle } = useLang();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [opts, setOpts] = useState({ categories: [], experience: [], areas_of_interest: [], countries: [], industries: [] });
  const [form, setForm] = useState({
    alias: "",
    password: "",
    primary_industry: "",
    category: "",
    experience: "",
    areas_of_interest: [],
    countries: [],
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.get("/options").then((r) => setOpts(r.data)).catch(() => {}); }, []);

  const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleItem = (k, v) => setForm((f) => {
    const list = f[k];
    return { ...f, [k]: list.includes(v) ? list.filter((x) => x !== v) : [...list, v] };
  });

  const next = (e) => { e?.preventDefault(); setError(""); setStep((s) => Math.min(s + 1, 3)); };
  const back = () => { setError(""); setStep((s) => Math.max(s - 1, 1)); };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.areas_of_interest.length || !form.countries.length) {
      setError(t("pick_at_least_one"));
      return;
    }
    setLoading(true);
    try {
      await register({ ...form, alias: form.alias.trim() });
      toast.success(t("success_registered"));
      navigate("/app/profile");
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const submitLabel = () => {
    if (step !== 3) return t("next");
    return loading ? t("loading") : t("submit_register");
  };

  return (
    <div className="min-h-screen bg-black text-[#F3F4F6] flex flex-col">
      <div className="flex items-center justify-between p-6 md:px-14 md:py-8 border-b border-[#262626]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#F5A623] flex items-center justify-center">
            <span className="text-black font-bold">G</span>
          </div>
          <span className="font-display text-lg">{t("brand")}</span>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF]" data-testid="register-step-indicator">
            {t("step")} {step} {t("of")} 3
          </div>
          <button onClick={toggle} data-testid="register-language-toggle" className="flex items-center gap-2 text-xs text-[#9CA3AF] hover:text-[#F5A623] uppercase tracking-[0.2em]">
            <Languages size={14} />
            {lang === "en" ? "العربية" : "English"}
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center px-6 py-12">
        <div className="w-full max-w-2xl fade-up">
          <div className="text-[10px] uppercase tracking-[0.3em] text-[#F5A623] mb-3">{t("register")}</div>
          <h1 className="font-display text-4xl md:text-5xl font-semibold leading-[1.05] mb-3">{t("create_profile")}</h1>
          <p className="text-sm text-[#9CA3AF] mb-10">{t("create_profile_sub")}</p>

          {/* Progress */}
          <div className="flex gap-2 mb-10">
            {[1,2,3].map((n) => (
              <div key={n} className={`h-0.5 flex-1 ${n <= step ? "bg-[#F5A623]" : "bg-[#262626]"}`} />
            ))}
          </div>

          <form onSubmit={step === 3 ? submit : next} className="space-y-6">
            {step === 1 && (
              <>
                <Field label={t("alias")} hint={t("aliasHint")}>
                  <input
                    data-testid="register-alias-input"
                    value={form.alias}
                    onChange={(e) => setField("alias", e.target.value)}
                    required minLength={3} maxLength={50}
                    className="grc-input"
                    placeholder="riskmaverick"
                  />
                </Field>
                <Field label={t("password")}>
                  <input
                    data-testid="register-password-input"
                    type="password"
                    value={form.password}
                    onChange={(e) => setField("password", e.target.value)}
                    required minLength={6}
                    className="grc-input"
                    placeholder="••••••••"
                  />
                </Field>
                <Field label={t("primary_industry")} hint={t("industry_hint")}>
                  <select
                    data-testid="register-industry-select"
                    value={form.primary_industry}
                    onChange={(e) => setField("primary_industry", e.target.value)}
                    required
                    className="grc-input"
                  >
                    <option value="">{t("select_industry")}</option>
                    {opts.industries.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
              </>
            )}

            {step === 2 && (
              <>
                <Field label={t("category")}>
                  <select
                    data-testid="register-category-select"
                    value={form.category}
                    onChange={(e) => setField("category", e.target.value)}
                    required
                    className="grc-input"
                  >
                    <option value="">{t("select_category")}</option>
                    {opts.categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label={t("experience")}>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {opts.experience.map((x) => (
                      <button
                        key={x}
                        type="button"
                        data-testid={`register-experience-${x}`}
                        onClick={() => setField("experience", x)}
                        className={`px-3 py-2.5 border rounded-sm text-sm transition ${
                          form.experience === x
                            ? "border-[#F5A623] bg-[#F5A623]/10 text-[#F5A623]"
                            : "border-[#262626] bg-[#0A0A0A] text-[#F3F4F6] hover:border-[#404040]"
                        }`}
                      >
                        {x}
                      </button>
                    ))}
                  </div>
                </Field>
              </>
            )}

            {step === 3 && (
              <>
                <Field label={t("areas_of_interest")}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {opts.areas_of_interest.map((a) => {
                      const on = form.areas_of_interest.includes(a);
                      return (
                        <button
                          key={a} type="button"
                          data-testid={`register-area-${a.replace(/\s+/g, "-")}`}
                          onClick={() => toggleItem("areas_of_interest", a)}
                          className={`flex items-center justify-between px-3 py-2.5 border rounded-sm text-sm transition ${
                            on ? "border-[#F5A623] bg-[#F5A623]/10 text-[#F5A623]" : "border-[#262626] bg-[#0A0A0A] text-[#F3F4F6] hover:border-[#404040]"
                          }`}
                        >
                          <span>{a}</span>
                          {on && <Check size={14} />}
                        </button>
                      );
                    })}
                  </div>
                </Field>
                <Field label={t("countries")}>
                  <div className="flex flex-wrap gap-2">
                    {opts.countries.map((c) => {
                      const on = form.countries.includes(c);
                      return (
                        <button
                          key={c} type="button"
                          data-testid={`register-country-${c}`}
                          onClick={() => toggleItem("countries", c)}
                          className={`px-4 py-2 border rounded-full text-xs uppercase tracking-wider transition ${
                            on ? "border-[#10B981] bg-[#10B981]/10 text-[#10B981]" : "border-[#262626] bg-[#0A0A0A] text-[#9CA3AF] hover:border-[#404040]"
                          }`}
                        >
                          {c}
                        </button>
                      );
                    })}
                  </div>
                </Field>
              </>
            )}

            {error && (
              <div className="text-sm text-[#DC2626] border border-[#DC2626]/30 bg-[#DC2626]/5 px-3 py-2 rounded-sm" data-testid="register-error">
                {error}
              </div>
            )}

            <div className="flex items-center justify-between pt-4">
              <button
                type="button"
                onClick={back}
                disabled={step === 1}
                data-testid="register-back-button"
                className="flex items-center gap-2 text-sm text-[#9CA3AF] hover:text-[#F3F4F6] disabled:opacity-30 transition"
              >
                <ArrowLeft size={14} /> {t("back")}
              </button>
              <button
                type="submit"
                disabled={loading}
                data-testid={step === 3 ? "register-submit-button" : "register-next-button"}
                className="bg-[#F5A623] text-black font-semibold rounded-sm px-6 py-3 hover:bg-[#D97706] transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {submitLabel()}
                <ArrowRight size={16} />
              </button>
            </div>
          </form>

          <div className="mt-8 text-sm text-[#9CA3AF]">
            {t("have_account")}{" "}
            <Link to="/login" data-testid="go-to-login" className="text-[#F5A623] hover:underline">
              {t("sign_in_here")}
            </Link>
          </div>
        </div>
      </div>
      <style>{`.grc-input{width:100%;background:#0A0A0A;border:1px solid #262626;color:#F3F4F6;border-radius:2px;padding:.7rem 1rem;outline:none;transition:.15s}.grc-input:focus{border-color:#F5A623;box-shadow:0 0 0 1px #F5A623}`}</style>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] uppercase tracking-[0.2em] text-[#9CA3AF]">{label}</label>
      {children}
      {hint && <span className="text-xs text-[#4B5563]">{hint}</span>}
    </div>
  );
}
