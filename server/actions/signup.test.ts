import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/email", () => ({ emailConfigured: () => true, appUrl: () => "http://test", sendEmail: vi.fn() }));
vi.mock("@/lib/turnstile", () => ({ turnstileConfigured: () => true, verifyTurnstile: vi.fn(async () => false) }));
vi.mock("@/lib/auth/rate-limit", () => ({ clientIp: async () => "203.0.113.9", rateLimited: vi.fn(async () => false) }));
vi.mock("@/lib/db/base", () => ({ basePrisma: { user: { findUnique: vi.fn() }, organization: { create: vi.fn() }, activityLog: { create: vi.fn() } } }));

const { signUp } = await import("./signup");
const { basePrisma } = await import("@/lib/db/base");
const { verifyTurnstile } = await import("@/lib/turnstile");

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}
const valid = { center: "Al Noor Typing", name: "Noor", email: "owner@alnoor.test", phone: "", password: "Noor2026pass", confirm: "Noor2026pass" };

describe("signUp", () => {
  it("rejects a sign-up whose Turnstile check fails, before touching the database", async () => {
    const res = await signUp({}, form({ ...valid, "cf-turnstile-response": "forged-token" }));
    expect(res.done).toBeUndefined();
    expect(res.error).toBe("Please complete the security check and try again.");
    expect(verifyTurnstile).toHaveBeenCalledWith("forged-token", "203.0.113.9");
    expect(basePrisma.organization.create).not.toHaveBeenCalled();
    expect(basePrisma.user.findUnique).not.toHaveBeenCalled();
  });
});
