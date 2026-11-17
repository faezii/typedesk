"use client";

import { createContext, useContext, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { Direction } from "radix-ui";
import { Button } from "@/components/ui/button";
import { LANG_COOKIE, translator, type Lang, type T } from "@/lib/i18n/translate";

const LangContext = createContext<Lang>("en");

export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  // Radix menus, selects and popovers read direction from their own provider, not from <html dir>.
  return (
    <LangContext.Provider value={lang}>
      <Direction.DirectionProvider dir={lang === "ar" ? "rtl" : "ltr"}>{children}</Direction.DirectionProvider>
    </LangContext.Provider>
  );
}

export const useLang = () => useContext(LangContext);

/** `const t = useT()` in client components. */
export function useT(): T {
  const lang = useLang();
  return useMemo(() => translator(lang), [lang]);
}

/** `<T>Close</T>`: translate one piece of text inside client components that have no `t` of their own (e.g. components/ui). */
export function T({ children }: { children: string }) {
  return useT()(children);
}

/** Switches between English and Arabic for this browser (remembered for a year). */
export function useSwitchLanguage() {
  const lang = useLang();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next: Lang = lang === "ar" ? "en" : "ar";
  const toggle = () => {
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  };
  return { next, toggle, pending, label: next === "ar" ? "العربية" : "English" };
}

export function LanguageButton({ className }: { className?: string }) {
  const { toggle, pending, label, next } = useSwitchLanguage();
  return (
    <Button variant="ghost" size="sm" className={className} onClick={toggle} disabled={pending} lang={next} aria-label={next === "ar" ? "التبديل إلى العربية" : "Switch to English"}>
      <Languages /> {label}
    </Button>
  );
}
