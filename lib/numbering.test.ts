import { describe, expect, it } from "vitest";
import type { Prisma } from "@prisma/client";
import { nextNumber } from "./numbering";

/** In-memory stand-in for the Counter upsert-increment. */
function fakeTx() {
  const rows = new Map<string, number>();
  const counter = {
    upsert: async ({ where, create }: { where: { key: string }; create: { value: number } }) => {
      const value = rows.has(where.key) ? rows.get(where.key)! + 1 : create.value;
      rows.set(where.key, value);
      return { value };
    },
  };
  return { tx: { counter } as unknown as Prisma.TransactionClient, rows };
}

describe("nextNumber", () => {
  const now = new Date("2026-10-25T08:00:00Z");

  it("counts up per prefix, zero-padded", async () => {
    const { tx } = fakeTx();
    expect(await nextNumber(tx, "INV", now)).toBe("INV-2026-0001");
    expect(await nextNumber(tx, "INV", now)).toBe("INV-2026-0002");
    expect(await nextNumber(tx, "WO", now)).toBe("WO-2026-0001");
  });

  it("starts a new sequence on 1 January in Dubai, not UTC", async () => {
    const { tx, rows } = fakeTx();
    await nextNumber(tx, "QT", new Date("2026-12-31T19:59:00Z")); // 23:59 Dubai
    expect(await nextNumber(tx, "QT", new Date("2026-12-31T20:01:00Z"))).toBe("QT-2027-0001"); // 00:01 Dubai
    expect([...rows.keys()]).toEqual(["QT-2026", "QT-2027"]);
  });

  it("keeps growing past 9999", async () => {
    const { tx, rows } = fakeTx();
    rows.set("INV-2026", 9999);
    expect(await nextNumber(tx, "INV", now)).toBe("INV-2026-10000");
  });
});
