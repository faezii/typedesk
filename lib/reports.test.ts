import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { formatCell, pct, toCsv, type ReportResult } from "./reports";
import { toXlsx } from "./report-xlsx";

const report: ReportResult = {
  columns: [
    { key: "customer", label: "Customer" },
    { key: "invoices", label: "Invoices", type: "number" },
    { key: "total", label: "Invoiced (AED)", type: "money" },
    { key: "share", label: "Share", type: "percent" },
  ],
  rows: [
    { customer: 'Gulf "Horizon", LLC', invoices: 3, total: 1732.5, share: 62.5 },
    { customer: "=HYPERLINK(\"http://evil\")", invoices: 1, total: 1040, share: 37.5 },
  ],
  totals: { customer: "Total", invoices: 4, total: 2772.5, share: 100 },
};

describe("toCsv", () => {
  const csv = toCsv(report);
  const lines = csv.replace(/^﻿/, "").trimEnd().split("\r\n");
  it("starts with a BOM and uses CRLF", () => {
    expect(csv.startsWith("﻿")).toBe(true);
    expect(lines).toHaveLength(4);
  });
  it("quotes commas and doubles quotes", () => expect(lines[1]).toBe('"Gulf ""Horizon"", LLC",3,1732.50,62.5'));
  it("neutralises formula injection", () => expect(lines[2]!.startsWith(`"'=HYPERLINK(`)).toBe(true));
  it("appends the totals row", () => expect(lines[3]).toBe("Total,4,2772.50,100"));
});

describe("toXlsx", () => {
  it("writes typed numbers with an AED format and a totals row", () => {
    const wb = XLSX.read(toXlsx(report, "Customer revenue", "1 Oct 2026 – 25 Oct 2026"), { cellNF: true });
    const ws = wb.Sheets[wb.SheetNames[0]!]!;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
    const header = rows.findIndex((r) => r[0] === "Customer");
    expect(rows[header + 1]).toEqual(['Gulf "Horizon", LLC', 3, 1732.5, 62.5]);
    expect(rows.at(-1)).toEqual(["Total", 4, 2772.5, 100]);
    const moneyCell = ws[XLSX.utils.encode_cell({ r: header + 1, c: 2 })];
    expect(moneyCell.t).toBe("n");
    expect(moneyCell.z).toBe("#,##0.00");
  });
});

describe("formatCell / pct", () => {
  it("formats by type", () => {
    expect(formatCell(1234.5, "money")).toBe("1,234.50");
    expect(formatCell(62.5, "percent")).toBe("62.5%");
    expect(formatCell(null, "money")).toBe("—");
  });
  it("pct handles zero totals", () => {
    expect(pct(1, 3)).toBe(33.3);
    expect(pct(5, 0)).toBe(0);
  });
});
