import { describe, expect, it } from "vitest";
import { amountInWords, computeTotals, paymentStatus } from "./invoice-math";
import { documentSchema } from "./validation/finance";

describe("computeTotals", () => {
  it("6 pages × 120 + 2 × 35 at 5% VAT", () => {
    const t = computeTotals(
      [
        { quantity: "6", unitPrice: "120" },
        { quantity: "2", unitPrice: "35" },
      ],
      "0.05",
    );
    expect(t.lines.map((l) => l.lineTotal.toFixed(2))).toEqual(["720.00", "70.00"]);
    expect([t.subtotal, t.vatAmount, t.totalAmount].map((d) => d.toFixed(2))).toEqual(["790.00", "39.50", "829.50"]);
  });
  it("per-word pricing rounds each line to fils, VAT half-up", () => {
    const t = computeTotals([{ quantity: "2481", unitPrice: "0.35" }], "0.05");
    expect(t.subtotal.toFixed(2)).toBe("868.35");
    expect(t.vatAmount.toFixed(2)).toBe("43.42"); // 43.4175 → 43.42
    expect(t.totalAmount.toFixed(2)).toBe("911.77");
  });
  it("respects a different VAT rate from settings", () => expect(computeTotals([{ quantity: "1", unitPrice: "100" }], "0").totalAmount.toFixed(2)).toBe("100.00"));
});

describe("paymentStatus", () => {
  it("unpaid / partial / paid", () => {
    expect(paymentStatus("829.50", "0")).toBe("UNPAID");
    expect(paymentStatus("829.50", "400")).toBe("PARTIAL");
    expect(paymentStatus("829.50", "829.50")).toBe("PAID");
  });
  it("cancelled stays cancelled", () => expect(paymentStatus("100", "100", "CANCELLED")).toBe("CANCELLED"));
});

describe("amountInWords", () => {
  it.each([
    ["829.50", "UAE Dirhams Eight Hundred and Twenty-Nine and Fils Fifty Only"],
    ["1250", "UAE Dirhams One Thousand Two Hundred and Fifty Only"],
    ["15000.05", "UAE Dirhams Fifteen Thousand and Fils Five Only"],
    ["1000000", "UAE Dirhams One Million Only"],
    ["0.99", "UAE Dirhams Zero and Fils Ninety-Nine Only"],
    ["2014.10", "UAE Dirhams Two Thousand Fourteen and Fils Ten Only"],
  ])("%s", (n, words) => expect(amountInWords(n)).toBe(words));
});

describe("documentSchema", () => {
  const line = { description: "Legal translation", serviceId: "", workOrderId: "", quantity: "6", unitPrice: "120" };
  const ok = { customerId: "c1", issueDate: "2026-10-25", dueDate: "2026-11-09", notes: "", items: [line] };
  it("accepts a valid invoice", () => expect(documentSchema.safeParse(ok).success).toBe(true));
  it("needs at least one line", () => expect(documentSchema.safeParse({ ...ok, items: [] }).success).toBe(false));
  it("rejects a due date before issue", () => expect(documentSchema.safeParse({ ...ok, dueDate: "2026-10-01" }).success).toBe(false));
  it("rejects zero quantity", () => expect(documentSchema.safeParse({ ...ok, items: [{ ...line, quantity: "0" }] }).success).toBe(false));
});
