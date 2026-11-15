import { Plus } from "lucide-react";
import { EmployeeDialog } from "@/components/employees/employee-controls";
import { EmployeeTable } from "@/components/employees/employee-table";
import { LogoCard, SettingsForm } from "@/components/settings/settings-form";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { requirePagePermission } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { listEmployees } from "@/server/queries/employees";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requirePagePermission("settings:manage");
  const [s, employees] = await Promise.all([getSettings(), listEmployees()]);

  return (
    <>
      <PageHeader title="Settings" description="Company details, VAT and invoice terms printed on every invoice and quotation, and staff accounts." />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <SettingsForm
          defaultValues={{
            companyName: s.companyName,
            companyTaxNo: s.companyTaxNo,
            companyPhone: s.companyPhone,
            companyEmail: s.companyEmail,
            companyAddress: s.companyAddress,
            vatPercent: s.vatRate.times(100).toString(),
            invoiceTerms: s.invoiceTerms,
          }}
        />
        <LogoCard url={s.companyLogo} />
      </div>

      <section id="employees" className="mt-8 scroll-mt-20" aria-labelledby="employees-heading">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="employees-heading" className="font-medium">
              Employees
            </h2>
            <p className="text-muted-foreground mt-0.5 text-sm">
              Add staff logins, reset passwords and remove people who leave. Deactivate keeps their work history; delete is only offered for accounts with nothing on record.
            </p>
          </div>
          <EmployeeDialog canGrantAdmin>
            <Button>
              <Plus /> New employee
            </Button>
          </EmployeeDialog>
        </div>
        <EmployeeTable employees={employees} user={user} />
      </section>
    </>
  );
}
