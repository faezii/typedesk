"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { StatusSlice } from "@/server/queries/dashboard";

const COLORS: Record<StatusSlice["key"], string> = {
  delivered: "var(--chart-1)",
  inProgress: "var(--chart-2)",
  ready: "var(--chart-3)",
  revisions: "var(--chart-4)",
};

export function StatusDonut({ data }: { data: StatusSlice[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return <div className="text-muted-foreground grid h-56 place-items-center text-sm">No work orders in this period.</div>;
  }

  return (
    <div className="@container">
      <div className="flex flex-col items-center gap-5 @md:flex-row @md:gap-10">
        <div className="relative size-44 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                innerRadius="64%"
                outerRadius="100%"
                stroke="var(--card)"
                strokeWidth={2}
                startAngle={90}
                endAngle={-270}
                isAnimationActive={false}
              >
                {data.map((d) => (
                  <Cell key={d.key} fill={COLORS[d.key]} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) =>
                  active && payload?.[0] ? (
                    <div className="bg-popover text-popover-foreground rounded-lg border px-3 py-2 text-xs shadow-md">
                      <span className="font-medium">{payload[0].name}</span>
                      <span className="text-muted-foreground"> · {payload[0].value} orders</span>
                    </div>
                  ) : null
                }
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div>
              <div className="text-2xl font-semibold tabular-nums">{total}</div>
              <div className="text-muted-foreground text-xs">orders</div>
            </div>
          </div>
        </div>
        <ul className="w-full max-w-xs min-w-0 flex-1 space-y-2 text-sm">
          {data.map((d) => (
            <li key={d.key} className="flex items-center gap-2.5">
              <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: COLORS[d.key] }} aria-hidden />
              <span className="text-muted-foreground">{d.label}</span>
              <span className="ml-auto font-medium tabular-nums">{d.value}</span>
              <span className="text-muted-foreground w-10 text-right text-xs tabular-nums">{Math.round((d.value / total) * 100)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
