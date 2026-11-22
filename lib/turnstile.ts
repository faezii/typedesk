import "server-only";

/** Cloudflare Turnstile (bot check) on /signup. Without TURNSTILE_SECRET_KEY it is skipped in development; production then keeps sign-up closed. */
export const turnstileConfigured = () => !!process.env.TURNSTILE_SECRET_KEY || process.env.NODE_ENV !== "production";

export const turnstileSiteKey = () => process.env.TURNSTILE_SITE_KEY ?? "";

/** Asks Cloudflare whether the widget's token is genuine (single use). */
export async function verifyTurnstile(token: unknown, ip: string, fetcher: typeof fetch = fetch) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return process.env.NODE_ENV !== "production";
  if (typeof token !== "string" || !token || token.length > 2048) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip !== "unknown") body.set("remoteip", ip);
  try {
    const res = await fetcher("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
    return res.ok && ((await res.json()) as { success?: boolean }).success === true;
  } catch (e) {
    console.error("Turnstile check failed", e);
    return false;
  }
}
