import { Prisma } from "@prisma/client";

/** What the centre keeps on an outsourced job: order amount − vendor cost, and as % of the order (null if the order is free). */
export function jobMargin(orderAmount: Prisma.Decimal.Value, cost: Prisma.Decimal.Value) {
  const amount = new Prisma.Decimal(orderAmount);
  const margin = amount.minus(cost);
  return { margin, pct: amount.isZero() ? null : margin.div(amount).times(100).toDecimalPlaces(1).toNumber() };
}

/** quantity × unit price, rounded half-up to fils. Server-side only (exact decimal math). */
export function lineTotal(quantity: Prisma.Decimal.Value, unitPrice: Prisma.Decimal.Value) {
  return new Prisma.Decimal(quantity).times(unitPrice).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}
