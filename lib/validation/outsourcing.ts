import { z } from "zod";
import { parseDateInput } from "../dates";
import { normalizeUaePhone } from "./uae";
import { DECIMAL_RE } from "./work-order";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

const dateInput = z.string().trim().refine((v) => v === "" || parseDateInput(v) !== null, "Use a valid date");

export const vendorSchema = z.object({
  name: z.string().trim().min(2, "Enter the vendor's name").max(120),
  type: z.enum(["FREELANCER", "AGENCY"]),
  phone: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (!v) return null;
      // Freelancers are often abroad, so accept international numbers as typed.
      const uae = normalizeUaePhone(v);
      if (uae) return uae;
      if (!/^\+?[\d\s()-]{7,20}$/.test(v)) ctx.addIssue({ code: "custom", message: "Enter a valid phone number" });
      return v;
    }),
  email: z
    .string()
    .trim()
    .refine((v) => v === "" || z.email().safeParse(v).success, "Enter a valid email")
    .transform((v) => v.toLowerCase() || null),
  languages: z.array(z.string().trim().min(1).max(40)).max(20),
  notes: optionalText(1000),
});
export type VendorFormValues = z.input<typeof vendorSchema>;

export const assignmentSchema = z
  .object({
    workOrderId: z.string().min(1, "Choose the work order"),
    vendorId: z.string().min(1, "Choose a vendor"),
    description: z.string().trim().min(3, "Describe what was outsourced").max(500),
    agreementCost: z
      .string()
      .trim()
      .refine((v) => DECIMAL_RE.test(v), "Enter the agreed amount, e.g. 450"),
    sentAt: dateInput.refine((v) => v !== "", "Choose the date it was sent"),
    dueAt: dateInput,
  })
  .refine((v) => !v.dueAt || v.dueAt >= v.sentAt, { path: ["dueAt"], message: "Due date can't be before the sent date" });
export type AssignmentFormValues = z.input<typeof assignmentSchema>;
