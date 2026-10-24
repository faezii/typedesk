import { describe, expect, it } from "vitest";
import { parseDateTimeInput, toDateTimeInput } from "./dates";
import { lineTotal } from "./money";
import { formatNumber } from "./numbering";
import { workOrderSchema } from "./validation/work-order";
import { deadlineInfo, quantityFromTranslation } from "./work-orders";

describe("deadlineInfo (Dubai days)", () => {
  const now = new Date("2026-10-25T06:00:00Z"); // 10:00 Dubai, Sun 25 Oct
  it("past days are overdue by whole days", () => expect(deadlineInfo(new Date("2026-10-22T13:00:00Z"), now)).toEqual({ label: "Overdue 3d", tone: "overdue" }));
  it("earlier today is overdue with time", () => expect(deadlineInfo(new Date("2026-10-25T05:00:00Z"), now)).toEqual({ label: "Overdue · 9:00 AM", tone: "overdue" }));
  it("later today", () => expect(deadlineInfo(new Date("2026-10-25T13:00:00Z"), now)).toEqual({ label: "Today 5:00 PM", tone: "today" }));
  it("after midnight Dubai is tomorrow", () => expect(deadlineInfo(new Date("2026-10-25T20:30:00Z"), now)).toEqual({ label: "Tomorrow", tone: "soon" }));
  it("within a week", () => expect(deadlineInfo(new Date("2026-10-30T13:00:00Z"), now).label).toBe("In 5 days"));
  it("later shows the date", () => expect(deadlineInfo(new Date("2026-11-20T13:00:00Z"), now)).toEqual({ label: "20 Nov", tone: "later" }));
});

describe("quantityFromTranslation", () => {
  it("uses pages for per-page services", () => expect(quantityFromTranslation("PAGE", 7, 2100)).toBe(7));
  it("uses words for per-word services", () => expect(quantityFromTranslation("WORD", 7, 2100)).toBe(2100));
  it("leaves other units alone", () => expect(quantityFromTranslation("DOCUMENT", 7, 2100)).toBeNull());
});

describe("lineTotal", () => {
  it("multiplies exactly (no float drift)", () => expect(lineTotal("2481", "0.35").toFixed(2)).toBe("868.35"));
  it("rounds half-up to fils", () => expect(lineTotal("3", "0.335").toFixed(2)).toBe("1.01"));
});

describe("numbering", () => {
  it("pads to 4 digits", () => expect(formatNumber("WO", 2026, 42)).toBe("WO-2026-0042"));
});

describe("date-time input (Asia/Dubai)", () => {
  it("parses wall-clock Dubai time", () => expect(parseDateTimeInput("2026-10-25T17:00")?.toISOString()).toBe("2026-10-25T13:00:00.000Z"));
  it("round-trips", () => expect(toDateTimeInput(parseDateTimeInput("2026-01-02T09:30"))).toBe("2026-01-02T09:30"));
  it("rejects junk", () => expect(parseDateTimeInput("tomorrow")).toBeNull());
});

describe("workOrderSchema", () => {
  const base = {
    customerId: "c1",
    serviceId: "s1",
    quantity: "3",
    unitPrice: "120",
    priority: "NORMAL" as const,
    deadline: "",
    assignedToId: "",
    notes: "",
    translation: { sourceLang: "", targetLang: "", pageCount: "", wordCount: "", isCertified: true },
  };
  it("accepts a minimal order", () => expect(workOrderSchema.parse(base)).toMatchObject({ assignedToId: null, notes: null }));
  it("rejects zero / negative / 3-decimal quantities", () => {
    for (const quantity of ["0", "-1", "1.234", "abc"]) expect(workOrderSchema.safeParse({ ...base, quantity }).success).toBe(false);
  });
  it("rejects a malformed price", () => expect(workOrderSchema.safeParse({ ...base, unitPrice: "12,5" }).success).toBe(false));
  it("parses page/word counts", () =>
    expect(workOrderSchema.parse({ ...base, translation: { ...base.translation, pageCount: "12", wordCount: "" } }).translation).toMatchObject({
      pageCount: 12,
      wordCount: 0,
    }));
});
