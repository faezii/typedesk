import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/db/base", () => ({ basePrisma: { user: { findUnique: vi.fn() } } }));

const { auth } = await import("@/auth");
const { basePrisma } = await import("@/lib/db/base");
const { getCurrentUser } = await import("./session");

const dbUser = { id: "u1", isActive: true, sessionVersion: 2, organizationId: "org1", organization: { name: "C", status: "ACTIVE", trialEndsAt: null } };
const signedInWith = (sessionVersion: number) => vi.mocked(auth as unknown as () => Promise<unknown>).mockResolvedValue({ user: { id: "u1", sessionVersion } });

describe("getCurrentUser and sessionVersion", () => {
  beforeEach(() => vi.mocked(basePrisma.user.findUnique).mockResolvedValue(dbUser as never));

  it("keeps a session whose version matches the database", async () => {
    signedInWith(2);
    expect(await getCurrentUser()).toMatchObject({ id: "u1" });
  });

  it("signs out a session from before the last password change, reset or deactivation", async () => {
    signedInWith(1);
    expect(await getCurrentUser()).toBeNull();
  });
});
