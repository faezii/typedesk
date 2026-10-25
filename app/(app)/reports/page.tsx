import Link from "next/link";
import { ArrowRight, BarChart3, Briefcase, Landmark } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { requirePagePermission } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { REPORTS, type ReportDef } from "@/server/queries/reports";

export const metadata = { title: "Reports" };

const GROUPS: { name: ReportDef["group"]; Icon: typeof BarChart3 }[] = [
  { name: "Sales", Icon: BarChart3 },
  { name: "Operations", Icon: Briefcase },
  { name: "Finance", Icon: Landmark },
];

export default async function ReportsPage() {
  await requirePagePermission("reports:view");
  // The VAT report only makes sense once a VAT rate is set (Qatar has none today).
  const reports = (await getSettings()).vatRate.isZero() ? REPORTS.filter((r) => r.slug !== "vat") : REPORTS;
  return (
    <>
      <PageHeader title="Reports" description="Pick a report, choose the period and export it as CSV, Excel or PDF." />
      <div className="space-y-6">
        {GROUPS.map(({ name, Icon }) => (
          <section key={name}>
            <h2 className="text-muted-foreground mb-2 flex items-center gap-2 text-xs font-medium tracking-wider uppercase">
              <Icon className="size-3.5" /> {name}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {reports.filter((r) => r.group === name).map((r) => (
                <Link
                  key={r.slug}
                  href={`/reports/${r.slug}`}
                  className="bg-card hover:border-primary/40 focus-visible:ring-ring/50 group flex items-start justify-between gap-3 rounded-xl border p-4 transition-colors outline-none focus-visible:ring-3"
                >
                  <div>
                    <div className="font-medium">{r.title}</div>
                    <p className="text-muted-foreground mt-0.5 text-sm">{r.description}</p>
                  </div>
                  <ArrowRight className="text-muted-foreground group-hover:text-primary mt-0.5 size-4 shrink-0 transition-colors" />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
