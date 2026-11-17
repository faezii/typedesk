import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { LANG_COOKIE, isLang, translator, type Lang } from "./translate";

/** The signed-in person's screen language (cookie set by the language switch); English by default. */
export const getLang = cache(async (): Promise<Lang> => {
  const value = (await cookies()).get(LANG_COOKIE)?.value;
  return isLang(value) ? value : "en";
});

/** `const t = await getT()` in server components and actions. */
export const getT = async () => translator(await getLang());
