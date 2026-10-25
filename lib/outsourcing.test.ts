import { describe, expect, it } from "vitest";
import { jobMargin } from "./money";
import { assignmentSchema, vendorSchema } from "./validation/outsourcing";

describe("jobMargin", () => {
  it("order 1,200 − cost 450 = 750 (62.5%)", () => {
    const r = jobMargin("1200.00", "450.00");
    expect(r.margin.toFixed(2)).toBe("750.00");
    expect(r.pct).toBe(62.5);
  });
  it("negative when the vendor costs more than the order", () => expect(jobMargin("300", "450").margin.toFixed(2)).toBe("-150.00"));
  it("no percentage for a zero-value order", () => expect(jobMargin("0", "50").pct).toBeNull());
});

describe("assignmentSchema", () => {
  const ok = { workOrderId: "w1", vendorId: "v1", description: "Translate Russian contract", agreementCost: "450", sentAt: "2026-10-20", dueAt: "2026-10-23" };
  it("accepts a valid assignment", () => expect(assignmentSchema.safeParse(ok).success).toBe(true));
  it("rejects due before sent", () => expect(assignmentSchema.safeParse({ ...ok, dueAt: "2026-10-19" }).success).toBe(false));
  it("rejects a malformed cost", () => expect(assignmentSchema.safeParse({ ...ok, agreementCost: "4,50" }).success).toBe(false));
  it("requires a sent date", () => expect(assignmentSchema.safeParse({ ...ok, sentAt: "" }).success).toBe(false));
});

describe("vendorSchema", () => {
  const base = { name: "Elena Sokolova", type: "FREELANCER" as const, phone: "", email: "", languages: ["Russian"], notes: "" };
  it("normalises Qatar numbers and keeps international ones", () => {
    expect(vendorSchema.parse({ ...base, phone: "55123456" }).phone).toBe("+974 5512 3456");
    expect(vendorSchema.parse({ ...base, phone: "+7 912 345 6789" }).phone).toBe("+7 912 345 6789");
  });
  it("rejects junk phone numbers", () => expect(vendorSchema.safeParse({ ...base, phone: "call me" }).success).toBe(false));
});
