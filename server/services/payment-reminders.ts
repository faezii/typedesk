import "server-only";
import { addDays } from "date-fns";
import { zone, startOfTodayLocal } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

const REMINDER_AFTER_DAYS = 7;

/**
 * Create a PAYMENT_REMINDER follow-up for every unpaid/partial invoice that is 7+ days past due,
 * and close reminders whose invoice has since been paid, cancelled or deleted. Idempotent.
 */
// shortcut: runs when the follow-ups page or dashboard loads (the only places reminders show), not on a schedule — add a daily cron if reminders are ever sent out by email/WhatsApp.
export async function syncPaymentReminders() {
  const cutoff = new Date(addDays(startOfTodayLocal(), -REMINDER_AFTER_DAYS, { in: zone }).getTime());
  const overdue = await prisma.invoice.findMany({
    where: {
      deletedAt: null,
      status: { in: ["UNPAID", "PARTIAL"] },
      dueDate: { lt: cutoff },
      followUps: { none: { type: "PAYMENT_REMINDER" } },
    },
    select: { id: true, invoiceNo: true, customerId: true, dueDate: true, totalAmount: true, amountPaid: true },
    take: 500,
  });

  if (overdue.length > 0) {
    await prisma.followUp.createMany({
      data: overdue.map((i) => ({
        autoKey: `invoice:${i.id}:payment`,
        title: `Payment reminder — ${i.invoiceNo}`,
        type: "PAYMENT_REMINDER" as const,
        deadline: new Date(addDays(i.dueDate!, REMINDER_AFTER_DAYS, { in: zone }).getTime()),
        customerId: i.customerId,
        invoiceId: i.id,
        notes: `Outstanding QAR ${i.totalAmount.minus(i.amountPaid).toFixed(2)}`,
      })),
      skipDuplicates: true,
    });
  }

  await prisma.followUp.updateMany({
    where: {
      type: "PAYMENT_REMINDER",
      status: { not: "DONE" },
      invoice: { OR: [{ status: { in: ["PAID", "CANCELLED"] } }, { deletedAt: { not: null } }] },
    },
    data: { status: "DONE" },
  });
}
