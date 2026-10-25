import { renderToBuffer } from "@react-pdf/renderer";
import { ReportPdf } from "@/components/reports/report-pdf";
import { can } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDubai } from "@/lib/dates";
import { toXlsx } from "@/lib/report-xlsx";
import { toCsv } from "@/lib/reports";
import { getSettings } from "@/lib/settings";
import { getReport, runReport } from "@/server/queries/reports";

/** GET /api/reports/<slug>?format=csv|xlsx|pdf&from=yyyy-mm-dd&to=yyyy-mm-dd */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "reports:view")) return new Response("Not found", { status: 404 });
  const def = getReport((await params).slug);
  if (!def) return new Response("Not found", { status: 404 });

  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "csv";
  const { range, period, result } = await runReport(def, { from: url.searchParams.get("from") ?? undefined, to: url.searchParams.get("to") ?? undefined });
  const filename = `${def.slug}_${formatDubai(range.start, "yyyy-MM-dd")}_${formatDubai(range.end, "yyyy-MM-dd")}`;
  const headers = (type: string, ext: string) => ({ "Content-Type": type, "Content-Disposition": `attachment; filename="${filename}.${ext}"`, "Cache-Control": "private, no-store" });

  if (format === "xlsx") {
    return new Response(new Uint8Array(toXlsx(result, def.title, period)), { headers: headers("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx") });
  }
  if (format === "pdf") {
    const { companyName } = await getSettings();
    const pdf = await renderToBuffer(<ReportPdf title={def.title} period={period} company={companyName} generated={formatDubai(new Date(), "d MMM yyyy, h:mm a")} report={result} />);
    return new Response(new Uint8Array(pdf), { headers: headers("application/pdf", "pdf") });
  }
  return new Response(toCsv(result), { headers: headers("text/csv; charset=utf-8", "csv") });
}
