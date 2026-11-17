import { AR } from "./ar";

/**
 * UI translation. English text is the key (so English needs no dictionary and anything missing
 * falls back to English); `ar.ts` maps it to Arabic. Keys may hold `{name}` placeholders.
 * Invoices, quotations and exports stay English on purpose (they call nothing here).
 */
export type Lang = "en" | "ar";
export const LANG_COOKIE = "lang";
export const isLang = (v: unknown): v is Lang => v === "en" || v === "ar";

export type Vars = Record<string, string | number>;
/** Translate function; `t.lang` is passed on to date formatting (`formatDate(d, t.lang)`). */
export type T = ((text: string | null | undefined, vars?: Vars) => string) & { lang: Lang };

const fill = (s: string, vars?: Vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s);
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Templates also translate text that was filled in before it reached the screen,
// e.g. a server message "Joanna has work on record…" matches "{name} has work on record…".
const PATTERNS = Object.entries(AR)
  .filter(([key]) => key.includes("{"))
  .map(([key, value]) => ({
    re: new RegExp(`^${key.split(/\{\w+\}/).map(escape).join("(.+?)")}$`, "s"),
    names: [...key.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!),
    value,
  }));

export function translate(lang: Lang, text: string | null | undefined, vars?: Vars): string {
  if (!text) return "";
  if (lang === "en") return fill(text, vars);
  const exact = AR[text];
  if (exact !== undefined) return fill(exact, vars);
  if (!vars) {
    for (const p of PATTERNS) {
      const m = p.re.exec(text);
      if (m) return fill(p.value, Object.fromEntries(p.names.map((n, i) => [n, m[i + 1]!])));
    }
  }
  return fill(text, vars);
}

export const translator = (lang: Lang): T => Object.assign((text: string | null | undefined, vars?: Vars) => translate(lang, text, vars), { lang });
