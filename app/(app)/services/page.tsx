import { Pencil, Plus } from "lucide-react";
import { ActiveToggle, ServiceDialog } from "@/components/services/service-controls";
import { PageHeader } from "@/components/shared/page-header";
import { ToneBadge, type Tone } from "@/components/shared/tone-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requirePagePermission } from "@/lib/auth/session";
import { formatAED } from "@/lib/format";
import { SERVICE_CATEGORY_LABEL, SERVICE_UNIT_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { listServices } from "@/server/queries/services";
import type { ServiceCategory } from "@prisma/client";

export const metadata = { title: "Services" };

const CATEGORY_TONE: Record<ServiceCategory, Tone> = {
  LEGAL_TRANSLATION: "green",
  GENERAL_TRANSLATION: "blue",
  TYPING: "violet",
  ATTESTATION: "amber",
  COURT_SUBMISSION: "red",
  OTHER: "gray",
};

export default async function ServicesPage() {
  const user = await requirePagePermission("services:view");
  const canEdit = can(user.role, "services:edit");
  const services = await listServices();

  return (
    <>
      <PageHeader
        title="Services"
        description="Service catalogue and default AED rates (excl. VAT). Inactive services can't be picked for new work orders."
        actions={
          canEdit && (
            <ServiceDialog>
              <Button>
                <Plus /> New service
              </Button>
            </ServiceDialog>
          )
        }
      />
      <div className="bg-card rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Service</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Default rate</TableHead>
              <TableHead className="text-right">Orders</TableHead>
              <TableHead>Status</TableHead>
              {canEdit && <TableHead className="pr-4 text-right"><span className="sr-only">Edit</span></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {services.length === 0 && (
              <TableRow>
                <TableCell colSpan={canEdit ? 6 : 5} className="text-muted-foreground py-12 text-center">
                  No services yet.{canEdit && " Add your first service to start taking work orders."}
                </TableCell>
              </TableRow>
            )}
            {services.map((s) => (
              <TableRow key={s.id} className={cn(!s.isActive && "opacity-60")}>
                <TableCell className="max-w-96 pl-4">
                  <div className="font-medium">{s.title}</div>
                  {s.description && <div className="text-muted-foreground truncate text-xs">{s.description}</div>}
                </TableCell>
                <TableCell>
                  <ToneBadge tone={CATEGORY_TONE[s.category]}>{SERVICE_CATEGORY_LABEL[s.category]}</ToneBadge>
                </TableCell>
                <TableCell className="text-right whitespace-nowrap tabular-nums">
                  {formatAED(s.defaultPrice)}
                  <span className="text-muted-foreground text-xs"> / {SERVICE_UNIT_LABEL[s.unit]}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{s.orders}</TableCell>
                <TableCell>
                  {canEdit ? (
                    <ActiveToggle id={s.id} active={s.isActive} label={s.title} />
                  ) : (
                    <ToneBadge tone={s.isActive ? "green" : "gray"}>{s.isActive ? "Active" : "Inactive"}</ToneBadge>
                  )}
                </TableCell>
                {canEdit && (
                  <TableCell className="pr-4 text-right">
                    <ServiceDialog
                      serviceId={s.id}
                      defaultValues={{ title: s.title, category: s.category, unit: s.unit, defaultPrice: s.defaultPrice, description: s.description ?? "" }}
                    >
                      <Button variant="ghost" size="icon-sm" aria-label={`Edit ${s.title}`}>
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
