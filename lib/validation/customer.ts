import { z } from "zod";
import { normalizeEmiratesId, normalizeTrn, normalizeUaePhone } from "./uae";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

/** "" → null; "yyyy-mm-dd" kept as-is (converted to a Dubai-midnight Date on the server). */
const optionalDate = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use a valid date")
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
        const n = normalizeUaePhone(v);
        if (!n) ctx.addIssue({ code: "custom", message: "Use a UAE number, e.g. +971 50 123 4567" });
        return n ?? v;
      }),
    email: z
      .string()
      .trim()
      .refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email")
      .transform((v) => v.toLowerCase() || null),
    nationality: optionalText(60),
    trn: z
      .string()
      .trim()
      .transform((v, ctx) => {
        if (!v) return null;
        const n = normalizeTrn(v);
        if (!n) ctx.addIssue({ code: "custom", message: "TRN must be 15 digits" });
        return n ?? v;
      }),
    emiratesId: z
      .string()
      .trim()
      .transform((v, ctx) => {
        if (!v) return null;
        const n = normalizeEmiratesId(v);
        if (!n) ctx.addIssue({ code: "custom", message: "Format: 784-XXXX-XXXXXXX-X" });
        return n ?? v;
      }),
    emiratesIdExpiry: optionalDate,
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
