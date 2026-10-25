import { z } from "zod";
import { parseDateInput, parseDateTimeInput } from "../dates";
import { normalizePhone } from "./country";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

const optionalDateTime = z
  .string()
  .trim()
  .refine((v) => v === "" || parseDateTimeInput(v) !== null, "Use a valid date and time");

export const taskSchema = z.object({
  title: z.string().trim().min(3, "Describe the task").max(200),
  description: optionalText(2000),
  priority: z.enum(["NORMAL", "HIGH", "URGENT"]),
  deadline: optionalDateTime,
  assignedToId: z.string().transform((v) => v || null),
  workOrderId: z.string().transform((v) => v || null),
});
export type TaskFormValues = z.input<typeof taskSchema>;

export const followUpSchema = z.object({
  title: z.string().trim().min(3, "Enter a title").max(200),
  type: z.enum(["PASSPORT_EXPIRY", "NATIONAL_ID_EXPIRY", "VISA_DEADLINE", "TRADE_LICENSE_RENEWAL", "PAYMENT_REMINDER", "GENERAL"]),
  deadline: z
    .string()
    .trim()
    .refine((v) => parseDateInput(v) !== null, "Choose a date"),
  customerId: z.string().transform((v) => v || null),
  assignedToId: z.string().transform((v) => v || null),
  notes: optionalText(2000),
});
export type FollowUpFormValues = z.input<typeof followUpSchema>;

export const employeeSchema = z.object({
  name: z.string().trim().min(2, "Enter the full name").max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email")),
  phone: z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (!v) return null;
      const n = normalizePhone(v);
      if (!n) ctx.addIssue({ code: "custom", message: "Use a Qatar number, e.g. +974 5512 3456" });
      return n ?? v;
    }),
  role: z.enum(["ADMIN", "MANAGER", "FINANCE", "STAFF"]),
  department: z.enum(["MANAGEMENT", "TYPING", "TRANSLATION", "FINANCE"]),
});
export type EmployeeFormValues = z.input<typeof employeeSchema>;

export const passwordChangeSchema = z
  .object({
    current: z.string().min(1, "Enter your current password"),
    next: z
      .string()
      .min(10, "At least 10 characters")
      .max(200)
      .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Use letters and at least one number"),
    confirm: z.string(),
  })
  .refine((v) => v.next === v.confirm, { path: ["confirm"], message: "Passwords don't match" })
  .refine((v) => v.next !== v.current, { path: ["next"], message: "Choose a different password" });
