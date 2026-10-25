import { z } from "zod";
import { parseDateInput } from "../dates";
import { normalizeNationalId, normalizeTaxNo, normalizePhone } from "./country";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

/** "" → null; "yyyy-mm-dd" kept as-is (converted to a Doha-midnight Date on the server). */
const optionalDate = z
  .string()
  .trim()
  .refine((v) => v === "" || parseDateInput(v) !== null, "Use a valid date")
  .transform((v) => v || null);

/** Shared by the client form (react-hook-form) and the server action. */
export const customerSchema = z
  .object({
    type: z.enum(["INDIVIDUAL", "COMPANY"]),
    name: z.string().trim().min(2, "Enter the customer's name").max(120),
    companyName: optionalText(160),
    phone: z
      .string()
      .trim()
      .min(1, "Enter a phone number")
      .transform((v, ctx) => {
        const n = normalizePhone(v);
        if (!n) ctx.addIssue({ code: "custom", message: "Use a Qatar number, e.g. +974 5512 3456" });
        return n ?? v;
      }),
    email: z
      .string()
      .trim()
      .refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email")
      .transform((v) => v.toLowerCase() || null),
    nationality: optionalText(60),
    taxNo: z
      .string()
      .trim()
      .transform((v, ctx) => {
        if (!v) return null;
        const n = normalizeTaxNo(v);
        if (!n) ctx.addIssue({ code: "custom", message: "Use 3–20 letters, digits, spaces, / or -" });
        return n ?? v;
      }),
    nationalId: z
      .string()
      .trim()
      .transform((v, ctx) => {
        if (!v) return null;
        const n = normalizeNationalId(v);
        if (!n) ctx.addIssue({ code: "custom", message: "QID must be 11 digits" });
        return n ?? v;
      }),
    nationalIdExpiry: optionalDate,
    passportNo: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase().replace(/\s+/g, "") || null)
      .refine((v) => v === null || /^[A-Z0-9]{5,15}$/.test(v), "Passport number: 5–15 letters/digits"),
    passportExpiry: optionalDate,
    notes: optionalText(2000),
  })
  .refine((c) => c.type === "INDIVIDUAL" || !!c.companyName, { path: ["companyName"], message: "Enter the company name" });

export type CustomerFormValues = z.input<typeof customerSchema>;
export type CustomerData = z.output<typeof customerSchema>;
