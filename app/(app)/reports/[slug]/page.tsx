import { getT } from "@/lib/i18n/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileDown, FileSpreadsheet, FileText } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DateParam } from "@/components/shared/url-filters";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePagePermission } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { formatCell, type ColumnType } from "@/lib/reports";
import { cn } from "@/lib/utils";
import { getReport, runReport, type ReportParams } from "@/server/queries/reports";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return { title: (await getT())(getReport((await params).slug)?.title ?? "Report") };
}

const numeric = (t?: ColumnType) => t === "money" || t === "number" || t === "percent";

export default async function ReportPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<ReportParams> }) {
  const t = await getT();
  await requirePagePermission("reports:view");
  const def = getReport((await params).slug);
  if (!def) notFound();
  const sp = await searchParams;
  const { range, result } = await runReport(def, sp);
  const period = `${formatDate(range.start, t.lang)} – ${formatDate(range.end, t.lang)}`;
  const exportHref = (format: string) => `/api/reports/${def.slug}?${new URLSearchParams({ format, ...(sp.from ? { from: sp.from } : {}), ...(sp.to ? { to: sp.to } : {}) })}`;

  return (
    <>
      <Link href="/reports" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="rtl:-scale-x-100 size-4" /> {t("Reports")}</Link>
      <PageHeader
        title={t(def.title)}
        description={period}
        actions={
          <>
            {[
              { format: "csv", label: "CSV", Icon: FileDown },
              { format: "xlsx", label: t("Excel"), Icon: FileSpreadsheet },
              { format: "pdf", label: "PDF", Icon: FileText },
            ].map(({ format, label, Icon }) => (
              <Button key={format} variant="outline" asChild>
                <a href={exportHref(format)} download>
                  <Icon /> {label}
                </a>
              </Button>
            ))}
          </>
        }
      />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <DateParam param="from" label={t("From")} />
        <DateParam param="to" label={t("to")} />
        {(sp.from || sp.to) && (
          <Link href={`/reports/${def.slug}`} className="text-muted-foreground hover:text-foreground text-sm underline">
            {t("Reset to default period")}</Link>
        )}
      </div>

      <section className="bg-card rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              {result.columns.map((c, i) => (
                <TableHead key={c.key} className={cn(numeric(c.type) && "text-end", i === 0 && "ps-4", i === result.columns.length - 1 && "pe-4")}>
                  {t(c.label)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={result.columns.length} className="text-muted-foreground py-12 text-center">
                  {t("No data for this period.")}</TableCell>
              </TableRow>
            ) : (
              result.rows.map((r, ri) => (
                <TableRow key={ri}>
                  {result.columns.map((c, i) => (
                    <TableCell
                      key={c.key}
                      className={cn(numeric(c.type) && "text-end tabular-nums", c.key === "description" && "max-w-80 whitespace-normal", i === 0 && "ps-4", i === result.columns.length - 1 && "pe-4")}
                    >
                      {numeric(c.type) ? formatCell(r[c.key], c.type) : t(formatCell(r[c.key], c.type))}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
          {result.totals && result.rows.length > 0 && (
            <TableFooter>
              <TableRow className="font-semibold">
                {result.columns.map((c, i) => (
                  <TableCell key={c.key} className={cn(numeric(c.type) && "text-end tabular-nums", i === 0 && "ps-4", i === result.columns.length - 1 && "pe-4")}>
                    {result.totals![c.key] === null ? "" : numeric(c.type) ? formatCell(result.totals![c.key], c.type) : t(formatCell(result.totals![c.key], c.type))}
                  </TableCell>
                ))}
              </TableRow>
            </TableFooter>
          )}
        </Table>
        {result.note && <p className="text-muted-foreground border-t px-4 py-3 text-xs">{t(result.note)}</p>}
      </section>
    </>
  );
}
