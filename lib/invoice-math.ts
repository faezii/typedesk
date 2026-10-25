import { Prisma, type InvoiceStatus } from "@prisma/client";

type D = Prisma.Decimal.Value;
const dec = (v: D) => new Prisma.Decimal(v);
const round2 = (v: Prisma.Decimal) => v.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

/**
 * Invoice / quotation totals. Each line is rounded to 2 decimals, VAT is charged on the subtotal
 * (one VAT amount per invoice) and rounded half-up. Server-side only.
 */
export function computeTotals<L extends { quantity: D; unitPrice: D }>(lines: L[], vatRate: D) {
  const priced = lines.map((l) => ({ ...l, lineTotal: round2(dec(l.quantity).times(l.unitPrice)) }));
  const subtotal = priced.reduce((s, l) => s.plus(l.lineTotal), dec(0));
  const vatAmount = round2(subtotal.times(vatRate));
  return { lines: priced, subtotal, vatAmount, totalAmount: subtotal.plus(vatAmount) };
}

/** Status after payments (cancelled invoices stay cancelled). */
export function paymentStatus(total: D, paid: D, current?: InvoiceStatus): InvoiceStatus {
  if (current === "CANCELLED") return "CANCELLED";
  if (dec(paid).gte(total) && dec(total).gt(0)) return "PAID";
  return dec(paid).gt(0) ? "PARTIAL" : "UNPAID";
}

// ───────────── Amount in words (for the tax invoice) ─────────────

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const rest = r < 20 ? ONES[r] : `${TENS[Math.floor(r / 10)]}${r % 10 ? `-${ONES[r % 10]}` : ""}`;
  return [h ? `${ONES[h]} Hundred` : "", rest].filter(Boolean).join(" and ");
}

function integerWords(n: number): string {
  if (n === 0) return "Zero";
  const parts: string[] = [];
  for (const [size, name] of [[1e9, "Billion"], [1e6, "Million"], [1e3, "Thousand"], [1, ""]] as const) {
    const chunk = Math.floor(n / size) % 1000;
    if (chunk) parts.push(`${below1000(chunk)}${name ? ` ${name}` : ""}`);
  }
  return parts.join(" ");
}

/** 1250.25 → "Qatari Riyals One Thousand Two Hundred and Fifty and Dirhams Twenty-Five Only" */
export function amountInWords(amount: D): string {
  const v = round2(dec(amount));
  const riyals = v.floor().toNumber();
  const f = v.minus(v.floor()).times(100).round().toNumber();
  return `Qatari Riyals ${integerWords(riyals)}${f ? ` and Dirhams ${integerWords(f)}` : ""} Only`;
}
