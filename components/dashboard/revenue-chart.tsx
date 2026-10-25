"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney, formatCompact } from "@/lib/format";
import type { RevenuePoint } from "@/server/queries/dashboard";

const SERIES = [
  { key: "invoiced", label: "Invoiced", color: "var(--chart-2)" },
  { key: "collected", label: "Collected", color: "var(--chart-1)" },
] as const;

export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  return (
    <div>
      <ul className="text-muted-foreground mb-3 flex gap-4 text-xs" aria-hidden>
        {SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px]" style={{ background: s.color }} />
            {s.label}
          </li>
        ))}
      </ul>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} barCategoryGap="28%" margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
            <YAxis
              width={44}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatCompact}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div className="bg-popover text-popover-foreground rounded-lg border px-3 py-2 text-xs shadow-md">
                    <div className="mb-1 font-medium">{label}</div>
                    {SERIES.map((s) => {
                      const v = payload.find((p) => p.dataKey === s.key)?.value;
                      return (
                        <div key={s.key} className="flex items-center gap-2">
                          <span className="size-2 rounded-[2px]" style={{ background: s.color }} />
                          <span className="text-muted-foreground">{s.label}</span>
                          <span className="ml-auto pl-4 font-medium tabular-nums">{formatMoney(Number(v ?? 0))}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : null
              }
            />
            {SERIES.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={28} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Table view for screen readers */}
      <table className="sr-only">
        <caption>Invoiced and collected revenue by month, QAR</caption>
        <thead>
          <tr>
            <th>Month</th>
            <th>Invoiced</th>
            <th>Collected</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.month}>
              <td>{d.label}</td>
              <td>{formatMoney(d.invoiced)}</td>
              <td>{formatMoney(d.collected)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
