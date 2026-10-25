import type { Prisma } from "@prisma/client";
import { formatDubai } from "./dates";

type Money = Prisma.Decimal | number | string | null | undefined;

const aed = new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const aedCompact = new Intl.NumberFormat("en-AE", { notation: "compact", maximumFractionDigits: 1 });

/** "AED 1,234.50" — display only; never feed the result back into calculations. */
export const formatAED = (v: Money) => aed.format(Number(v ?? 0));
/** "12.4K" — for axis ticks. */
export const formatCompact = (v: number) => aedCompact.format(v);

/** "Saeed Al Falasi" → "SA" */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

export const formatDate =(d: Date | null | undefined) => (d ? formatDubai(d, "d MMM yyyy") : "—");
export const formatDateTime = (d: Date | null | undefined) => (d ? formatDubai(d, "d MMM yyyy, h:mm a") : "—");
