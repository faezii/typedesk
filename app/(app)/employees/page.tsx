import { getT } from "@/lib/i18n/server";
import { Plus } from "lucide-react";
import { EmployeeDialog } from "@/components/employees/employee-controls";
import { EmployeeTable } from "@/components/employees/employee-table";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/auth/permissions";
import { requirePagePermission } from "@/lib/auth/session";
import { listEmployees } from "@/server/queries/employees";

export async function generateMetadata() {
  return { title: (await getT())("Employees") };
}

export default async function EmployeesPage() {
  const t = await getT();
  const user = await requirePagePermission("employees:view");
  const employees = await listEmployees();
  const active = employees.filter((e) => e.isActive);

  return (
    <>
      <PageHeader
        title={t("Employees")}
        description={t("{count} active staff. Counters are live: open tasks and orders now, completions this month.", { count: active.length })}
        actions={
          can(user.role, "employees:edit") && (
            <EmployeeDialog canGrantAdmin={can(user.role, "employees:manageAdmins")}>
              <Button>
                <Plus /> {t("New employee")}</Button>
            </EmployeeDialog>
          )
        }
      />
      <EmployeeTable employees={employees} user={user} />
    </>
  );
}
