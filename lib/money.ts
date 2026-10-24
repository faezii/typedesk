import { Prisma } from "@prisma/client";

/** quantity × unit price, rounded half-up to fils. Server-side only (exact decimal math). */
export function lineTotal(quantity: Prisma.Decimal.Value, unitPrice: Prisma.Decimal.Value) {
  return new Prisma.Decimal(quantity).times(unitPrice).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}
