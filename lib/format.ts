import type { Prisma } from "@prisma/client";
import { formatLocal } from "./dates";

type Money = Prisma.Decimal | number | string | null | undefined;

const money = new Intl.NumberFormat("en-QA", { style: "currency", currency: "QAR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat("en-QA", { notation: "compact", maximumFractionDigits: 1 });

/** "QAR 1,234.50" — display only; never feed the result back into calculations. */
export const formatMoney = (v: Money) => money.format(Number(v ?? 0));
/** "12.4K" — for axis ticks. */
export const formatCompact = (v: number) => compact.format(v);

/** "Saeed Al Falasi" → "SA" */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

export const formatDate =(d: Date | null | undefined) => (d ? formatLocal(d, "d MMM yyyy") : "—");
export const formatDateTime = (d: Date | null | undefined) => (d ? formatLocal(d, "d MMM yyyy, h:mm a") : "—");
