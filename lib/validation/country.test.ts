import { describe, expect, it } from "vitest";
import { expiryStatus } from "../expiry";
import { customerSchema } from "./customer";
import { normalizeNationalId, normalizePhone, normalizeTaxNo } from "./country";

describe("normalizePhone (Qatar)", () => {
  it.each([
    ["55123456", "+974 5512 3456"],
    ["+974 5512 3456", "+974 5512 3456"],
    ["00974-3312-3456", "+974 3312 3456"],
    ["97466112222", "+974 6611 2222"],
    ["4412 3456", "+974 4412 3456"],
  ])("%s → %s", (input, out) => expect(normalizePhone(input)).toBe(out));

  it.each(["12345", "+971 50 123 4567", "0501234567", "21234567", "5512345678", ""])("rejects %s", (input) => expect(normalizePhone(input)).toBeNull());
});

describe("normalizeNationalId (QID)", () => {
  it("keeps 11 digits", () => expect(normalizeNationalId("28463412345")).toBe("28463412345"));
  it("drops spaces and dashes", () => expect(normalizeNationalId("284 634-12345")).toBe("28463412345"));
  it("rejects wrong length or letters", () => {
    expect(normalizeNationalId("2846341234")).toBeNull();
    expect(normalizeNationalId("784198012345671")).toBeNull();
    expect(normalizeNationalId("2846341234A")).toBeNull();
  });
});

describe("normalizeTaxNo", () => {
  it("upper-cases and tidies spaces", () => expect(normalizeTaxNo(" cr  12345 ")).toBe("CR 12345"));
  it("rejects too short or odd characters", () => {
    expect(normalizeTaxNo("12")).toBeNull();
    expect(normalizeTaxNo("12345#")).toBeNull();
  });
});

describe("expiryStatus (Asia/Qatar days)", () => {
  // 2026-10-24 09:00 in Doha
  const now = new Date("2026-10-24T06:00:00Z");
  it("yesterday is expired", () => expect(expiryStatus(new Date("2026-10-23T12:00:00Z"), now)).toBe("expired"));
  it("today counts as expiring, not expired", () => expect(expiryStatus(new Date("2026-10-23T21:30:00Z"), now)).toBe("expiring"));
  it("30 days out is expiring", () => expect(expiryStatus(new Date("2026-11-23T10:00:00Z"), now)).toBe("expiring"));
  it("31 days out is valid", () => expect(expiryStatus(new Date("2026-11-25T10:00:00Z"), now)).toBe("valid"));
});

describe("customerSchema", () => {
  const base = {
    type: "INDIVIDUAL" as const,
    name: "Aisha Haddad",
    companyName: "",
    phone: "55123456",
    email: "",
    nationality: "",
    taxNo: "",
    nationalId: "",
    nationalIdExpiry: "",
    passportNo: "",
    passportExpiry: "",
    notes: "",
  };

  it("normalises and nulls empty fields", () => {
    const r = customerSchema.parse({ ...base, passportNo: "n 1234567", email: "A@B.QA" });
    expect(r).toMatchObject({ phone: "+974 5512 3456", passportNo: "N1234567", email: "a@b.qa", nationalId: null, taxNo: null });
  });

  it("requires company name for companies", () => {
    const r = customerSchema.safeParse({ ...base, type: "COMPANY" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["companyName"]);
  });

  it("rejects a malformed QID", () => {
    expect(customerSchema.safeParse({ ...base, nationalId: "123" }).success).toBe(false);
  });
});
