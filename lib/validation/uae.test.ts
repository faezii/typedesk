import { describe, expect, it } from "vitest";
import { expiryStatus } from "../expiry";
import { customerSchema } from "./customer";
import { normalizeEmiratesId, normalizeUaePhone } from "./uae";

describe("normalizeUaePhone", () => {
  it.each([
    ["0501234567", "+971 50 123 4567"],
    ["+971 50 123 4567", "+971 50 123 4567"],
    ["00971-55-765-4321", "+971 55 765 4321"],
    ["971561112222", "+971 56 111 2222"],
    ["04 123 4567", "+971 4 123 4567"],
  ])("%s → %s", (input, out) => expect(normalizeUaePhone(input)).toBe(out));

  it.each(["12345", "+44 7700 900123", "0412345678901", ""])("rejects %s", (input) => expect(normalizeUaePhone(input)).toBeNull());
});

describe("normalizeEmiratesId", () => {
  it("formats 15 digits", () => expect(normalizeEmiratesId("784198012345671")).toBe("784-1980-1234567-1"));
  it("accepts already formatted", () => expect(normalizeEmiratesId("784-1980-1234567-1")).toBe("784-1980-1234567-1"));
  it("rejects wrong prefix / length", () => {
    expect(normalizeEmiratesId("785198012345671")).toBeNull();
    expect(normalizeEmiratesId("78419801234567")).toBeNull();
  });
});

describe("expiryStatus (Asia/Dubai days)", () => {
  // 2026-10-24 10:00 in Dubai
  const now = new Date("2026-10-24T06:00:00Z");
  it("yesterday is expired", () => expect(expiryStatus(new Date("2026-10-23T12:00:00Z"), now)).toBe("expired"));
  it("today counts as expiring, not expired", () => expect(expiryStatus(new Date("2026-10-23T20:30:00Z"), now)).toBe("expiring"));
  it("30 days out is expiring", () => expect(expiryStatus(new Date("2026-11-23T10:00:00Z"), now)).toBe("expiring"));
  it("31 days out is valid", () => expect(expiryStatus(new Date("2026-11-25T10:00:00Z"), now)).toBe("valid"));
});

describe("customerSchema", () => {
  const base = {
    type: "INDIVIDUAL" as const,
    name: "Aisha Haddad",
    companyName: "",
    phone: "0501234567",
    email: "",
    nationality: "",
    trn: "",
    emiratesId: "",
    emiratesIdExpiry: "",
    passportNo: "",
    passportExpiry: "",
    notes: "",
  };

  it("normalises and nulls empty fields", () => {
    const r = customerSchema.parse({ ...base, passportNo: "n 1234567", email: "A@B.AE" });
    expect(r).toMatchObject({ phone: "+971 50 123 4567", passportNo: "N1234567", email: "a@b.ae", emiratesId: null, trn: null });
  });

  it("requires company name for companies", () => {
    const r = customerSchema.safeParse({ ...base, type: "COMPANY" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["companyName"]);
  });

  it("rejects a malformed Emirates ID", () => {
    expect(customerSchema.safeParse({ ...base, emiratesId: "123" }).success).toBe(false);
  });
});
