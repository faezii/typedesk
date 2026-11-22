import "server-only";
import type { FollowUpType } from "@prisma/client";
import { subDays } from "date-fns";
import { EXPIRY_WARNING_DAYS } from "@/lib/expiry";
import { zone, formatLocal } from "@/lib/dates";
import type { Tx } from "@/lib/prisma";


type CustomerIds = { id: string; name: string; passportExpiry: Date | null; nationalIdExpiry: Date | null };

const KINDS: { field: "passportExpiry" | "nationalIdExpiry"; key: string; type: FollowUpType; label: string }[] = [
  { field: "passportExpiry", key: "passport", type: "PASSPORT_EXPIRY", label: "Passport" },
  { field: "nationalIdExpiry", key: "nationalId", type: "NATIONAL_ID_EXPIRY", label: "QID" },
];

/**
 * Keep one system follow-up per ID document, due 30 days before it expires.
 * Idempotent: call after any change to a customer's ID expiry dates.
 * A new expiry date (renewal) re-opens a follow-up that was already marked done.
 */
export async function syncIdExpiryFollowUps(tx: Tx, customer: CustomerIds, assignedToId?: string | null) {
  for (const kind of KINDS) {
    const autoKey = `customer:${customer.id}:${kind.key}`;
    const expiry = customer[kind.field];

    if (!expiry) {
      await tx.followUp.deleteMany({ where: { autoKey, status: { not: "DONE" } } });
      continue;
    }

    const deadline = new Date(subDays(expiry, EXPIRY_WARNING_DAYS, { in: zone }).getTime());
    const fields = {
      title: `${kind.label} renewal — ${customer.name}`,
      notes: `${kind.label} expires on ${formatLocal(expiry, "d MMM yyyy")}`,
    };
    const existing = await tx.followUp.findUnique({ where: { autoKey }, select: { deadline: true } });

    if (!existing) {
      await tx.followUp.create({
        data: { ...fields, autoKey, type: kind.type, deadline, customerId: customer.id, assignedToId: assignedToId ?? null },
      });
    } else if (existing.deadline.getTime() !== deadline.getTime()) {
      await tx.followUp.update({ where: { autoKey }, data: { ...fields, deadline, status: "PENDING" } });
    } else {
      await tx.followUp.update({ where: { autoKey }, data: fields }); // name may have changed
    }
  }
}
