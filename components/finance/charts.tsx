"use client";


import { useT } from "@/components/i18n";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney, formatCompact } from "@/lib/format";

const axis = { tickLine: false, axisLine: false, tick: { fill: "var(--muted-foreground)", fontSize: 12 } } as const;

function TooltipBox({ title, rows }: { title?: string; rows: { label: string; value: number; color: string }[] }) {
  const t = useT();
  return (
    <div className="bg-popover text-popover-foreground rounded-lg border px-3 py-2 text-xs shadow-md">
      {title && <div className="mb-1 font-medium">{t(title)}</div>}
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          <span className="size-2 rounded-[2px]" style={{ background: r.color }} />
          <span className="text-muted-foreground">{r.label}</span>
          <span className="ms-auto ps-4 font-medium tabular-nums">{formatMoney(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** Single-series monthly bars (e.g. expenses per month). */
export function MonthlyBars({ data, label }: { data: { label: string; value: number }[]; label: string }) {
  const t = useT();
  return (
    <>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" {...axis} tickFormatter={(v) => t(String(v))} />
            <YAxis width={44} tickFormatter={formatCompact} {...axis} />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={({ active, payload, label: l }) =>
                active && payload?.[0] ? <TooltipBox title={String(l)} rows={[{ label, value: Number(payload[0].value), color: "var(--chart-1)" }]} /> : null
              }
            />
            <Bar dataKey="value" name={label} fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{t("{label} by month, QAR", { label })}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th>{t(d.label)}</th>
              <td>{formatMoney(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

const PNL_SERIES = [
  { key: "income", label: "Income", color: "var(--chart-1)" },
  { key: "expenses", label: "Expenses", color: "var(--chart-2)" },
  { key: "net", label: "Net", color: "var(--chart-3)" },
] as const;

/** 12-month income / expenses / net lines (QAR, net of VAT). */
export function PnlTrend({ data }: { data: { label: string; income: number; expenses: number; net: number }[] }) {
  const t = useT();
  return (
    <>
      <ul className="text-muted-foreground mb-3 flex gap-4 text-xs" aria-hidden>
        {PNL_SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded" style={{ background: s.color }} />
            {t(s.label)}
          </li>
        ))}
      </ul>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" {...axis} tickFormatter={(v) => t(String(v))} />
            <YAxis width={48} tickFormatter={formatCompact} {...axis} />
            <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeOpacity={0.4} />
            <Tooltip
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={String(label)}
                    rows={PNL_SERIES.map((s) => ({ label: t(s.label), value: Number(payload.find((p) => p.dataKey === s.key)?.value ?? 0), color: s.color }))}
                  />
                ) : null
              }
            />
            {PNL_SERIES.map((s) => (
              <Line key={s.key} type="monotone" dataKey={s.key} name={t(s.label)} stroke={s.color} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{t("Monthly income, expenses and net, QAR")}</caption>
        <thead>
          <tr>
            <th>{t("Month")}</th>
            <th>{t("Income")}</th>
            <th>{t("Expenses")}</th>
            <th>{t("Net")}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <td>{t(d.label)}</td>
              <td>{formatMoney(d.income)}</td>
              <td>{formatMoney(d.expenses)}</td>
              <td>{formatMoney(d.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
