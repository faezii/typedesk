import { getT } from "@/lib/i18n/server";
import Link from "next/link";
import { Clock, FileCheck2, Handshake, Pencil, Plus, Wallet } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { DeliveryUpload, PaymentButton, QaSelect, VendorActiveToggle } from "@/components/outsourcing/job-controls";
import { AssignmentDialog, VendorDialog } from "@/components/outsourcing/outsourcing-dialogs";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { ToneBadge, type Tone } from "@/components/shared/tone-badge";
import { FilterSelect, SearchInput } from "@/components/shared/url-filters";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requirePagePermission } from "@/lib/auth/session";
import { toDateInput } from "@/lib/dates";
import { formatMoney, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { JOB_PAGE_SIZE, listAssignments, listVendors, outsourcingSummary, vendorOptions, type AssignmentParams } from "@/server/queries/outsourcing";
import type { QaStatus } from "@prisma/client";

export async function generateMetadata() {
  return { title: (await getT())("Outsourced Work") };
}

const QA_TONE: Record<QaStatus, Tone> = { PENDING: "amber", APPROVED: "green", REJECTED: "red" };

export default async function OutsourcedPage({ searchParams }: { searchParams: Promise<AssignmentParams> }) {
  const t = await getT();
  const user = await requirePagePermission("outsourced:view");
  const params = await searchParams;
  const tab = params.tab === "vendors" ? "vendors" : "jobs";
  const canEdit = can(user.role, "outsourced:edit");
  const canPay = can(user.role, "outsourced:payment");
  const [summary, vendors] = await Promise.all([outsourcingSummary(), vendorOptions()]);

  return (
    <>
      <PageHeader
        title={t("Outsourced Work")}
        description={t("Freelancers and agencies: what was sent, QA, what it cost and what's still owed.")}
        actions={
          canEdit &&
          (tab === "jobs" ? (
            <AssignmentDialog vendors={vendors}>
              <Button>
                <Plus /> {t("Outsource work")}</Button>
            </AssignmentDialog>
          ) : (
            <VendorDialog>
              <Button>
                <Plus /> {t("New vendor")}</Button>
            </VendorDialog>
          ))
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={t("Awaiting delivery")} value={summary.awaitingDelivery} sub={t("Sent, nothing received yet")} icon={Clock} />
        <StatCard label={t("Awaiting QA")} value={summary.awaitingQa} sub={t("Delivered, not yet checked")} icon={FileCheck2} />
        <StatCard label={t("Owed to vendors")} value={formatMoney(summary.unpaidAmount)} sub={t("{unpaidCount} unpaid jobs", { unpaidCount: summary.unpaidCount })} icon={Wallet} />
        <StatCard label={t("Paid this month")} value={formatMoney(summary.paidThisMonth)} sub={t("Booked as Freelancer expenses")} icon={Handshake} />
      </div>

      <div className="bg-muted mb-4 inline-flex rounded-lg p-[3px]" role="tablist" aria-label={t("Section")}>
        {[
          { t: "jobs", label: t("Assignments"), href: "?" },
          { t: "vendors", label: t("Vendors"), href: "?tab=vendors" },
        ].map(({ t, label, href }) => (
          <Link
            key={t}
            href={href}
            role="tab"
            aria-selected={tab === t}
            className={cn(
              "inline-flex h-7 items-center rounded-md px-3 text-sm font-medium transition-colors",
              tab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </Link>
        ))}
      </div>

      {tab === "jobs" ? (
        <Assignments params={params} vendors={vendors} canEdit={canEdit} canPay={canPay} />
      ) : (
        <Vendors canEdit={canEdit} />
      )}
    </>
  );
}

async function Assignments({
  params,
  vendors,
  canEdit,
  canPay,
}: {
  params: AssignmentParams;
  vendors: Awaited<ReturnType<typeof vendorOptions>>;
  canEdit: boolean;
  canPay: boolean;
}) {
  const t = await getT();
  const { rows, total, page } = await listAssignments(params);
  return (
    <>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <SearchInput placeholder={t("Vendor, WO number, customer…")} />
        <FilterSelect param="vendor" label={t("Vendor")} allLabel={t("All vendors")} options={vendors.map((v) => ({ value: v.id, label: v.name }))} />
        <FilterSelect
          param="qa"
          label={t("QA")}
          allLabel={t("Any QA status")}
          options={[
            { value: "PENDING", label: t("QA pending") },
            { value: "APPROVED", label: t("Approved") },
            { value: "REJECTED", label: t("Rejected") },
          ]}
        />
        <FilterSelect
          param="payment"
          label={t("Payment")}
          allLabel={t("Paid & unpaid")}
          options={[
            { value: "UNPAID", label: t("Unpaid") },
            { value: "PAID", label: t("Paid") },
          ]}
        />
      </div>
      <div className="bg-card rounded-xl border">
        {rows.length === 0 ? (
          <p className="text-muted-foreground px-6 py-16 text-center text-sm">{t("No outsourced jobs match these filters.")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-4">{t("Job")}</TableHead>
                <TableHead>{t("Vendor")}</TableHead>
                <TableHead>{t("Dates")}</TableHead>
                <TableHead className="text-end">{t("Cost")}</TableHead>
                <TableHead className="text-end">{t("Margin")}</TableHead>
                <TableHead>{t("QA")}</TableHead>
                <TableHead>{t("Payment")}</TableHead>
                <TableHead className="pe-4 text-end">
                  <span className="sr-only">{t("Actions")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="max-w-72 ps-4">
                    <Link href={`/work-orders/${j.workOrder.id}`} className="font-mono text-[13px] font-medium hover:underline">
                      {j.workOrder.orderNo}
                    </Link>
                    <span className="text-muted-foreground text-xs"> · {j.workOrder.customer.name}</span>
                    <div className="truncate text-xs">{j.description}</div>
                    {j.documents[0] && (
                      <a href={j.documents[0].fileUrl} target="_blank" rel="noopener" className="text-primary text-xs hover:underline">
                        {t("Delivered file")}</a>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {j.vendor.name}
                    <div className="text-muted-foreground text-xs">{j.vendor.type === "AGENCY" ? t("Agency") : t("Freelancer")}</div>
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    <div>{t("Sent {date}", { date: formatDate(j.sentAt, t.lang) })}</div>
                    <div className="text-muted-foreground">{t("Due {date}", { date: formatDate(j.dueAt, t.lang) })}</div>
                    <div className={j.receivedAt ? (j.dueAt && j.receivedAt > j.dueAt ? "text-destructive" : "text-emerald-700 dark:text-emerald-400") : "text-muted-foreground"}>
                      {j.receivedAt ? t("Received {date}", { date: formatDate(j.receivedAt, t.lang) }) : t("Not received")}
                    </div>
                  </TableCell>
                  <TableCell className="text-end tabular-nums">{formatMoney(j.agreementCost)}</TableCell>
                  <TableCell className="text-end tabular-nums">
                    <span className={j.margin.isNegative() ? "text-destructive font-medium" : ""}>{formatMoney(j.margin)}</span>
                    {j.pct !== null && <div className="text-muted-foreground text-xs">{t("{pct}% of {amount}", { pct: j.pct, amount: formatMoney(j.workOrder.totalAmount) })}</div>}
                  </TableCell>
                  <TableCell>{canEdit ? <QaSelect id={j.id} status={j.qaStatus} /> : <ToneBadge tone={QA_TONE[j.qaStatus]}>{j.qaStatus.toLowerCase()}</ToneBadge>}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <ToneBadge tone={j.paymentStatus === "PAID" ? "green" : "red"}>{j.paymentStatus === "PAID" ? t("Paid") : t("Unpaid")}</ToneBadge>
                      {canPay && <PaymentButton id={j.id} paid={j.paymentStatus === "PAID"} amount={j.agreementCost.toFixed(2)} vendor={j.vendor.name} />}
                    </div>
                  </TableCell>
                  <TableCell className="pe-4">
                    {canEdit && (
                      <div className="flex justify-end gap-1">
                        <DeliveryUpload id={j.id} />
                        <AssignmentDialog
                          vendors={vendors}
                          jobId={j.id}
                          defaultWorkOrder={{ id: j.workOrder.id, orderNo: j.workOrder.orderNo, subtitle: j.workOrder.customer.name }}
                          defaultValues={{
                            workOrderId: j.workOrder.id,
                            vendorId: j.vendor.id,
                            description: j.description,
                            agreementCost: j.agreementCost.toFixed(2),
                            sentAt: toDateInput(j.sentAt),
                            dueAt: toDateInput(j.dueAt),
                          }}
                        >
                          <Button size="icon-sm" variant="ghost" aria-label={t("Edit job for {orderNo}", { orderNo: j.workOrder.orderNo })}>
                            <Pencil />
                          </Button>
                        </AssignmentDialog>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      <div className="mt-4">
        <Pagination page={page} pageSize={JOB_PAGE_SIZE} total={total} params={{ ...params }} />
      </div>
    </>
  );
}

async function Vendors({ canEdit }: { canEdit: boolean }) {
  const t = await getT();
  const vendors = await listVendors();
  return (
    <div className="bg-card rounded-xl border">
      {vendors.length === 0 ? (
        <p className="text-muted-foreground px-6 py-16 text-center text-sm">{t("No vendors yet.")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="ps-4">{t("Vendor")}</TableHead>
              <TableHead>{t("Languages")}</TableHead>
              <TableHead className="text-end">{t("Jobs")}</TableHead>
              <TableHead className="text-end">{t("Paid")}</TableHead>
              <TableHead className="text-end">{t("Owed")}</TableHead>
              <TableHead className="text-end">{t("QA approved")}</TableHead>
              <TableHead className="text-end">{t("On time")}</TableHead>
              <TableHead>{t("Status")}</TableHead>
              {canEdit && <TableHead className="pe-4" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendors.map((v) => (
              <TableRow key={v.id} className={cn(!v.isActive && "opacity-60")}>
                <TableCell className="ps-4">
                  <div className="font-medium">{v.name}</div>
                  <div className="text-muted-foreground text-xs">
                    {v.type === "AGENCY" ? t("Agency") : t("Freelancer")}
                    {v.phone && (
                      <>
                        {" · "}
                        <span dir="ltr">{v.phone}</span>
                      </>
                    )}
                    {v.email && ` · ${v.email}`}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground max-w-56 text-sm whitespace-normal">{v.languages.join(", ") || "—"}</TableCell>
                <TableCell className="text-end tabular-nums">{v.jobs}</TableCell>
                <TableCell className="text-end tabular-nums">{formatMoney(v.paid)}</TableCell>
                <TableCell className={cn("text-end tabular-nums", v.unpaid.gt(0) && "font-medium")}>{formatMoney(v.unpaid)}</TableCell>
                <TableCell className="text-end tabular-nums">{v.approvalRate === null ? "—" : `${v.approvalRate}%`}</TableCell>
                <TableCell className="text-end tabular-nums">{v.onTimeRate === null ? "—" : `${v.onTimeRate}%`}</TableCell>
                <TableCell>{canEdit ? <VendorActiveToggle id={v.id} active={v.isActive} name={v.name} /> : v.isActive ? t("Active") : t("Inactive")}</TableCell>
                {canEdit && (
                  <TableCell className="pe-4 text-end">
                    <VendorDialog
                      vendorId={v.id}
                      defaultValues={{ name: v.name, type: v.type, phone: v.phone ?? "", email: v.email ?? "", languages: v.languages, notes: v.notes ?? "" }}
                    >
                      <Button size="icon-sm" variant="ghost" aria-label={t("Edit {name}", { name: v.name })}>
                        <Pencil />
                      </Button>
                    </VendorDialog>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
