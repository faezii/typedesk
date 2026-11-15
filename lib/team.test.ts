import { describe, expect, it } from "vitest";
import { followUpGroup, snoozedDeadline } from "./follow-ups";
import { generateTempPassword } from "./passwords";
import { employeeSchema, passwordChangeSchema } from "./validation/team";

const now = new Date("2026-10-25T06:00:00Z"); // Sun 25 Oct, 09:00 Doha

describe("followUpGroup (Doha days)", () => {
  it("yesterday → overdue", () => expect(followUpGroup(new Date("2026-10-24T08:00:00Z"), now)).toBe("overdue"));
  it("earlier today is still today, not overdue", () => expect(followUpGroup(new Date("2026-10-25T02:00:00Z"), now)).toBe("today"));
  it("late tonight Doha → today", () => expect(followUpGroup(new Date("2026-10-25T19:30:00Z"), now)).toBe("today"));
  it("in 7 days → this week", () => expect(followUpGroup(new Date("2026-11-01T08:00:00Z"), now)).toBe("week"));
  it("in 8 days → later", () => expect(followUpGroup(new Date("2026-11-02T08:00:00Z"), now)).toBe("later"));
});

describe("snoozedDeadline", () => {
  it("overdue items move to 7 days from today", () =>
    expect(snoozedDeadline(new Date("2026-10-01T08:00:00Z"), now).toISOString()).toBe("2026-10-31T21:00:00.000Z"));
  it("future items move 7 days past their deadline", () =>
    expect(snoozedDeadline(new Date("2026-11-10T08:00:00Z"), now).toISOString()).toBe("2026-11-17T08:00:00.000Z"));
});

describe("generateTempPassword", () => {
  it("is 12 unambiguous chars with a letter and a digit", () => {
    for (let i = 0; i < 200; i++) {
      const pw = generateTempPassword();
      expect(pw).toMatch(/^[A-HJ-NP-Za-km-z2-9]{12}$/);
      expect(pw).toMatch(/\d/);
      expect(pw).toMatch(/[A-Za-z]/);
    }
  });
  it("does not repeat", () => expect(new Set(Array.from({ length: 100 }, () => generateTempPassword())).size).toBe(100));
});

describe("employeeSchema", () => {
  it("lowercases email and normalises phone", () =>
    expect(employeeSchema.parse({ name: "Sara Ali", email: " Sara@TypeDesk.QA ", phone: "55123456", role: "STAFF", department: "TYPING" })).toMatchObject({
      email: "sara@typedesk.qa",
      phone: "+974 5512 3456",
    }));
  it("allows an empty phone", () =>
    expect(employeeSchema.parse({ name: "Sara Ali", email: "s@t.qa", phone: "", role: "STAFF", department: "TYPING" }).phone).toBeNull());
});

describe("passwordChangeSchema", () => {
  const ok = { current: "Password123!", next: "new-secret-42", confirm: "new-secret-42" };
  it("accepts a good change", () => expect(passwordChangeSchema.safeParse(ok).success).toBe(true));
  it("rejects short, digit-less, mismatched or unchanged passwords", () => {
    expect(passwordChangeSchema.safeParse({ ...ok, next: "short12", confirm: "short12" }).success).toBe(false); // 7 chars
    expect(passwordChangeSchema.safeParse({ ...ok, next: "eight8ch", confirm: "eight8ch" }).success).toBe(true); // 8 chars is enough
    expect(passwordChangeSchema.safeParse({ ...ok, next: "nodigitsatall", confirm: "nodigitsatall" }).success).toBe(false);
    expect(passwordChangeSchema.safeParse({ ...ok, confirm: "different-42" }).success).toBe(false);
    expect(passwordChangeSchema.safeParse({ current: "same-pass-123", next: "same-pass-123", confirm: "same-pass-123" }).success).toBe(false);
  });
});
