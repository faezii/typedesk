import { getT } from "@/lib/i18n/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FilePlus2, Handshake, Pencil, Plus, Upload } from "lucide-react";
import { AssignmentDialog } from "@/components/outsourcing/outsourcing-dialogs";
import { vendorOptions } from "@/server/queries/outsourcing";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { activeUserOptions } from "@/server/queries/employees";
import { DocumentTable } from "@/components/documents/document-table";
import { UploadDialog } from "@/components/documents/upload-dialog";
import { ToneBadge, type Tone } from "@/components/shared/tone-badge";
import { DeadlineText, PriorityBadge, WorkOrderStatusBadge } from "@/components/shared/work-order-badges";
import { Button } from "@/components/ui/button";
import { RevisionButton, StatusSelect } from "@/components/work-orders/work-order-actions";
import { WorkOrderSheet } from "@/components/work-orders/work-order-sheet";
import { can } from "@/lib/auth/permissions";
import { requirePagePermission } from "@/lib/auth/session";
import { toDateTimeInput } from "@/lib/dates";
import { formatMoney, formatDate, formatDateTime } from "@/lib/format";
import { INVOICE_STATUS_LABEL, SERVICE_UNIT_LABEL } from "@/lib/labels";
import { getWorkOrder, workOrderFormOptions } from "@/server/queries/work-orders";
import type { InvoiceStatus } from "@prisma/client";

const INVOICE_TONE: Record<InvoiceStatus, Tone> = { UNPAID: "red", PARTIAL: "amber", PAID: "green", CANCELLED: "gray" };
const TASK_TONE = { TODO: "gray", IN_PROGRESS: "blue", DONE: "green" } as const;
const TASK_LABEL = { TODO: "To do", IN_PROGRESS: "In progress", DONE: "Done" } as const;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const wo = await getWorkOrder((await params).id);
  return { title: wo?.orderNo ?? (await getT())("Work order") };
}

export default async function WorkOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getT();
  const user = await requirePagePermission("workOrders:view");
  const wo = await getWorkOrder((await params).id);
  if (!wo) notFound();
  const canEdit = can(user.role, "workOrders:edit");
  const finance = can(user.role, "finance:view");
  const now = new Date();

  const [options, taskUsers, vendors] = await Promise.all([
    canEdit ? workOrderFormOptions() : null,
    can(user.role, "tasks:edit") ? activeUserOptions() : null,
    can(user.role, "outsourced:edit") ? vendorOptions() : null,
  ]);
  // Keep a retired service selectable when editing an order that already uses it.
  if (options && !options.services.some((s) => s.id === wo.serviceId)) {
    options.services.push({ id: wo.service.id, title: `${wo.service.title} (inactive)`, category: wo.service.category, unit: wo.service.unit, defaultPrice: wo.service.defaultPrice.toFixed(2) });
  }

  return (
    <>
      <Link href="/work-orders" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="rtl:-scale-x-100 size-4" /> {t("Work orders")}</Link>

      <section className="bg-card mb-4 rounded-xl border p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-mono text-xl font-semibold tracking-tight">{wo.orderNo}</h1>
              <WorkOrderStatusBadge status={wo.status} revision={wo.hasOpenRevision} />
              <PriorityBadge priority={wo.priority} />
            </div>
            <div className="mt-1 text-sm">
              <Link href={`/customers/${wo.customer.id}`} className="font-medium hover:underline">
                {wo.customer.name}
              </Link>
              <span className="text-muted-foreground"> · {wo.service.title}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canEdit && <StatusSelect id={wo.id} status={wo.status} locked={wo.hasOpenRevision} />}
            {canEdit && (wo.status === "DELIVERED" || wo.hasOpenRevision) && <RevisionButton id={wo.id} open={wo.hasOpenRevision} />}
            {canEdit && options && (
              <WorkOrderSheet
                options={options}
                workOrderId={wo.id}
                defaultCustomer={{ id: wo.customer.id, name: wo.customer.name }}
                defaultValues={{
                  customerId: wo.customerId,
                  serviceId: wo.serviceId,
                  quantity: wo.quantity.toString(),
                  unitPrice: wo.unitPrice.toFixed(2),
                  priority: wo.priority,
                  deadline: toDateTimeInput(wo.deadline),
                  assignedToId: wo.assignedToId ?? "",
                  notes: wo.notes ?? "",
                  translation: {
                    sourceLang: wo.translation?.sourceLang ?? "Arabic",
                    targetLang: wo.translation?.targetLang ?? "English",
                    pageCount: wo.translation ? String(wo.translation.pageCount) : "",
                    wordCount: wo.translation ? String(wo.translation.wordCount) : "",
                    isCertified: wo.translation?.isCertified ?? true,
                  },
                }}
              >
                <Button variant="outline">
                  <Pencil /> {t("Edit")}</Button>
              </WorkOrderSheet>
            )}
            {finance && wo.status === "DELIVERED" && wo.invoices.length === 0 && (
              <Button asChild>
                <Link href={`/finance/invoices/new?workOrderId=${wo.id}`}>
                  <FilePlus2 /> {t("Create invoice")}</Link>
              </Button>
            )}
          </div>
        </div>

        <dl className="mt-5 grid gap-4 border-t pt-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Item label={t("Amount (excl. VAT)")}>
            <span className="font-medium tabular-nums">{formatMoney(wo.totalAmount)}</span>
            <div className="text-muted-foreground text-xs">
              {wo.quantity.toString()} {t(SERVICE_UNIT_LABEL[wo.service.unit])}
              {wo.quantity.eq(1) ? "" : "s"} × {formatMoney(wo.unitPrice)}
            </div>
          </Item>
          <Item label={t("Deadline")}>
            {wo.deadline ? <div>{formatDateTime(wo.deadline, t.lang)}</div> : null}
            <DeadlineText deadline={wo.deadline} done={wo.status === "DELIVERED"} now={now} />
          </Item>
          <Item label={t("Assigned to")}>{wo.assignedTo?.name ?? <span className="text-muted-foreground">{t("Unassigned")}</span>}</Item>
          <Item label={wo.deliveredAt ? t("Delivered") : t("Received")}>{formatDateTime(wo.deliveredAt ?? wo.createdAt, t.lang)}</Item>
          {wo.translation && (
            <>
              <Item label={t("Languages")}>
                {t("{from} → {to}", { from: t(wo.translation.sourceLang), to: t(wo.translation.targetLang) })}
              </Item>
              <Item label={t("Size")}>{t("{pageCount} pages · {value} words", { pageCount: wo.translation.pageCount, value: wo.translation.wordCount.toLocaleString("en-QA") })}</Item>
              <Item label={t("Certification")}>{wo.translation.isCertified ? t("Certified (MOJ)") : t("Not certified")}</Item>
            </>
          )}
          {wo.notes && (
            <Item label={t("Notes")} className="sm:col-span-2 lg:col-span-4">
              <p className="whitespace-pre-wrap">{wo.notes}</p>
            </Item>
          )}
        </dl>
      </section>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          {wo.revisions.length > 0 && (
            <Card title={t("Revisions")}>
              <ul className="space-y-3">
                {wo.revisions.map((r) => (
                  <li key={r.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <ToneBadge tone={r.resolvedAt ? "green" : "red"}>{r.resolvedAt ? t("Resolved") : t("Open")}</ToneBadge>
                      <span className="text-muted-foreground text-xs">
                        {formatDateTime(r.requestedAt, t.lang)}
                        {r.requestedBy && ` · ${r.requestedBy.name}`}
                      </span>
                    </div>
                    <p className="mt-2">{r.reason}</p>
                    {r.resolvedAt && (
                      <p className="text-muted-foreground mt-1 text-xs">{r.resolvedBy ? t("Resolved {date} by {name}", { date: formatDateTime(r.resolvedAt, t.lang), name: r.resolvedBy.name }) : t("Resolved {date}", { date: formatDateTime(r.resolvedAt, t.lang) })}
                        {r.resolution && ` — ${r.resolution}`}</p>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card
            title={t("Documents")}
            action={
              can(user.role, "documents:edit") && (
                <UploadDialog defaultCustomer={{ id: wo.customer.id, name: wo.customer.name }} defaultWorkOrderId={wo.id}>
                  <Button size="sm" variant="outline">
                    <Upload /> {t("Upload")}</Button>
                </UploadDialog>
              )
            }
          >
            <div className="-mx-5 -mb-5">
              <DocumentTable rows={wo.documents.rows} canDelete={can(user.role, "documents:edit")} showCustomer={false} emptyText={t("No documents for this order.")} />
            </div>
          </Card>

          <Card
            title={t("Tasks")}
            action={
              can(user.role, "tasks:edit") &&
              taskUsers && (
                <TaskDialog
                  users={taskUsers}
                  defaultWorkOrder={{ id: wo.id, orderNo: wo.orderNo, subtitle: wo.customer.name }}
                  defaultValues={{ title: "", description: "", priority: wo.priority, deadline: toDateTimeInput(wo.deadline), assignedToId: wo.assignedToId ?? "", workOrderId: wo.id }}
                >
                  <Button size="sm" variant="outline">
                    <Plus /> {t("Add task")}</Button>
                </TaskDialog>
              )
            }
          >
            {wo.tasks.length === 0 ? (
              <Empty>{t("No tasks linked to this order.")}</Empty>
            ) : (
              <ul className="divide-y">
                {wo.tasks.map((task) => (
                  <li key={task.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <Link href={`/tasks?assignee=everyone&task=${task.id}`} className="block truncate hover:underline">
                        {task.title}
                      </Link>
                      <div className="text-muted-foreground text-xs">{task.assignedTo?.name ?? t("Unassigned")}</div>
                    </div>
                    <PriorityBadge priority={task.priority} />
                    <ToneBadge tone={TASK_TONE[task.status]}>{t(TASK_LABEL[task.status])}</ToneBadge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {can(user.role, "outsourced:view") && (wo.outsourced.length > 0 || vendors) && (
            <Card
              title={t("Outsourced")}
              action={
                vendors && (
                  <AssignmentDialog vendors={vendors} defaultWorkOrder={{ id: wo.id, orderNo: wo.orderNo, subtitle: wo.customer.name }}>
                    <Button size="sm" variant="outline">
                      <Handshake /> {t("Outsource")}</Button>
                  </AssignmentDialog>
                )
              }
            >
              {wo.outsourced.length === 0 && <Empty>{t("Not outsourced.")}</Empty>}
              <ul className="divide-y">
                {wo.outsourced.map((o) => (
                  <li key={o.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{o.vendor.name}</div>
                      <div className="text-muted-foreground truncate text-xs">{o.description}</div>
                    </div>
                    <ToneBadge tone={o.qaStatus === "APPROVED" ? "green" : o.qaStatus === "REJECTED" ? "red" : "amber"}>{t(`QA ${o.qaStatus.toLowerCase()}`)}</ToneBadge>
                    {finance && <span className="w-24 text-end tabular-nums">{formatMoney(o.agreementCost)}</span>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          {finance && (
            <Card title={t("Invoicing")}>
              {wo.invoices.length === 0 ? (
                <Empty>{wo.status === "DELIVERED" ? t("Delivered but not invoiced yet.") : t("Not invoiced yet.")}</Empty>
              ) : (
                <ul className="divide-y">
                  {wo.invoices.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 py-2.5 text-sm">
                      <div className="min-w-0 flex-1">
                        <Link href={`/finance/invoices/${i.id}`} className="font-mono text-[13px] font-medium hover:underline">
                          {i.invoiceNo}
                        </Link>
                        <div className="text-muted-foreground text-xs">{formatDate(i.issueDate, t.lang)}</div>
                      </div>
                      <ToneBadge tone={INVOICE_TONE[i.status]}>{t(INVOICE_STATUS_LABEL[i.status])}</ToneBadge>
                      <span className="tabular-nums">{formatMoney(i.totalAmount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          <Card title={t("Timeline")}>
            {wo.activity.length === 0 ? (
              <Empty>{t("No activity yet.")}</Empty>
            ) : (
              <ol className="relative space-y-4 border-s ps-4">
                {wo.activity.map((a) => (
                  <li key={a.id} className="relative text-sm">
                    <span
                      className={`absolute top-1.5 -start-[21px] size-2.5 rounded-full border-2 border-card ${a.action.startsWith("revision") ? "bg-red-500" : a.action === "status_changed" ? "bg-primary" : "bg-muted-foreground/50"}`}
                      aria-hidden
                    />
                    <div>{a.message}</div>
                    <div className="text-muted-foreground text-xs">
                      {formatDateTime(a.createdAt, t.lang)}
                      {a.user && ` · ${a.user.name}`}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Item({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-card rounded-xl border p-5">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-medium">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground py-6 text-center text-sm">{children}</p>;
}
