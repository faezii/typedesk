import type { ServiceCategory, ServiceUnit, WorkOrderStatus } from "@prisma/client";
import { formatLocal, startOfTodayLocal } from "./dates";
import { translator, type Lang } from "./i18n/translate";

export type DeadlineTone = "overdue" | "today" | "soon" | "later";

/** Human deadline label in Doha calendar days, e.g. "Overdue 3d", "Today 5:00 PM", "Tomorrow", "In 4 days". */
export function deadlineInfo(deadline: Date, now = new Date(), lang: Lang = "en"): { label: string; tone: DeadlineTone } {
  const t = translator(lang);
  const days = Math.round((startOfTodayLocal(deadline).getTime() - startOfTodayLocal(now).getTime()) / 86_400_000);
  const time = formatLocal(deadline, "h:mm a", lang);
  if (deadline < now) return { label: days < 0 ? t("Overdue {n}d", { n: -days }) : t("Overdue · {time}", { time }), tone: "overdue" };
  if (days === 0) return { label: t("Today {time}", { time }), tone: "today" };
  if (days === 1) return { label: t("Tomorrow"), tone: "soon" };
  if (days <= 7) return { label: t("In {n} days", { n: days }), tone: "soon" };
  return { label: formatLocal(deadline, "d MMM", lang), tone: "later" };
}

export const WORK_ORDER_FLOW: WorkOrderStatus[] = ["RECEIVED", "IN_PROGRESS", "QUALITY_CHECK", "READY", "DELIVERED"];

export const isTranslation = (category: ServiceCategory) => category === "LEGAL_TRANSLATION" || category === "GENERAL_TRANSLATION";

/** Billable quantity implied by translation size for per-page / per-word services; null when the unit isn't size-based. */
export function quantityFromTranslation(unit: ServiceUnit, pageCount: number, wordCount: number): number | null {
  if (unit === "PAGE") return pageCount;
  if (unit === "WORD") return wordCount;
  return null;
}
