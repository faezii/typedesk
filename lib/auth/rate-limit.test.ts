import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/base", () => ({ basePrisma: {} }));
const { overLimit } = await import("./rate-limit");

/** In-memory stand-in for the RateLimit table. */
function fakeDb() {
  const rows: { key: string; createdAt: Date }[] = [];
  return {
    rows,
    rateLimit: {
      count: async ({ where }: { where: { key: string; createdAt: { gt: Date } } }) => rows.filter((r) => r.key === where.key && r.createdAt > where.createdAt.gt).length,
      create: async ({ data }: { data: { key: string } }) => void rows.push({ key: data.key, createdAt: now }),
      deleteMany: async ({ where }: { where: { createdAt: { lt: Date } } }) => {
        const keep = rows.filter((r) => r.createdAt >= where.createdAt.lt);
        rows.splice(0, rows.length, ...keep);
      },
    },
  };
}
let now = new Date("2026-11-22T10:00:00Z");
const HOUR = 60 * 60 * 1000;

describe("overLimit", () => {
  it("allows the limit, then blocks, per key", async () => {
    const db = fakeDb() as never;
    for (let i = 0; i < 3; i++) expect(await overLimit(db, "signup:1.1.1.1", 3, HOUR, now)).toBe(false);
    expect(await overLimit(db, "signup:1.1.1.1", 3, HOUR, now)).toBe(true);
    expect(await overLimit(db, "signup:2.2.2.2", 3, HOUR, now)).toBe(false); // another IP has its own count
  });

  it("forgets attempts outside the window and cleans up day-old rows", async () => {
    const db = fakeDb();
    for (let i = 0; i < 3; i++) await overLimit(db as never, "k", 3, HOUR, now);
    now = new Date(now.getTime() + 2 * HOUR);
    expect(await overLimit(db as never, "k", 3, HOUR, now)).toBe(false);
    now = new Date(now.getTime() + 25 * HOUR);
    await overLimit(db as never, "k", 3, HOUR, now);
    expect(db.rows).toHaveLength(1);
  });
});
