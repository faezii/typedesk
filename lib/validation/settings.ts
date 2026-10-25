import { z } from "zod";
import { normalizeTaxNo, normalizePhone } from "./country";

/** "" stays "" (not set); anything else must normalise. */
const optional = (normalize: (v: string) => string | null, message: string) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (!v) return "";
      const n = normalize(v);
      if (!n) ctx.addIssue({ code: "custom", message });
      return n ?? v;
    });

/** Company details, VAT rate and invoice terms — shared by the Settings form and its server action. */
export const settingsSchema = z.object({
  companyName: z.string().trim().min(2, "Enter the company name").max(160),
  companyTaxNo: optional(normalizeTaxNo, "Use 3–20 letters, digits, spaces, / or -"),
  companyPhone: optional(normalizePhone, "Use a Qatar number, e.g. +974 4412 3456"),
  companyEmail: z
    .string()
    .trim()
    .refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email")
    .transform((v) => v.toLowerCase()),
  companyAddress: z.string().trim().max(300),
  /** Percent as typed ("5"); the server stores it as a fraction ("0.05"). */
  vatPercent: z
    .string()
    .trim()
    .refine((v) => /^\d{1,2}(\.\d{1,2})?$/.test(v), "Enter a percentage from 0 to 99.99, e.g. 5"),
  invoiceTerms: z.string().trim().max(1000),
});

export type SettingsFormValues = z.input<typeof settingsSchema>;
