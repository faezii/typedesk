import { TZDate, tz } from "@date-fns/tz";
import { addDays, endOfDay, format, startOfDay, startOfMonth, subMonths } from "date-fns";

export const TIMEZONE = "Asia/Qatar";
export const zone = tz(TIMEZONE);

// TZDate → plain Date, so values passed to Prisma are ordinary instants.
const plain = (d: Date) => new Date(d.getTime());

export const startOfTodayLocal = (now = new Date()) => plain(startOfDay(now, { in: zone }));
export const endOfTodayLocal = (now = new Date()) => plain(endOfDay(now, { in: zone }));
export const startOfMonthLocal = (d = new Date()) => plain(startOfMonth(d, { in: zone }));
export const monthsAgoLocal = (n: number, d = new Date()) => plain(startOfMonth(subMonths(d, n, { in: zone }), { in: zone }));
export const daysFromTodayLocal = (n: number, now = new Date()) => plain(endOfDay(addDays(now, n, { in: zone }), { in: zone }));

export const formatLocal = (d: Date, pattern: string) => format(d, pattern, { in: zone });

/** Doha wall-clock time, or null when a part would roll over (2026-02-30, 13th month, 24:00). */
function localTime(y: number, mo: number, d: number, h = 0, mi = 0) {
  const t = new TZDate(y, mo - 1, d, h, mi, TIMEZONE);
  return t.getFullYear() === y && t.getMonth() === mo - 1 && t.getDate() === d && t.getHours() === h && t.getMinutes() === mi ? plain(t) : null;
}

/** "yyyy-mm-dd" (from <input type="date">) → midnight Doha; null for junk or impossible dates. */
export function parseDateInput(value: string | null | undefined): Date | null {
  const m = value ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
  return m ? localTime(+m[1], +m[2], +m[3]) : null;
}
/** Date → "yyyy-mm-dd" in Doha, for <input type="date"> defaults. */
export const toDateInput = (d: Date | null | undefined) => (d ? formatLocal(d, "yyyy-MM-dd") : "");

/** "yyyy-mm-ddThh:mm" (from <input type="datetime-local">) → that wall-clock time in Doha. */
export function parseDateTimeInput(value: string | null | undefined): Date | null {
  const m = value ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value) : null;
  return m ? localTime(+m[1], +m[2], +m[3], +m[4], +m[5]) : null;
}
export const toDateTimeInput = (d: Date | null | undefined) => (d ? formatLocal(d, "yyyy-MM-dd'T'HH:mm") : "");

export function greetingFor(now = new Date()) {
  const hour = Number(formatLocal(now, "H"));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
