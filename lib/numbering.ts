import type { Tx } from "./prisma";
import { formatLocal } from "./dates";

/**
 * Next document number, e.g. "WO-2026-0042". Atomic: the upsert-increment takes a row
 * lock, so concurrent requests inside transactions never get the same number.
 */
export async function nextNumber(tx: Tx, organizationId: string, prefix: "WO" | "INV" | "QT", now = new Date()) {
  const year = Number(formatLocal(now, "yyyy"));
  const key = `${prefix}-${year}`;
  const { value } = await tx.counter.upsert({
    where: { organizationId_key: { organizationId, key } }, // each center numbers from 0001
    create: { key, year, value: 1 },
    update: { value: { increment: 1 } },
  });
  return formatNumber(prefix, year, value);
}

export const formatNumber = (prefix: string, year: number, value: number) => `${prefix}-${year}-${String(value).padStart(4, "0")}`;
