import { getT } from "@/lib/i18n/server";
import { Pencil, Plus } from "lucide-react";
import { ActiveToggle, ServiceDialog } from "@/components/services/service-controls";
import { PageHeader } from "@/components/shared/page-header";
import { ToneBadge, type Tone } from "@/components/shared/tone-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requirePagePermission } from "@/lib/auth/session";
import { formatMoney } from "@/lib/format";
import { SERVICE_CATEGORY_LABEL, SERVICE_UNIT_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { listServices } from "@/server/queries/services";
import type { ServiceCategory } from "@prisma/client";

export async function generateMetadata() {
  return { title: (await getT())("Services") };
}

const CATEGORY_TONE: Record<ServiceCategory, Tone> = {
  LEGAL_TRANSLATION: "green",
  GENERAL_TRANSLATION: "blue",
  TYPING: "violet",
  ATTESTATION: "amber",
  COURT_SUBMISSION: "red",
  OTHER: "gray",
};

export default async function ServicesPage() {
  const t = await getT();
  const user = await requirePagePermission("services:view");
  const canEdit = can(user.role, "services:edit");
  const services = await listServices();

  return (
    <>
      <PageHeader
        title={t("Services")}
        description={t("Service catalogue and default QAR rates (excl. VAT). Inactive services can't be picked for new work orders.")}
        actions={
          canEdit && (
            <ServiceDialog>
              <Button>
                <Plus /> {t("New service")}</Button>
            </ServiceDialog>
          )
        }
      />
      <div className="bg-card rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="ps-4">{t("Service")}</TableHead>
              <TableHead>{t("Category")}</TableHead>
              <TableHead className="text-end">{t("Default rate")}</TableHead>
              <TableHead className="text-end">{t("Orders")}</TableHead>
              <TableHead>{t("Status")}</TableHead>
              {canEdit && <TableHead className="pe-4 text-end"><span className="sr-only">{t("Edit")}</span></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.length === 0 && (
              <TableRow>
                <TableCell colSpan={canEdit ? 6 : 5} className="text-muted-foreground py-12 text-center">{canEdit ? t("No services yet. Add your first service to start taking work orders.") : t("No services yet.")}</TableCell>
              </TableRow>
            )}
            {services.map((s) => (
              <TableRow key={s.id} className={cn(!s.isActive && "opacity-60")}>
                <TableCell className="max-w-96 ps-4">
                  <div className="font-medium">{s.title}</div>
                  {s.description && <div className="text-muted-foreground truncate text-xs">{s.description}</div>}
                </TableCell>
                <TableCell>
                  <ToneBadge tone={CATEGORY_TONE[s.category]}>{t(SERVICE_CATEGORY_LABEL[s.category])}</ToneBadge>
                </TableCell>
                <TableCell className="text-end whitespace-nowrap tabular-nums">
                  {formatMoney(s.defaultPrice)}
                  <span className="text-muted-foreground text-xs"> / {t(SERVICE_UNIT_LABEL[s.unit])}</span>
                </TableCell>
                <TableCell className="text-end tabular-nums">{s.orders}</TableCell>
                <TableCell>
                  {canEdit ? (
                    <ActiveToggle id={s.id} active={s.isActive} label={s.title} />
                  ) : (
                    <ToneBadge tone={s.isActive ? "green" : "gray"}>{s.isActive ? t("Active") : t("Inactive")}</ToneBadge>
                  )}
                </TableCell>
                {canEdit && (
                  <TableCell className="pe-4 text-end">
                    <ServiceDialog
                      serviceId={s.id}
                      defaultValues={{ title: s.title, category: s.category, unit: s.unit, defaultPrice: s.defaultPrice, description: s.description ?? "" }}
                    >
                      <Button variant="ghost" size="icon-sm" aria-label={t("Edit {title}", { title: s.title })}>
                        <Pencil />
                      </Button>
                    </ServiceDialog>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
