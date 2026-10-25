import { z } from "zod";
import { DECIMAL_RE } from "./work-order";

const date = z.string().trim().refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v), "Choose a date");
const optionalDate = z.string().trim().refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use a valid date");
const money = (msg: string) => z.string().trim().refine((v) => DECIMAL_RE.test(v), msg);

export const lineSchema = z.object({
  description: z.string().trim().min(2, "Describe the item").max(300),
  serviceId: z.string().transform((v) => v || null),
  workOrderId: z.string().transform((v) => v || null),
  quantity: z
    .string()
    .trim()
    .refine((v) => DECIMAL_RE.test(v) && Number(v) > 0, "Qty above 0"),
  unitPrice: money("Enter a rate"),
});

/** Invoices and quotations share the builder; `validUntil` is only used for quotations. */
export const documentSchema = z
  .object({
    customerId: z.string().min(1, "Choose a customer"),
    issueDate: date,
    dueDate: optionalDate, // invoice due date / quotation valid-until
    notes: z
      .string()
      .trim()
      .max(2000)
      .transform((v) => v || null),
    items: z.array(lineSchema).min(1, "Add at least one line").max(100),
  })
  .refine((v) => !v.dueDate || v.dueDate >= v.issueDate, { path: ["dueDate"], message: "Can't be before the issue date" });
export type DocumentFormValues = z.input<typeof documentSchema>;

export const paymentSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z
    .string()
    .trim()
    .refine((v) => DECIMAL_RE.test(v) && Number(v) > 0, "Enter an amount above 0"),
  method: z.enum(["CASH", "CARD", "BANK_TRANSFER", "ONLINE"]),
  reference: z
    .string()
    .trim()
    .max(100)
    .transform((v) => v || null),
  date,
});
export type PaymentFormValues = z.input<typeof paymentSchema>;

export const expenseSchema = z.object({
  category: z.enum(["RENT", "UTILITY", "SUPPLIES", "SOFTWARE", "FREELANCER", "SALARY", "OTHER"]),
  amount: money("Enter the amount excl. VAT"),
  vatAmount: z
    .string()
    .trim()
    .transform((v) => v || "0")
    .refine((v) => DECIMAL_RE.test(v), "Enter the VAT amount or leave empty"),
  description: z.string().trim().min(2, "Describe the expense").max(300),
  date,
  vendorId: z.string().transform((v) => v || null),
});
export type ExpenseFormValues = z.input<typeof expenseSchema>;
