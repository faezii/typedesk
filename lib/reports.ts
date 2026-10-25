/** Shared report shape: every report renders as one table and exports to CSV / Excel / PDF. */
export type ColumnType = "text" | "money" | "number" | "percent" | "date";
export type ReportColumn = { key: string; label: string; type?: ColumnType };
export type ReportRow = Record<string, string | number | null>;
export type ReportResult = { columns: ReportColumn[]; rows: ReportRow[]; totals?: ReportRow; note?: string };

const nf = (max: number, min = 0) => new Intl.NumberFormat("en-AE", { minimumFractionDigits: min, maximumFractionDigits: max });
const money = nf(2, 2);
const num = nf(2);

/** Human-readable cell for the on-screen table and PDF. */
export function formatCell(value: string | number | null | undefined, type: ColumnType = "text"): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") return value;
  if (type === "money") return money.format(value);
  if (type === "percent") return `${num.format(value)}%`;
  return num.format(value);
}

/** Spreadsheet apps execute cells starting with these characters as formulas. */
const FORMULA_START = /^[=+\-@\t\r]/;

function csvCell(value: string | number | null | undefined, type: ColumnType = "text"): string {
  if (value === null || value === undefined) return "";
  let s = typeof value === "number" ? (type === "money" ? value.toFixed(2) : String(value)) : value;
  if (typeof value === "string" && FORMULA_START.test(s)) s = `'${s}`; // neutralise CSV/formula injection
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** RFC 4180 CSV with a UTF-8 BOM so Excel opens Arabic names and "—" correctly. */
export function toCsv(report: ReportResult): string {
  const lines = [report.columns.map((c) => csvCell(c.label)).join(",")];
  for (const row of [...report.rows, ...(report.totals ? [report.totals] : [])]) {
    lines.push(report.columns.map((c) => csvCell(row[c.key], c.type)).join(","));
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** Share of a total as a percentage with one decimal (0 when the total is 0). */
export const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);

/** Round a float (summed from Decimals) back to fils for totals rows. */
export const fils = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
