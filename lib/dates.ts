import { TZDate, tz } from "@date-fns/tz";
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

/** Dubai wall-clock time, or null when a part would roll over (2026-02-30, 13th month, 24:00). */
function dubaiTime(y: number, mo: number, d: number, h = 0, mi = 0) {
  const t = new TZDate(y, mo - 1, d, h, mi, TIMEZONE);
  return t.getFullYear() === y && t.getMonth() === mo - 1 && t.getDate() === d && t.getHours() === h && t.getMinutes() === mi ? plain(t) : null;
}

/** "yyyy-mm-dd" (from <input type="date">) → midnight Dubai; null for junk or impossible dates. */
export function parseDateInput(value: string | null | undefined): Date | null {
  const m = value ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  return m ? dubaiTime(+m[1], +m[2], +m[3]) : null;
}
/** Date → "yyyy-mm-dd" in Dubai, for <input type="date"> defaults. */
export const toDateInput = (d: Date | null | undefined) => (d ? formatDubai(d, "yyyy-MM-dd") : "");

/** "yyyy-mm-ddThh:mm" (from <input type="datetime-local">) → that wall-clock time in Dubai. */
export function parseDateTimeInput(value: string | null | undefined): Date | null {
  const m = value ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value) : null;
  return m ? dubaiTime(+m[1], +m[2], +m[3], +m[4], +m[5]) : null;
}
export const toDateTimeInput = (d: Date | null | undefined) => (d ? formatDubai(d, "yyyy-MM-dd'T'HH:mm") : "");

export function greetingFor(now = new Date()) {
  const hour = Number(formatDubai(now, "H"));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
