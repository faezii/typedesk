import { getT } from "@/lib/i18n/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Mail, Pencil, Phone, Upload, User } from "lucide-react";
import { CustomerFormSheet } from "@/components/customers/customer-form-sheet";
import { DocumentTable } from "@/components/documents/document-table";
import { UploadDialog } from "@/components/documents/upload-dialog";
import { ExpiryBadge } from "@/components/shared/expiry-badge";
import { ToneBadge, type Tone } from "@/components/shared/tone-badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { can } from "@/lib/auth/permissions";
import { requirePagePermission } from "@/lib/auth/session";
import { toDateInput } from "@/lib/dates";
import { formatMoney, formatDate } from "@/lib/format";
import {
  CUSTOMER_TYPE_LABEL,
  FOLLOW_UP_STATUS_LABEL,
  FOLLOW_UP_TYPE_LABEL,
  INVOICE_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
} from "@/lib/labels";
import { getCustomer } from "@/server/queries/customers";
import { WorkOrderStatusBadge } from "@/components/shared/work-order-badges";
import type { FollowUpStatus, InvoiceStatus } from "@prisma/client";

const INVOICE_TONE: Record<InvoiceStatus, Tone> = { UNPAID: "red", PARTIAL: "amber", PAID: "green", CANCELLED: "gray" };
const FOLLOW_UP_TONE: Record<FollowUpStatus, Tone> = { PENDING: "amber", DONE: "green", SNOOZED: "gray" };

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const data = await getCustomer((await params).id);
  return { title: data?.customer.name ?? (await getT())("Customer") };
}

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getT();
  const user = await requirePagePermission("customers:view");
  const data = await getCustomer((await params).id);
  if (!data) notFound();
  const { customer: c, workOrders, invoices, ledger, documents, followUps, totals } = data;
  const finance = can(user.role, "finance:view");

  return (
    <>
      <Link href="/customers" className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="rtl:-scale-x-100 size-4" /> {t("Customers")}</Link>

      {/* Header */}
      <section className="bg-card mb-4 rounded-xl border p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-4">
            <span className="bg-primary/10 text-primary grid size-12 shrink-0 place-items-center rounded-full">
              {c.type === "COMPANY" ? <Building2 className="size-5" /> : <User className="size-5" />}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight">{c.name}</h1>
                <ToneBadge tone="gray">{t(CUSTOMER_TYPE_LABEL[c.type])}</ToneBadge>
              </div>
              {c.companyName && <div className="text-muted-foreground text-sm">{c.companyName}</div>}
              <div className="text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <a href={`tel:${c.phone.replace(/\s/g, "")}`} className="hover:text-foreground inline-flex items-center gap-1.5">
                  <Phone className="size-3.5" /> <span dir="ltr">{c.phone}</span>
                </a>
                {c.email && (
                  <a href={`mailto:${c.email}`} className="hover:text-foreground inline-flex items-center gap-1.5">
                    <Mail className="size-3.5" /> {c.email}
                  </a>
                )}
                {c.nationality && <span>{c.nationality}</span>}
                {c.taxNo && <span>{t("CR / tax no. {taxNo}", { taxNo: c.taxNo })}</span>}
              </div>
            </div>
          </div>
          {can(user.role, "customers:edit") && (
            <CustomerFormSheet
              customerId={c.id}
              defaultValues={{
                type: c.type,
                name: c.name,
                companyName: c.companyName ?? "",
                phone: c.phone,
                email: c.email ?? "",
                nationality: c.nationality ?? "",
                taxNo: c.taxNo ?? "",
                nationalId: c.nationalId ?? "",
                nationalIdExpiry: toDateInput(c.nationalIdExpiry),
                passportNo: c.passportNo ?? "",
                passportExpiry: toDateInput(c.passportExpiry),
                notes: c.notes ?? "",
              }}
            >
              <Button variant="outline">
                <Pencil /> {t("Edit")}</Button>
            </CustomerFormSheet>
          )}
        </div>

        <dl className="mt-5 grid gap-3 border-t pt-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <IdItem label={t("QID")} number={c.nationalId} expiry={c.nationalIdExpiry} />
          <IdItem label={t("Passport")} number={c.passportNo} expiry={c.passportExpiry} />
          {finance && (
            <>
              <div>
                <dt className="text-muted-foreground text-xs">{t("Total billed")}</dt>
                <dd className="mt-1 font-medium tabular-nums">{formatMoney(totals.billed)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">{t("Outstanding balance")}</dt>
                <dd className={`mt-1 font-medium tabular-nums ${totals.outstanding.gt(0) ? "text-destructive" : ""}`}>
                  {formatMoney(totals.outstanding)}
                </dd>
              </div>
            </>
          )}
        </dl>
      </section>

      <Tabs defaultValue="overview">
        <div className="overflow-x-auto overflow-y-hidden">
          <TabsList>
            <TabsTrigger value="overview">{t("Overview")}</TabsTrigger>
            <TabsTrigger value="orders">{t("Work orders ({count})", { count: workOrders.length })}</TabsTrigger>
            {finance && <TabsTrigger value="invoices">{t("Invoices ({count})", { count: invoices.length })}</TabsTrigger>}
            {finance && <TabsTrigger value="payments">{t("Payments")}</TabsTrigger>}
            <TabsTrigger value="documents">{t("Documents ({total})", { total: documents.total })}</TabsTrigger>
            <TabsTrigger value="followups">{t("Follow-ups ({count})", { count: followUps.length })}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card title={t("Recent work orders")} className="lg:col-span-2">
            {workOrders.length === 0 ? (
              <Empty>{t("No work orders yet.")}</Empty>
            ) : (
              <ul className="divide-y">
                {workOrders.slice(0, 5).map((w) => (
                  <li key={w.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <Link href={`/work-orders/${w.id}`} className="font-mono text-[13px] font-medium hover:underline">
                        {w.orderNo}
                      </Link>
                      <div className="text-muted-foreground truncate text-xs">{w.service.title}</div>
                    </div>
                    <WorkOrderStatusBadge status={w.status} revision={w.hasOpenRevision} />
                    <span className="text-muted-foreground w-24 text-end text-xs">{formatDate(w.createdAt, t.lang)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title={t("Notes")}>
            {c.notes ? <p className="text-sm whitespace-pre-wrap">{c.notes}</p> : <Empty>{t("No notes.")}</Empty>}
            <div className="text-muted-foreground mt-4 border-t pt-3 text-xs">{t("Customer since {date}", { date: formatDate(c.createdAt, t.lang) })}</div>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <Card>
            {workOrders.length === 0 ? (
              <Empty>{t("No work orders yet.")}</Empty>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Order")}</TableHead>
                    <TableHead>{t("Service")}</TableHead>
                    <TableHead>{t("Status")}</TableHead>
                    <TableHead>{t("Deadline")}</TableHead>
                    <TableHead className="text-end">{t("Amount")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workOrders.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell>
                        <Link href={`/work-orders/${w.id}`} className="font-mono text-[13px] font-medium hover:underline">
                          {w.orderNo}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-64 truncate">{w.service.title}</TableCell>
                      <TableCell>
                        <WorkOrderStatusBadge status={w.status} revision={w.hasOpenRevision} />
                      </TableCell>
                      <TableCell className="text-sm">{formatDate(w.deadline, t.lang)}</TableCell>
                      <TableCell className="text-end tabular-nums">{formatMoney(w.totalAmount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {finance && (
          <TabsContent value="invoices" className="mt-4">
            <Card>
              {invoices.length === 0 ? (
                <Empty>{t("No invoices yet.")}</Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("Invoice")}</TableHead>
                      <TableHead>{t("Issued")}</TableHead>
                      <TableHead>{t("Due")}</TableHead>
                      <TableHead>{t("Status")}</TableHead>
                      <TableHead className="text-end">{t("Total")}</TableHead>
                      <TableHead className="text-end">{t("Balance")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell>
                          <Link href={`/finance/invoices/${i.id}`} className="font-mono text-[13px] font-medium hover:underline">
                            {i.invoiceNo}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(i.issueDate, t.lang)}</TableCell>
                        <TableCell className="text-sm">{formatDate(i.dueDate, t.lang)}</TableCell>
                        <TableCell>
                          <ToneBadge tone={INVOICE_TONE[i.status]}>{t(INVOICE_STATUS_LABEL[i.status])}</ToneBadge>
                        </TableCell>
                        <TableCell className="text-end tabular-nums">{formatMoney(i.totalAmount)}</TableCell>
                        <TableCell className="text-end tabular-nums">
                          {i.status === "CANCELLED" ? "—" : formatMoney(i.totalAmount.minus(i.amountPaid))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </TabsContent>
        )}

        {finance && (
          <TabsContent value="payments" className="mt-4">
            <Card title={t("Customer ledger")} description={t("Invoices (debit) and payments (credit) in date order, with running balance.")}>
              {ledger.length === 0 ? (
                <Empty>{t("No transactions yet.")}</Empty>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("Date")}</TableHead>
                      <TableHead>{t("Description")}</TableHead>
                      <TableHead className="text-end">{t("Debit")}</TableHead>
                      <TableHead className="text-end">{t("Credit")}</TableHead>
                      <TableHead className="text-end">{t("Balance")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledger.map((e) => (
                      <TableRow key={`${e.kind}-${e.id}`}>
                        <TableCell className="text-sm whitespace-nowrap">{formatDate(e.date, t.lang)}</TableCell>
                        <TableCell className="text-sm">
                          {e.kind === "invoice" ? (
                            <>
                              {t("Invoice")}{" "}<span className="font-mono text-xs">{e.ref}</span>
                            </>
                          ) : (
                            <>
                              {t("Payment · {method} for", { method: t(PAYMENT_METHOD_LABEL[e.method]) })} <span className="font-mono text-xs">{e.ref}</span>
                              {e.reference && <span className="text-muted-foreground"> · {e.reference}</span>}
                            </>
                          )}
                        </TableCell>
                        <TableCell className="text-end tabular-nums">{e.debit ? formatMoney(e.debit) : ""}</TableCell>
                        <TableCell className="text-end tabular-nums">{e.credit ? formatMoney(e.credit) : ""}</TableCell>
                        <TableCell className="text-end font-medium tabular-nums">{formatMoney(e.balance)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </TabsContent>
        )}

        <TabsContent value="documents" className="mt-4">
          <Card
            action={
              can(user.role, "documents:edit") && (
                <UploadDialog defaultCustomer={{ id: c.id, name: c.name }}>
                  <Button size="sm">
                    <Upload /> {t("Upload")}</Button>
                </UploadDialog>
              )
            }
            title={t("Documents")}
          >
            <div className="-mx-5 -mb-5">
              <DocumentTable rows={documents.rows} canDelete={can(user.role, "documents:edit")} showCustomer={false} />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="followups" className="mt-4">
          <Card>
            {followUps.length === 0 ? (
              <Empty>{t("No follow-ups.")}</Empty>
            ) : (
              <ul className="divide-y">
                {followUps.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{f.title}</div>
                      <div className="text-muted-foreground text-xs">
                        {t(FOLLOW_UP_TYPE_LABEL[f.type])}
                        {f.notes && ` · ${f.notes}`}
                      </div>
                    </div>
                    <ToneBadge tone={FOLLOW_UP_TONE[f.status]}>{t(FOLLOW_UP_STATUS_LABEL[f.status])}</ToneBadge>
                    <span className="text-muted-foreground w-24 text-end text-xs">{formatDate(f.deadline, t.lang)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}

async function IdItem({ label, number, expiry }: { label: string; number: string | null; expiry: Date | null }) {
  const t = await getT();
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-1 flex flex-wrap items-center gap-2">
        {number ? <span className="font-mono text-xs">{number}</span> : <span className="text-muted-foreground">{t("Not recorded")}</span>}
        {expiry && (
          <>
            <ExpiryBadge date={expiry} />
            <span className="text-muted-foreground text-xs">{formatDate(expiry, t.lang)}</span>
          </>
        )}
      </dd>
    </div>
  );
}

function Card({
  title,
  description,
  action,
  className,
  children,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`bg-card rounded-xl border p-5 ${className ?? ""}`}>
      {(title || action) && (
        <header className="mb-3 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="font-medium">{title}</h2>}
            {description && <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-muted-foreground py-8 text-center text-sm">{children}</p>;
}
