import { z } from "zod";
import { parseDateTimeInput } from "../dates";

/** Up to 9 digits with at most 2 decimals — used for both QAR amounts and quantities. */
export const DECIMAL_RE = /^\d{1,9}(\.\d{1,2})?$/;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

const count = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{1,7}$/.test(v), "Whole number")
  .transform((v) => (v === "" ? 0 : Number(v)));

/** Shared by the work order sheet and the server action. Numbers stay strings until validated. */
export const workOrderSchema = z.object({
  customerId: z.string().min(1, "Choose a customer"),
  serviceId: z.string().min(1, "Choose a service"),
  quantity: z
    .string()
    .trim()
    .refine((v) => DECIMAL_RE.test(v) && Number(v) > 0, "Enter a quantity above 0"),
  unitPrice: z
    .string()
    .trim()
    .refine((v) => DECIMAL_RE.test(v), "Enter an amount, e.g. 120 or 0.35"),
  priority: z.enum(["NORMAL", "HIGH", "URGENT"]),
  deadline: z
    .string()
    .trim()
    .refine((v) => v === "" || parseDateTimeInput(v) !== null, "Use a valid date and time"),
  assignedToId: z.string().transform((v) => v || null),
  notes: optionalText(2000),
  // Only used when the chosen service is a translation service (checked on the server).
  translation: z.object({
    sourceLang: z.string().trim().max(40),
    targetLang: z.string().trim().max(40),
    pageCount: count,
    wordCount: count,
    isCertified: z.boolean(),
  }),
});

export type WorkOrderFormValues = z.input<typeof workOrderSchema>;
export type WorkOrderData = z.output<typeof workOrderSchema>;

export const serviceSchema = z.object({
  title: z.string().trim().min(2, "Enter a title").max(120),
  category: z.enum(["LEGAL_TRANSLATION", "GENERAL_TRANSLATION", "TYPING", "ATTESTATION", "COURT_SUBMISSION", "COMPANY_FORMATION", "PRO_SERVICES", "EMBASSY_SERVICES", "DOCUMENTATION", "OTHER"]),
  unit: z.enum(["PAGE", "WORD", "DOCUMENT", "HOUR", "SERVICE"]),
  defaultPrice: z
    .string()
    .trim()
    .refine((v) => DECIMAL_RE.test(v), "Enter an amount, e.g. 120 or 0.35"),
  description: optionalText(500),
});

export type ServiceFormValues = z.input<typeof serviceSchema>;
