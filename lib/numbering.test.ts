import { describe, expect, it } from "vitest";
import type { Tx } from "./prisma";
import { nextNumber } from "./numbering";

/** In-memory stand-in for the Counter upsert-increment. */
function fakeTx() {
  const rows = new Map<string, number>();
  const counter = {
    upsert: async ({ where, create }: { where: { organizationId_key: { organizationId: string; key: string } }; create: { value: number } }) => {
      const k = `${where.organizationId_key.organizationId}/${where.organizationId_key.key}`;
      const value = rows.has(k) ? rows.get(k)! + 1 : create.value;
      rows.set(k, value);
      return { value };
    },
  };
  return { tx: { counter } as unknown as Tx, rows };
}

describe("nextNumber", () => {
  const now = new Date("2026-10-25T08:00:00Z");

  it("counts up per prefix, zero-padded", async () => {
    const { tx } = fakeTx();
    expect(await nextNumber(tx, "org1", "INV", now)).toBe("INV-2026-0001");
    expect(await nextNumber(tx, "org1", "INV", now)).toBe("INV-2026-0002");
    expect(await nextNumber(tx, "org1", "WO", now)).toBe("WO-2026-0001");
  });

  it("starts a new sequence on 1 January in Doha, not UTC", async () => {
    const { tx, rows } = fakeTx();
    await nextNumber(tx, "org1", "QT", new Date("2026-12-31T20:59:00Z")); // 23:59 Doha
    expect(await nextNumber(tx, "org1", "QT", new Date("2026-12-31T21:01:00Z"))).toBe("QT-2027-0001"); // 00:01 Doha
    expect([...rows.keys()]).toEqual(["org1/QT-2026", "org1/QT-2027"]);
  });

  it("keeps growing past 9999", async () => {
    const { tx, rows } = fakeTx();
    rows.set("org1/INV-2026", 9999);
    expect(await nextNumber(tx, "org1", "INV", now)).toBe("INV-2026-10000");
  });

  it("numbers each center separately", async () => {
    const { tx } = fakeTx();
    expect(await nextNumber(tx, "org1", "INV", now)).toBe("INV-2026-0001");
    expect(await nextNumber(tx, "org2", "INV", now)).toBe("INV-2026-0001");
    expect(await nextNumber(tx, "org1", "INV", now)).toBe("INV-2026-0002");
  });
});
