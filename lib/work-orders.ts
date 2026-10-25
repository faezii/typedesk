import type { ServiceCategory, ServiceUnit, WorkOrderStatus } from "@prisma/client";
import { formatLocal, startOfTodayLocal } from "./dates";

export type DeadlineTone = "overdue" | "today" | "soon" | "later";

/** Human deadline label in Doha calendar days, e.g. "Overdue 3d", "Today 5:00 PM", "Tomorrow", "In 4 days". */
export function deadlineInfo(deadline: Date, now = new Date()): { label: string; tone: DeadlineTone } {
  const days = Math.round((startOfTodayLocal(deadline).getTime() - startOfTodayLocal(now).getTime()) / 86_400_000);
  if (deadline < now) return { label: days < 0 ? `Overdue ${-days}d` : `Overdue · ${formatLocal(deadline, "h:mm a")}`, tone: "overdue" };
  if (days === 0) return { label: `Today ${formatLocal(deadline, "h:mm a")}`, tone: "today" };
  if (days === 1) return { label: "Tomorrow", tone: "soon" };
  if (days <= 7) return { label: `In ${days} days`, tone: "soon" };
  return { label: formatLocal(deadline, "d MMM"), tone: "later" };
}

export const WORK_ORDER_FLOW: WorkOrderStatus[] = ["RECEIVED", "IN_PROGRESS", "QUALITY_CHECK", "READY", "DELIVERED"];

export const isTranslation = (category: ServiceCategory) => category === "LEGAL_TRANSLATION" || category === "GENERAL_TRANSLATION";

/** Billable quantity implied by translation size for per-page / per-word services; null when the unit isn't size-based. */
export function quantityFromTranslation(unit: ServiceUnit, pageCount: number, wordCount: number): number | null {
  if (unit === "PAGE") return pageCount;
  if (unit === "WORD") return wordCount;
  return null;
}
