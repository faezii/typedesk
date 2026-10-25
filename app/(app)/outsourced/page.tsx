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

export const metadata = { title: "Outsourced Work" };

const QA_TONE: Record<QaStatus, Tone> = { PENDING: "amber", APPROVED: "green", REJECTED: "red" };

export default async function OutsourcedPage({ searchParams }: { searchParams: Promise<AssignmentParams> }) {
  const user = await requirePagePermission("outsourced:view");
  const params = await searchParams;
  const tab = params.tab === "vendors" ? "vendors" : "jobs";
  const canEdit = can(user.role, "outsourced:edit");
  const canPay = can(user.role, "outsourced:payment");
  const [summary, vendors] = await Promise.all([outsourcingSummary(), vendorOptions()]);

  return (
    <>
      <PageHeader
        title="Outsourced Work"
        description="Freelancers and agencies: what was sent, QA, what it cost and what's still owed."
        actions={
          canEdit &&
          (tab === "jobs" ? (
            <AssignmentDialog vendors={vendors}>
              <Button>
                <Plus /> Outsource work
              </Button>
            </AssignmentDialog>
          ) : (
            <VendorDialog>
              <Button>
                <Plus /> New vendor
              </Button>
            </VendorDialog>
          ))
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Awaiting delivery" value={summary.awaitingDelivery} sub="Sent, nothing received yet" icon={Clock} />
        <StatCard label="Awaiting QA" value={summary.awaitingQa} sub="Delivered, not yet checked" icon={FileCheck2} />
        <StatCard label="Owed to vendors" value={formatMoney(summary.unpaidAmount)} sub={`${summary.unpaidCount} unpaid jobs`} icon={Wallet} />
        <StatCard label="Paid this month" value={formatMoney(summary.paidThisMonth)} sub="Booked as Freelancer expenses" icon={Handshake} />
      </div>

      <div className="bg-muted mb-4 inline-flex rounded-lg p-[3px]" role="tablist" aria-label="Section">
        {[
          { t: "jobs", label: "Assignments", href: "?" },
          { t: "vendors", label: "Vendors", href: "?tab=vendors" },
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
  const { rows, total, page } = await listAssignments(params);
  return (
    <>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <SearchInput placeholder="Vendor, WO number, customer…" />
        <FilterSelect param="vendor" label="Vendor" allLabel="All vendors" options={vendors.map((v) => ({ value: v.id, label: v.name }))} />
        <FilterSelect
          param="qa"
          label="QA"
          allLabel="Any QA status"
          options={[
            { value: "PENDING", label: "QA pending" },
            { value: "APPROVED", label: "Approved" },
            { value: "REJECTED", label: "Rejected" },
          ]}
        />
        <FilterSelect
          param="payment"
          label="Payment"
          allLabel="Paid & unpaid"
          options={[
            { value: "UNPAID", label: "Unpaid" },
            { value: "PAID", label: "Paid" },
          ]}
        />
      </div>
      <div className="bg-card rounded-xl border">
        {rows.length === 0 ? (
          <p className="text-muted-foreground px-6 py-16 text-center text-sm">No outsourced jobs match these filters.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Job</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Margin</TableHead>
                <TableHead>QA</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="pr-4 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="max-w-72 pl-4">
                    <Link href={`/work-orders/${j.workOrder.id}`} className="font-mono text-[13px] font-medium hover:underline">
                      {j.workOrder.orderNo}
                    </Link>
                    <span className="text-muted-foreground text-xs"> · {j.workOrder.customer.name}</span>
                    <div className="truncate text-xs">{j.description}</div>
                    {j.documents[0] && (
                      <a href={j.documents[0].fileUrl} target="_blank" rel="noopener" className="text-primary text-xs hover:underline">
                        Delivered file
                      </a>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {j.vendor.name}
                    <div className="text-muted-foreground text-xs">{j.vendor.type === "AGENCY" ? "Agency" : "Freelancer"}</div>
                  </TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    <div>Sent {formatDate(j.sentAt)}</div>
                    <div className="text-muted-foreground">Due {formatDate(j.dueAt)}</div>
                    <div className={j.receivedAt ? (j.dueAt && j.receivedAt > j.dueAt ? "text-destructive" : "text-emerald-700 dark:text-emerald-400") : "text-muted-foreground"}>
                      {j.receivedAt ? `Received ${formatDate(j.receivedAt)}` : "Not received"}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(j.agreementCost)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className={j.margin.isNegative() ? "text-destructive font-medium" : ""}>{formatMoney(j.margin)}</span>
                    {j.pct !== null && <div className="text-muted-foreground text-xs">{j.pct}% of {formatMoney(j.workOrder.totalAmount)}</div>}
                  </TableCell>
                  <TableCell>{canEdit ? <QaSelect id={j.id} status={j.qaStatus} /> : <ToneBadge tone={QA_TONE[j.qaStatus]}>{j.qaStatus.toLowerCase()}</ToneBadge>}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <ToneBadge tone={j.paymentStatus === "PAID" ? "green" : "red"}>{j.paymentStatus === "PAID" ? "Paid" : "Unpaid"}</ToneBadge>
                      {canPay && <PaymentButton id={j.id} paid={j.paymentStatus === "PAID"} amount={j.agreementCost.toFixed(2)} vendor={j.vendor.name} />}
                    </div>
                  </TableCell>
                  <TableCell className="pr-4">
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
                          <Button size="icon-sm" variant="ghost" aria-label={`Edit job for ${j.workOrder.orderNo}`}>
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
  const vendors = await listVendors();
  return (
    <div className="bg-card rounded-xl border">
      {vendors.length === 0 ? (
        <p className="text-muted-foreground px-6 py-16 text-center text-sm">No vendors yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Vendor</TableHead>
              <TableHead>Languages</TableHead>
              <TableHead className="text-right">Jobs</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Owed</TableHead>
              <TableHead className="text-right">QA approved</TableHead>
              <TableHead className="text-right">On time</TableHead>
              <TableHead>Status</TableHead>
              {canEdit && <TableHead className="pr-4" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendors.map((v) => (
              <TableRow key={v.id} className={cn(!v.isActive && "opacity-60")}>
                <TableCell className="pl-4">
                  <div className="font-medium">{v.name}</div>
                  <div className="text-muted-foreground text-xs">
                    {v.type === "AGENCY" ? "Agency" : "Freelancer"}
                    {v.phone && ` · ${v.phone}`}
                    {v.email && ` · ${v.email}`}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground max-w-56 text-sm whitespace-normal">{v.languages.join(", ") || "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{v.jobs}</TableCell>
                <TableCell className="text-right tabular-nums">{formatMoney(v.paid)}</TableCell>
                <TableCell className={cn("text-right tabular-nums", v.unpaid.gt(0) && "font-medium")}>{formatMoney(v.unpaid)}</TableCell>
                <TableCell className="text-right tabular-nums">{v.approvalRate === null ? "—" : `${v.approvalRate}%`}</TableCell>
                <TableCell className="text-right tabular-nums">{v.onTimeRate === null ? "—" : `${v.onTimeRate}%`}</TableCell>
                <TableCell>{canEdit ? <VendorActiveToggle id={v.id} active={v.isActive} name={v.name} /> : v.isActive ? "Active" : "Inactive"}</TableCell>
                {canEdit && (
                  <TableCell className="pr-4 text-right">
                    <VendorDialog
                      vendorId={v.id}
                      defaultValues={{ name: v.name, type: v.type, phone: v.phone ?? "", email: v.email ?? "", languages: v.languages, notes: v.notes ?? "" }}
                    >
                      <Button size="icon-sm" variant="ghost" aria-label={`Edit ${v.name}`}>
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
