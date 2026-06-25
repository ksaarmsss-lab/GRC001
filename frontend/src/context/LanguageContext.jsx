import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { translations } from "@/i18n/translations";

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState(() => localStorage.getItem("grc_lang") || "en");

  useEffect(() => {
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    localStorage.setItem("grc_lang", lang);
  }, [lang]);

  const t = useCallback((key) => translations[lang]?.[key] ?? translations.en[key] ?? key, [lang]);
  const toggle = () => setLang((l) => (l === "en" ? "ar" : "en"));

  const value = useMemo(() => ({ lang, t, setLang, toggle }), [lang, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLang = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
};
