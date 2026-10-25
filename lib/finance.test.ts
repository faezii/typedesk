import { describe, expect, it } from "vitest";
import { amountInWords, computeTotals, paymentStatus } from "./invoice-math";
import { documentSchema } from "./validation/finance";
import { settingsSchema } from "./validation/settings";

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
  it("per-word pricing rounds each line to 2 decimals, VAT half-up", () => {
    const t = computeTotals([{ quantity: "2481", unitPrice: "0.35" }], "0.05");
    expect(t.subtotal.toFixed(2)).toBe("868.35");
    expect(t.vatAmount.toFixed(2)).toBe("43.42"); // 43.4175 → 43.42
    expect(t.totalAmount.toFixed(2)).toBe("911.77");
  });
  it("respects a different VAT rate from settings", () => expect(computeTotals([{ quantity: "1", unitPrice: "100" }], "0").totalAmount.toFixed(2)).toBe("100.00"));
  it("VAT of exactly half a fil rounds up (no float drift)", () => {
    expect(computeTotals([{ quantity: "1", unitPrice: "0.30" }], "0.05").vatAmount.toFixed(2)).toBe("0.02"); // 0.015; as a float this would be 0.01
    expect(computeTotals([{ quantity: "3", unitPrice: "0.10" }], "0.05").vatAmount.toFixed(2)).toBe("0.02");
  });
  it("VAT is charged once on the subtotal, not per line", () => {
    // 3 × 0.30 = 0.90 → VAT 0.045 → 0.05. Rounding VAT per line would give 3 × 0.02 = 0.06.
    const t = computeTotals([0, 1, 2].map(() => ({ quantity: "1", unitPrice: "0.30" })), "0.05");
    expect(t.vatAmount.toFixed(2)).toBe("0.05");
  });
});

describe("settingsSchema VAT rate", () => {
  const base = { companyName: "TypeDesk", companyTaxNo: "", companyPhone: "", companyEmail: "", companyAddress: "", invoiceTerms: "" };
  it.each(["5", "0", "7.5", "12.25"])("accepts %s%%", (v) => expect(settingsSchema.safeParse({ ...base, vatPercent: v }).success).toBe(true));
  it.each(["", "100", "-5", "5%", "abc", "5.555", "0.05.1"])("rejects %j", (v) => expect(settingsSchema.safeParse({ ...base, vatPercent: v }).success).toBe(false));
  it("normalises tax no., phone and email", () => {
    const r = settingsSchema.parse({ ...base, vatPercent: "5", companyTaxNo: " cr  145236", companyPhone: "44331180", companyEmail: "Info@TypeDesk.qa" });
    expect([r.companyTaxNo, r.companyPhone, r.companyEmail]).toEqual(["CR 145236", "+974 4433 1180", "info@typedesk.qa"]);
  });
});

describe("paymentStatus", () => {
  it("unpaid / partial / paid", () => {
    expect(paymentStatus("829.50", "0")).toBe("UNPAID");
    expect(paymentStatus("829.50", "400")).toBe("PARTIAL");
    expect(paymentStatus("829.50", "829.50")).toBe("PAID");
  });
  it("cancelled stays cancelled", () => expect(paymentStatus("100", "100", "CANCELLED")).toBe("CANCELLED"));
  it("a fil short is still partial; overpaid counts as paid", () => {
    expect(paymentStatus("829.50", "829.49")).toBe("PARTIAL");
    expect(paymentStatus("829.50", "830")).toBe("PAID");
  });
  it("re-derives after a payment is removed", () => expect(paymentStatus("829.50", "0", "PAID")).toBe("UNPAID"));
});

describe("amountInWords", () => {
  it.each([
    ["829.50", "Qatari Riyals Eight Hundred and Twenty-Nine and Dirhams Fifty Only"],
    ["1250", "Qatari Riyals One Thousand Two Hundred and Fifty Only"],
    ["15000.05", "Qatari Riyals Fifteen Thousand and Dirhams Five Only"],
    ["1000000", "Qatari Riyals One Million Only"],
    ["0.99", "Qatari Riyals Zero and Dirhams Ninety-Nine Only"],
    ["2014.10", "Qatari Riyals Two Thousand Fourteen and Dirhams Ten Only"],
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
