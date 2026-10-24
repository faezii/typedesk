import { daysFromTodayDubai, startOfTodayDubai } from "./dates";

export const EXPIRY_WARNING_DAYS = 30;

export type ExpiryStatus = "valid" | "expiring" | "expired";

/** Expired before today (Dubai), expiring within 30 days, otherwise valid. */
export function expiryStatus(date: Date, now = new Date()): ExpiryStatus {
  if (date < startOfTodayDubai(now)) return "expired";
  if (date <= daysFromTodayDubai(EXPIRY_WARNING_DAYS, now)) return "expiring";
  return "valid";
}
