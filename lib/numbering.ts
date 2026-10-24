import type { Prisma } from "@prisma/client";
import { formatDubai } from "./dates";

/**
 * Next document number, e.g. "WO-2026-0042". Atomic: the upsert-increment takes a row
 * lock, so concurrent requests inside transactions never get the same number.
 */
export async function nextNumber(tx: Prisma.TransactionClient, prefix: "WO" | "INV" | "QT", now = new Date()) {
  const year = Number(formatDubai(now, "yyyy"));
  const key = `${prefix}-${year}`;
  const { value } = await tx.counter.upsert({
    where: { key },
    create: { key, year, value: 1 },
    update: { value: { increment: 1 } },
  });
  return formatNumber(prefix, year, value);
}

export const formatNumber = (prefix: string, year: number, value: number) => `${prefix}-${year}-${String(value).padStart(4, "0")}`;
