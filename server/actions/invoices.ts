"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { addDays } from "date-fns";
import { Prisma } from "@prisma/client";
import type { ActionResult } from "@/lib/action-result";
import { guardAction } from "@/lib/auth/session";
import { zone, formatLocal, parseDateInput } from "@/lib/dates";
import { computeTotals, paymentStatus } from "@/lib/invoice-math";
import { nextNumber } from "@/lib/numbering";
import { prisma, type Tx } from "@/lib/prisma";
import { DEFAULT_PAYMENT_DAYS, getSettings } from "@/lib/settings";
import { documentSchema, paymentSchema, type DocumentFormValues, type PaymentFormValues } from "@/lib/validation/finance";
import { uninvoicedWorkOrders } from "@/server/queries/invoices";


type ParsedDoc = z.output<typeof documentSchema>;

const fail = (error: string, fieldErrors?: Record<string, string>) => ({ ok: false as const, error, fieldErrors });

function refreshFinance(...extra: string[]) {
  revalidatePath("/finance", "layout");
  revalidatePath("/customers", "layout");
  revalidatePath("/follow-ups");
  revalidatePath("/");
  for (const p of extra) revalidatePath(p);
}

function parseDoc(input: DocumentFormValues) {
  const parsed = documentSchema.safeParse(input);
  if (parsed.success) return { data: parsed.data };
  return { error: fail("Please fix the highlighted fields.", Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message]))) };
}

/** Lines may only reference services that exist; unknown ids are dropped rather than trusted. */
async function cleanServiceIds(items: ParsedDoc["items"]) {
  const ids = [...new Set(items.map((i) => i.serviceId).filter((v): v is string => !!v))];
  const known = new Set((await prisma.service.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((s) => s.id));
  return items.map((i) => ({ ...i, serviceId: i.serviceId && known.has(i.serviceId) ? i.serviceId : null }));
}

// ───────────── Invoices ─────────────

export async function saveInvoice(id: string | null, input: DocumentFormValues): Promise<ActionResult<{ id: string }>> {
  const { user, error } = await guardAction("finance:edit", id);
  if (!user) return fail(error);
  const parsed = parseDoc(input);
  if (parsed.error) return parsed.error;
  const d = parsed.data;

  const existing = id ? await prisma.invoice.findFirst({ where: { id, deletedAt: null }, select: { status: true, amountPaid: true, vatRate: true, invoiceNo: true } }) : null;
  if (id && !existing) return fail("This invoice no longer exists.");
  if (existing?.status === "CANCELLED") return fail("Cancelled invoices can't be edited.");
  if (existing && existing.amountPaid.gt(0)) return fail("This invoice has payments recorded, so it can't be edited. Issue a new invoice for any difference.");
  if (!(await prisma.customer.findFirst({ where: { id: d.customerId, deletedAt: null }, select: { id: true } }))) return fail("That customer no longer exists.", { customerId: "Not found" });

  // Work orders on the lines must belong to this customer and not already be billed elsewhere.
  const woIds = d.items.map((i) => i.workOrderId).filter((v): v is string => !!v);
  if (new Set(woIds).size !== woIds.length) return fail("The same work order appears on two lines.");
  if (woIds.length) {
    const currentIds = id ? (await prisma.invoiceItem.findMany({ where: { invoiceId: id, workOrderId: { not: null } }, select: { workOrderId: true } })).map((i) => i.workOrderId!) : [];
    const billable = new Set((await uninvoicedWorkOrders(d.customerId, currentIds)).map((w) => w.id));
    const bad = woIds.filter((w) => !billable.has(w));
    if (bad.length) return fail("Some work orders on this invoice are already invoiced, not delivered, or belong to another customer.");
  }

  const vatRate = existing?.vatRate ?? (await getSettings()).vatRate;
  const items = await cleanServiceIds(d.items);
  const totals = computeTotals(items, vatRate);
  const issueDate = parseDateInput(d.issueDate)!;
  const fields = {
    customerId: d.customerId,
    issueDate,
    dueDate: parseDateInput(d.dueDate) ?? new Date(addDays(issueDate, DEFAULT_PAYMENT_DAYS, { in: zone }).getTime()),
    notes: d.notes,
    vatRate,
    subtotal: totals.subtotal,
    vatAmount: totals.vatAmount,
    totalAmount: totals.totalAmount,
  };
  const lineData = totals.lines.map((l, i) => ({
    description: l.description,
    serviceId: l.serviceId,
    workOrderId: l.workOrderId,
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    lineTotal: l.lineTotal,
    sortOrder: i,
  }));

  const invoice = await prisma.$transaction(async (tx) => {
    let inv;
    if (id) {
      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      inv = await tx.invoice.update({ where: { id }, data: { ...fields, items: { create: lineData } } });
    } else {
      inv = await tx.invoice.create({ data: { ...fields, invoiceNo: await nextNumber(tx, user.organizationId, "INV", issueDate), status: "UNPAID", items: { create: lineData } } });
    }
    await logInvoice(tx, inv.id, user.id, id ? "updated" : "created", `${id ? "Updated" : "Issued"} ${inv.invoiceNo} — QAR ${inv.totalAmount.toFixed(2)}`, woIds);
    return inv;
  });

  refreshFinance(...woIds.map((w) => `/work-orders/${w}`));
  return { ok: true, data: { id: invoice.id } };
}

async function logInvoice(tx: Tx, invoiceId: string, userId: string, action: string, message: string, workOrderIds: string[] = []) {
  await tx.activityLog.create({ data: { entityType: "Invoice", entityId: invoiceId, action, message, userId } });
  for (const wo of workOrderIds) {
    await tx.activityLog.create({ data: { entityType: "WorkOrder", entityId: wo, action: `invoice_${action}`, message, userId } });
  }
}

/** Cancel an unpaid invoice; its work orders become billable again. */
export async function cancelInvoice(id: string): Promise<ActionResult> {
  const { user, error } = await guardAction("finance:edit", id);
  if (!user) return fail(error);
  const inv = await prisma.invoice.findFirst({ where: { id, deletedAt: null }, select: { invoiceNo: true, amountPaid: true, status: true } });
  if (!inv) return fail("This invoice no longer exists.");
  if (inv.status === "CANCELLED") return fail("Already cancelled.");
  if (inv.amountPaid.gt(0)) return fail("This invoice has payments recorded and can't be cancelled.");
  await prisma.$transaction(async (tx) => {
    await tx.invoice.update({ where: { id }, data: { status: "CANCELLED" } });
    await tx.followUp.updateMany({ where: { invoiceId: id, type: "PAYMENT_REMINDER", status: { not: "DONE" } }, data: { status: "DONE" } });
    await logInvoice(tx, id, user.id, "cancelled", `Cancelled ${inv.invoiceNo}`);
  });
  refreshFinance();
  return { ok: true, data: undefined };
}

/**
 * Record a payment against an invoice. The invoice row is locked for the transaction so two
 * simultaneous payments can't both pass the balance check.
 */
export async function recordPayment(input: PaymentFormValues): Promise<ActionResult> {
  const { user, error } = await guardAction("finance:edit");
  if (!user) return fail(error);
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]!.message, Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
  const d = parsed.data;
  const amount = new Prisma.Decimal(d.amount);

  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "Invoice" WHERE id = ${d.invoiceId} FOR UPDATE`;
    const inv = await tx.invoice.findFirst({ where: { id: d.invoiceId, deletedAt: null } });
    if (!inv) return fail("This invoice no longer exists.");
    if (inv.status === "CANCELLED") return fail("This invoice is cancelled.");
    const balance = inv.totalAmount.minus(inv.amountPaid);
    if (amount.gt(balance)) return fail(`The balance due is QAR ${balance.toFixed(2)}. The payment can't exceed it.`, { amount: `Max ${balance.toFixed(2)}` });

    await tx.payment.create({
      data: { invoiceId: inv.id, customerId: inv.customerId, amount, method: d.method, reference: d.reference, date: parseDateInput(d.date)!, receivedById: user.id },
    });
    const amountPaid = inv.amountPaid.plus(amount);
    const status = paymentStatus(inv.totalAmount, amountPaid);
    await tx.invoice.update({ where: { id: inv.id }, data: { amountPaid, status } });
    if (status === "PAID") {
      await tx.followUp.updateMany({ where: { invoiceId: inv.id, type: "PAYMENT_REMINDER", status: { not: "DONE" } }, data: { status: "DONE" } });
    }
    await logInvoice(tx, inv.id, user.id, "payment", `Payment QAR ${amount.toFixed(2)} (${d.method.replace("_", " ").toLowerCase()}) on ${inv.invoiceNo} — ${status === "PAID" ? "paid in full" : `balance QAR ${inv.totalAmount.minus(amountPaid).toFixed(2)}`}`);
    return { ok: true as const, data: undefined };
  });
  if (result.ok) refreshFinance();
  return result;
}

/**
 * Undo a payment recorded by mistake: the row is deleted, the invoice's paid amount and status are
 * recomputed, and the activity log keeps the full details. Locks the invoice like recordPayment.
 */
export async function deletePayment(id: string): Promise<ActionResult> {
  const { user, error } = await guardAction("finance:edit", id);
  if (!user) return fail(error);

  const result = await prisma.$transaction(async (tx) => {
    const pay = await tx.payment.findUnique({ where: { id }, include: { receivedBy: { select: { name: true } } } });
    if (!pay) return fail("This payment was already removed.");
    await tx.$executeRaw`SELECT id FROM "Invoice" WHERE id = ${pay.invoiceId} FOR UPDATE`;
    const { count } = await tx.payment.deleteMany({ where: { id } }); // 0 if a concurrent request removed it first
    if (count === 0) return fail("This payment was already removed.");

    const inv = await tx.invoice.findUniqueOrThrow({ where: { id: pay.invoiceId } });
    const amountPaid = inv.amountPaid.minus(pay.amount);
    const status = paymentStatus(inv.totalAmount, amountPaid, inv.status);
    await tx.invoice.update({ where: { id: inv.id }, data: { amountPaid, status } });
    // The reminder was closed automatically when the invoice was paid in full; it's open again.
    if (inv.status === "PAID" && status !== "PAID") {
      await tx.followUp.updateMany({ where: { invoiceId: inv.id, type: "PAYMENT_REMINDER", status: "DONE" }, data: { status: "PENDING" } });
    }
    const details = [pay.method.replace("_", " ").toLowerCase(), formatLocal(pay.date, "d MMM yyyy"), pay.reference, pay.receivedBy && `received by ${pay.receivedBy.name}`].filter(Boolean).join(", ");
    await logInvoice(tx, inv.id, user.id, "payment_removed", `Removed payment QAR ${pay.amount.toFixed(2)} (${details}) from ${inv.invoiceNo}; balance now QAR ${inv.totalAmount.minus(amountPaid).toFixed(2)}`);
    return { ok: true as const, data: undefined };
  });
  if (result.ok) refreshFinance();
  return result;
}

//───────────── Quotations ─────────────

export async function saveQuotation(id: string | null, input: DocumentFormValues): Promise<ActionResult<{ id: string }>> {
  const { user, error } = await guardAction("finance:edit", id);
  if (!user) return fail(error);
  const parsed = parseDoc(input);
  if (parsed.error) return parsed.error;
  const d = parsed.data;

  const existing = id ? await prisma.quotation.findUnique({ where: { id }, select: { status: true, vatRate: true } }) : null;
  if (id && !existing) return fail("This quotation no longer exists.");
  if (existing?.status === "CONVERTED") return fail("This quotation was converted to an invoice and can't be edited.");
  if (!(await prisma.customer.findFirst({ where: { id: d.customerId, deletedAt: null }, select: { id: true } }))) return fail("That customer no longer exists.", { customerId: "Not found" });

  const vatRate = existing?.vatRate ?? (await getSettings()).vatRate;
  const items = (await cleanServiceIds(d.items)).map((i) => ({ ...i, workOrderId: null })); // quotes precede work
  const totals = computeTotals(items, vatRate);
  const issueDate = parseDateInput(d.issueDate)!;
  const fields = {
    customerId: d.customerId,
    issueDate,
    validUntil: parseDateInput(d.dueDate) ?? new Date(addDays(issueDate, 30, { in: zone }).getTime()),
    notes: d.notes,
    vatRate,
    subtotal: totals.subtotal,
    vatAmount: totals.vatAmount,
    totalAmount: totals.totalAmount,
  };
  const lineData = totals.lines.map((l, i) => ({ description: l.description, serviceId: l.serviceId, quantity: l.quantity, unitPrice: l.unitPrice, lineTotal: l.lineTotal, sortOrder: i }));

  const quote = await prisma.$transaction(async (tx) => {
    let q;
    if (id) {
      await tx.quotationItem.deleteMany({ where: { quotationId: id } });
      q = await tx.quotation.update({ where: { id }, data: { ...fields, items: { create: lineData } } });
    } else {
      q = await tx.quotation.create({ data: { ...fields, quoteNo: await nextNumber(tx, user.organizationId, "QT", issueDate), status: "DRAFT", items: { create: lineData } } });
    }
    await tx.activityLog.create({
      data: { entityType: "Quotation", entityId: q.id, action: id ? "updated" : "created", message: `${id ? "Updated" : "Created"} ${q.quoteNo} — QAR ${q.totalAmount.toFixed(2)}`, userId: user.id },
    });
    return q;
  });
  refreshFinance();
  return { ok: true, data: { id: quote.id } };
}

export async function setQuotationStatus(id: string, status: "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED"): Promise<ActionResult> {
  const { user, error } = await guardAction("finance:edit", id);
  if (!user) return fail(error);
  if (!z.enum(["DRAFT", "SENT", "ACCEPTED", "REJECTED"]).safeParse(status).success) return fail("Invalid status.");
  const { count } = await prisma.quotation.updateMany({ where: { id, status: { not: "CONVERTED" } }, data: { status } });
  if (count === 0) return fail("This quotation can't be changed (missing or already converted).");
  await prisma.activityLog.create({ data: { entityType: "Quotation", entityId: id, action: "status_changed", message: `Marked ${status.toLowerCase()}`, userId: user.id } });
  refreshFinance();
  return { ok: true, data: undefined };
}

/** Copies the quotation's lines into a new invoice dated today (at the current VAT rate). */
export async function convertQuotation(id: string): Promise<ActionResult<{ invoiceId: string }>> {
  const { user, error } = await guardAction("finance:edit", id);
  if (!user) return fail(error);
  const vatRate = (await getSettings()).vatRate;

  const result = await prisma.$transaction(async (tx) => {
    const { count } = await tx.quotation.updateMany({ where: { id, status: { not: "CONVERTED" } }, data: { status: "CONVERTED" } });
    if (count === 0) return fail("This quotation was already converted.");
    const q = await tx.quotation.findUniqueOrThrow({ where: { id }, include: { items: { orderBy: { sortOrder: "asc" } } } });
    const totals = computeTotals(q.items, vatRate);
    const issueDate = new Date();
    const inv = await tx.invoice.create({
      data: {
        invoiceNo: await nextNumber(tx, user.organizationId, "INV", issueDate),
        customerId: q.customerId,
        quotationId: q.id,
        status: "UNPAID",
        issueDate,
        dueDate: new Date(addDays(issueDate, DEFAULT_PAYMENT_DAYS, { in: zone }).getTime()),
        notes: q.notes,
        vatRate,
        subtotal: totals.subtotal,
        vatAmount: totals.vatAmount,
        totalAmount: totals.totalAmount,
        items: {
          create: totals.lines.map((l, i) => ({ description: l.description, serviceId: l.serviceId, quantity: l.quantity, unitPrice: l.unitPrice, lineTotal: l.lineTotal, sortOrder: i })),
        },
      },
    });
    await tx.activityLog.create({ data: { entityType: "Quotation", entityId: id, action: "converted", message: `Converted to ${inv.invoiceNo}`, userId: user.id } });
    await logInvoice(tx, inv.id, user.id, "created", `Issued ${inv.invoiceNo} from ${q.quoteNo} on ${formatLocal(issueDate, "d MMM yyyy")}`);
    return { ok: true as const, data: { invoiceId: inv.id } };
  });
  if (result.ok) refreshFinance();
  return result;
}

/** Delivered, not-yet-invoiced orders for the builder's "Import work orders". */
export async function findBillableWorkOrders(customerId: string) {
  const { user } = await guardAction("finance:view", customerId);
  if (!user || !customerId) return [];
  const rows = await uninvoicedWorkOrders(customerId);
  return rows.map((w) => ({
    id: w.id,
    orderNo: w.orderNo,
    description: `${w.service.title}${w.notes ? ` — ${w.notes.split(" — ")[0]}` : ""} (${w.orderNo})`,
    serviceId: w.serviceId,
    quantity: w.quantity.toString(),
    unitPrice: w.unitPrice.toFixed(2),
    totalAmount: w.totalAmount.toFixed(2),
    deliveredAt: w.deliveredAt,
  }));
}
