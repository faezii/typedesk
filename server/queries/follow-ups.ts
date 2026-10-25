import "server-only";
import type { FollowUpType, Prisma } from "@prisma/client";
import { addDays, addMonths, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";
import { TZDate } from "@date-fns/tz";
import { TIMEZONE, dubai, formatDubai } from "@/lib/dates";
import { FOLLOW_UP_GROUPS, followUpGroup, type FollowUpGroup } from "@/lib/follow-ups";
import { FOLLOW_UP_TYPE_LABEL } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

export type FollowUpParams = { type?: string; assignee?: string; status?: string; view?: string; month?: string };

const select = {
  id: true,
  title: true,
  type: true,
  status: true,
  deadline: true,
  notes: true,
  autoKey: true,
  customer: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, name: true } },
} satisfies Prisma.FollowUpSelect;

export type FollowUpItem = Prisma.FollowUpGetPayload<{ select: typeof select }>;

function baseWhere(p: FollowUpParams): Prisma.FollowUpWhereInput {
  return {
    ...(p.type && p.type in FOLLOW_UP_TYPE_LABEL ? { type: p.type as FollowUpType } : {}),
    ...(p.assignee === "none" ? { assignedToId: null } : p.assignee ? { assignedToId: p.assignee } : {}),
  };
}

/** Open follow-ups (pending + snoozed) bucketed Overdue / Today / This week / Later, or recently done ones. */
export async function listFollowUps(p: FollowUpParams) {
  if (p.status === "done") {
    const done = await prisma.followUp.findMany({ where: { ...baseWhere(p), status: "DONE" }, orderBy: { updatedAt: "desc" }, take: 100, select });
    return { groups: [], done };
  }
  const open = await prisma.followUp.findMany({
    where: { ...baseWhere(p), status: { in: ["PENDING", "SNOOZED"] } },
    orderBy: { deadline: "asc" },
    take: 500,
    select,
  });
  const now = new Date();
  const buckets = new Map<FollowUpGroup, FollowUpItem[]>(FOLLOW_UP_GROUPS.map((g) => [g.key, []]));
  for (const f of open) buckets.get(followUpGroup(f.deadline, now))!.push(f);
  return { groups: FOLLOW_UP_GROUPS.map((g) => ({ ...g, items: buckets.get(g.key)! })), done: [] };
}

/** Month grid (Monday-first, Dubai days) with every follow-up placed on its day. */
export async function followUpCalendar(p: FollowUpParams) {
  const m = /^(\d{4})-(\d{2})$/.exec(p.month ?? "");
  const anchor = m ? new TZDate(+m[1], +m[2] - 1, 1, TIMEZONE) : new TZDate(Date.now(), TIMEZONE);
  const monthStart = startOfMonth(anchor, { in: dubai });
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1, in: dubai });
  const gridEnd = endOfWeek(endOfMonth(monthStart, { in: dubai }), { weekStartsOn: 1, in: dubai });

  const items = await prisma.followUp.findMany({
    where: { ...baseWhere(p), deadline: { gte: new Date(gridStart.getTime()), lte: new Date(gridEnd.getTime()) } },
    orderBy: { deadline: "asc" },
    select,
  });
  const byDay = new Map<string, FollowUpItem[]>();
  for (const f of items) {
    const key = formatDubai(f.deadline, "yyyy-MM-dd");
    byDay.set(key, [...(byDay.get(key) ?? []), f]);
  }

  const days = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1, { in: dubai })) {
    const key = formatDubai(d, "yyyy-MM-dd");
    days.push({ key, day: Number(formatDubai(d, "d")), inMonth: formatDubai(d, "MM") === formatDubai(monthStart, "MM"), items: byDay.get(key) ?? [] });
  }
  return {
    days,
    label: formatDubai(monthStart, "MMMM yyyy"),
    prev: formatDubai(addMonths(monthStart, -1, { in: dubai }), "yyyy-MM"),
    next: formatDubai(addMonths(monthStart, 1, { in: dubai }), "yyyy-MM"),
    today: formatDubai(new Date(), "yyyy-MM-dd"),
  };
}
