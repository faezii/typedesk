import { getT } from "@/lib/i18n/server";
import Link from "next/link";
import { Building2, ChevronRight, Plus, User, Users } from "lucide-react";
import { CustomerFormSheet } from "@/components/customers/customer-form-sheet";
import { ExpiryBadge } from "@/components/shared/expiry-badge";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { FilterSelect, SearchInput } from "@/components/shared/url-filters";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { requirePagePermission } from "@/lib/auth/session";
import { formatMoney } from "@/lib/format";
import { PAGE_SIZE, listCustomers, type CustomerListParams } from "@/server/queries/customers";

export async function generateMetadata() {
  return { title: (await getT())("Customers") };
}

export default async function CustomersPage({ searchParams }: { searchParams: Promise<CustomerListParams> }) {
  const t = await getT();
  const user = await requirePagePermission("customers:view");
  const params = await searchParams;
  const { rows, total, page } = await listCustomers(params);
  const filtered = !!(params.q || params.type || params.expiry);

  return (
    <>
      <PageHeader
        title={t("Customers")}
        description={t("Client profiles, identity documents and balances.")}
        actions={
          can(user.role, "customers:edit") && (
            <CustomerFormSheet>
              <Button>
                <Plus /> {t("New customer")}</Button>
            </CustomerFormSheet>
          )
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <SearchInput placeholder={t("Search name, phone, ID…")} />
        <FilterSelect
          param="type"
          label={t("Customer type")}
          allLabel={t("All types")}
          options={[
            { value: "INDIVIDUAL", label: t("Individuals") },
            { value: "COMPANY", label: t("Companies") },
          ]}
        />
        <FilterSelect
          param="expiry"
          label={t("ID status")}
          allLabel={t("Any ID status")}
          options={[
            { value: "expiring", label: t("ID expiring ≤ 30 days") },
            { value: "expired", label: t("ID expired") },
          ]}
        />
      </div>

      <div className="bg-card rounded-xl border">
        {rows.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 px-6 py-16 text-center text-sm">
            <Users className="size-6" />
            {filtered ? t("No customers match these filters.") : t("No customers yet. Add your first customer to get started.")}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="ps-4">{t("Customer")}</TableHead>
                <TableHead>{t("Phone")}</TableHead>
                <TableHead>{t("QID")}</TableHead>
                <TableHead>{t("Passport")}</TableHead>
                <TableHead className="text-end">{t("Outstanding")}</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id} className="group relative">
                  <TableCell className="ps-4">
                    <div className="flex items-center gap-3">
                      <span className="bg-muted text-muted-foreground grid size-8 shrink-0 place-items-center rounded-full">
                        {c.type === "COMPANY" ? <Building2 className="size-4" /> : <User className="size-4" />}
                      </span>
                      <div className="min-w-0">
                        {/* Stretched link: the whole row is clickable, one tab stop per row. */}
                        <Link href={`/customers/${c.id}`} className="font-medium after:absolute after:inset-0 hover:underline">
                          {c.name}
                        </Link>
                        <div className="text-muted-foreground truncate text-xs">{c.companyName ?? c.email ?? t("Individual")}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm whitespace-nowrap tabular-nums">
                      <span dir="ltr">{c.phone}</span>
                    </TableCell>
                  <TableCell>
                    {c.nationalId ? (
                      <div className="space-y-1">
                        <div className="font-mono text-xs">{c.nationalId}</div>
                        <ExpiryBadge date={c.nationalIdExpiry} />
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {c.passportNo ? (
                      <div className="space-y-1">
                        <div className="font-mono text-xs">{c.passportNo}</div>
                        <ExpiryBadge date={c.passportExpiry} />
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {c.outstanding.isZero() ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className="font-medium">{formatMoney(c.outstanding)}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <ChevronRight className="rtl:-scale-x-100 text-muted-foreground size-4 opacity-0 transition-opacity group-hover:opacity-100" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="mt-4">
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} params={{ ...params }} />
      </div>
    </>
  );
}
