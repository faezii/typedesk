import * as XLSX from "xlsx";
import type { ReportResult } from "./reports";

/** One-sheet workbook: title + period rows, a header, data rows and totals, with QAR number formats. */
export function toXlsx(report: ReportResult, title: string, period: string): Buffer {
  const header = report.columns.map((c) => c.label);
  const body = [...report.rows, ...(report.totals ? [report.totals] : [])].map((row) => report.columns.map((c) => row[c.key] ?? null));
  const ws = XLSX.utils.aoa_to_sheet([[title], [period], [], header, ...body]);

  const first = 4; // first data row (0-based) after title, period, blank and header rows
  report.columns.forEach((c, ci) => {
    const z = c.type === "money" ? "#,##0.00" : c.type === "percent" ? '0.0"%"' : c.type === "number" ? "#,##0.##" : undefined;
    if (!z) return;
    for (let r = first; r < first + body.length; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c: ci })];
      if (cell && cell.t === "n") cell.z = z;
    }
  });
  ws["!cols"] = report.columns.map((c) => ({ wch: Math.max(c.label.length + 2, c.type === "text" || !c.type ? 28 : 14) }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31).replace(/[\\/?*[\]:]/g, " "));
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
