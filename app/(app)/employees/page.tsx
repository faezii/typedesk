import { Plus } from "lucide-react";
import { EmployeeDialog } from "@/components/employees/employee-controls";
import { EmployeeTable } from "@/components/employees/employee-table";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { can } from "@/lib/auth/permissions";
import { requirePagePermission } from "@/lib/auth/session";
import { listEmployees } from "@/server/queries/employees";

export const metadata = { title: "Employees" };

export default async function EmployeesPage() {
  const user = await requirePagePermission("employees:view");
  const employees = await listEmployees();
  const active = employees.filter((e) => e.isActive);

  return (
    <>
      <PageHeader
        title="Employees"
        description={`${active.length} active staff. Counters are live: open tasks and orders now, completions this month.`}
        actions={
          can(user.role, "employees:edit") && (
            <EmployeeDialog canGrantAdmin={can(user.role, "employees:manageAdmins")}>
              <Button>
                <Plus /> New employee
              </Button>
            </EmployeeDialog>
          )
        }
      />
      <EmployeeTable employees={employees} user={user} />
    </>
  );
}
