import { addDays } from "date-fns";
import { daysFromTodayDubai, dubai, endOfTodayDubai, startOfTodayDubai } from "./dates";

export type FollowUpGroup = "overdue" | "today" | "week" | "later";

export const FOLLOW_UP_GROUPS: { key: FollowUpGroup; label: string }[] = [
  { key: "overdue", label: "Overdue" },
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "later", label: "Later" },
];

/** Bucket by Dubai calendar day: before today, today, next 7 days, after. */
export function followUpGroup(deadline: Date, now = new Date()): FollowUpGroup {
  if (deadline < startOfTodayDubai(now)) return "overdue";
  if (deadline <= endOfTodayDubai(now)) return "today";
  if (deadline <= daysFromTodayDubai(7, now)) return "week";
  return "later";
}

/** Snooze pushes the follow-up 7 days past whichever is later: its deadline or today. */
export function snoozedDeadline(deadline: Date, now = new Date()): Date {
  const base = deadline > startOfTodayDubai(now) ? deadline : startOfTodayDubai(now);
  return new Date(addDays(base, 7, { in: dubai }).getTime());
}
