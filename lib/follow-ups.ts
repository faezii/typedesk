import { addDays } from "date-fns";
import { daysFromTodayLocal, zone, endOfTodayLocal, startOfTodayLocal } from "./dates";

export type FollowUpGroup = "overdue" | "today" | "week" | "later";

export const FOLLOW_UP_GROUPS: { key: FollowUpGroup; label: string }[] = [
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "later", label: "Later" },
];

/** Bucket by Doha calendar day: before today, today, next 7 days, after. */
export function followUpGroup(deadline: Date, now = new Date()): FollowUpGroup {
  if (deadline < startOfTodayLocal(now)) return "overdue";
  if (deadline <= endOfTodayLocal(now)) return "today";
  if (deadline <= daysFromTodayLocal(7, now)) return "week";
  return "later";
}

/** Snooze pushes the follow-up 7 days past whichever is later: its deadline or today. */
export function snoozedDeadline(deadline: Date, now = new Date()): Date {
  const base = deadline > startOfTodayLocal(now) ? deadline : startOfTodayLocal(now);
  return new Date(addDays(base, 7, { in: zone }).getTime());
}
