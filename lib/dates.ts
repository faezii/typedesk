import { tz } from "@date-fns/tz";
import { addDays, endOfDay, format, startOfDay, startOfMonth, subMonths } from "date-fns";

export const TIMEZONE = "Asia/Dubai";
export const dubai = tz(TIMEZONE);

// TZDate → plain Date, so values passed to Prisma are ordinary instants.
const plain = (d: Date) => new Date(d.getTime());

export const startOfTodayDubai = (now = new Date()) => plain(startOfDay(now, { in: dubai }));
export const endOfTodayDubai = (now = new Date()) => plain(endOfDay(now, { in: dubai }));
export const startOfMonthDubai = (d = new Date()) => plain(startOfMonth(d, { in: dubai }));
export const monthsAgoDubai = (n: number, d = new Date()) => plain(startOfMonth(subMonths(d, n, { in: dubai }), { in: dubai }));
export const daysFromTodayDubai = (n: number, now = new Date()) => plain(endOfDay(addDays(now, n, { in: dubai }), { in: dubai }));

export const formatDubai = (d: Date, pattern: string) => format(d, pattern, { in: dubai });

export function greetingFor(now = new Date()) {
  const hour = Number(formatDubai(now, "H"));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
