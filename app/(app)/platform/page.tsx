import { notFound } from "next/navigation";
import { differenceInCalendarDays } from "date-fns";
import { PageHeader } from "@/components/shared/page-header";
import { ToneBadge, type Tone } from "@/components/shared/tone-badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { isPlatformAdmin } from "@/lib/auth/platform";
import { requireUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { listCenters } from "@/server/queries/platform";
import { CenterActions } from "./center-actions";

export async function generateMetadata() {
  return { title: (await getT())("All centers") };
}

const STATUS: Record<string, { label: string; tone: Tone }> = {
  TRIAL: { label: "Trial", tone: "blue" },
  ACTIVE: { label: "Active", tone: "green" },
  SUSPENDED: { label: "Suspended", tone: "red" },
  EXPIRED: { label: "Trial ended", tone: "amber" },
};

/** The TypeDesk owner's view of every center (PLATFORM_ADMIN_EMAILS only; others get a 404). */
export default async function PlatformPage() {
  const t = await getT();
  const user = await requireUser();
  if (!isPlatformAdmin(user.email)) notFound();
  const centers = await listCenters();
  const now = new Date();

  return (
    <>
      <PageHeader title={t("All centers")} description={t("{count} centers. Trials last 30 days; extend, activate or suspend them here.", { count: centers.length })} />
      <Card className="gap-0 overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("Center")}</TableHead>
              <TableHead>{t("Admin")}</TableHead>
              <TableHead className="text-end">{t("Staff")}</TableHead>
              <TableHead className="text-end">{t("Work orders")}</TableHead>
              <TableHead>{t("Signed up")}</TableHead>
              <TableHead>{t("Status")}</TableHead>
              <TableHead className="w-0" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {centers.map((c) => {
              const admin = c.users[0];
              const expired = c.status === "TRIAL" && c.trialEndsAt && c.trialEndsAt < now;
              const s = STATUS[expired ? "EXPIRED" : c.status]!;
              return (
                <TableRow key={c.id}>
                  <TableCell>
                    <div className="font-medium">{c.name}</div>
                    {c.phone && <div className="text-muted-foreground text-xs" dir="ltr">{c.phone}</div>}
                  </TableCell>
                  <TableCell>
                    <div>{admin?.name ?? "—"}</div>
                    {admin && (
                      <div className="text-muted-foreground text-xs">
                        <span dir="ltr">{admin.email}</span>
                        {!admin.emailVerifiedAt && <> · {t("email not confirmed")}</>}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">{c._count.users}</TableCell>
                  <TableCell className="text-end tabular-nums">{c._count.workOrders}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(c.createdAt, t.lang)}</TableCell>
                  <TableCell>
                    <ToneBadge tone={s.tone}>{t(s.label)}</ToneBadge>
                    {c.status === "TRIAL" && c.trialEndsAt && (
                      <div className="text-muted-foreground mt-1 text-xs whitespace-nowrap">
                        {expired
                          ? t("ended {date}", { date: formatDate(c.trialEndsAt, t.lang) })
                          : t("{days} days left", { days: differenceInCalendarDays(c.trialEndsAt, now) })}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <CenterActions id={c.id} status={c.status} own={c.id === user.organizationId} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
