import "server-only";

/** Email goes out through Resend's HTTP API. Without RESEND_API_KEY, development prints it to the console instead. */
export const emailConfigured = () => !!process.env.RESEND_API_KEY || process.env.NODE_ENV !== "production";

/** Base URL for links in emails. Fixed by APP_URL (never taken from the request's Host header, which a client controls). */
export const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");

export async function sendEmail(msg: { to: string; subject: string; text: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") throw new Error("RESEND_API_KEY is not set");
    console.info(`[email] to ${msg.to} · ${msg.subject}\n${msg.text}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "TypeDesk <onboarding@resend.dev>", to: [msg.to], subject: msg.subject, text: msg.text }),
  });
  if (!res.ok) throw new Error(`Email to ${msg.to} failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
}
