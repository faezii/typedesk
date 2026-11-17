import { getT } from "@/lib/i18n/server";
import { Pencil } from "lucide-react";
import type { Department, Role } from "@prisma/client";
import { EmployeeDialog, EmployeeRowActions } from "@/components/employees/employee-controls";
import { ToneBadge, type Tone } from "@/components/shared/tone-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { can } from "@/lib/auth/permissions";
import { formatDateTime, initials } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { listEmployees } from "@/server/queries/employees";

const DEPT: Record<Department, { label: string; tone: Tone }> = {
  MANAGEMENT: { label: "Management", tone: "violet" },
  TYPING: { label: "Typing", tone: "blue" },
  TRANSLATION: { label: "Translation", tone: "green" },
  FINANCE: { label: "Finance", tone: "amber" },
};
const ROLE_LABEL: Record<Role, string> = { ADMIN: "Admin", MANAGER: "Manager", FINANCE: "Finance", STAFF: "Staff" };

/** Staff list with workload counters and edit / reset / deactivate / delete controls (Employees page and Settings). */
export async function EmployeeTable({ employees, user }: { employees: Awaited<ReturnType<typeof listEmployees>>; user: { id: string; role: Role } }) {
  const t = await getT();
  const canEdit = can(user.role, "employees:edit");
  const canGrantAdmin = can(user.role, "employees:manageAdmins");

  return (
    <div className="bg-card rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="ps-4">{t("Employee")}</TableHead>
            <TableHead>{t("Department")}</TableHead>
            <TableHead>{t("Role")}</TableHead>
            <TableHead className="text-end">{t("Open tasks")}</TableHead>
            <TableHead className="text-end">{t("Active orders")}</TableHead>
            <TableHead className="text-end">{t("Delivered (mo)")}</TableHead>
            <TableHead className="text-end">{t("Tasks done (mo)")}</TableHead>
            <TableHead>{t("Last sign-in")}</TableHead>
            <TableHead className="pe-4 text-end">
              <span className="sr-only">{t("Actions")}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((e) => {
            // Managers can't change admins (see CLAUDE.md roles table).
            const editable = canEdit && (canGrantAdmin || e.role !== "ADMIN");
            return (
              <TableRow key={e.id} className={cn(!e.isActive && "opacity-60")}>
                <TableCell className="ps-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{initials(e.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="font-medium">
                        {e.name}
                        {e.id === user.id && <span className="text-muted-foreground font-normal"> {t("(you)")}</span>}
                      </div>
                      <div className="text-muted-foreground truncate text-xs">
                        {e.email}
                        {e.phone && (
                          <>
                            {" · "}
                            <span dir="ltr">{e.phone}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <ToneBadge tone={DEPT[e.department].tone}>{t(DEPT[e.department].label)}</ToneBadge>
                </TableCell>
                <TableCell className="text-sm">
                  {t(ROLE_LABEL[e.role])}
                  {!e.isActive && <div className="text-destructive text-xs">{t("Deactivated")}</div>}
                  {e.isActive && e.mustChangePassword && <div className="text-xs text-amber-700 dark:text-amber-400">{t("Temp password")}</div>}
                </TableCell>
                <TableCell className="text-end tabular-nums">{e.openTasks}</TableCell>
                <TableCell className="text-end tabular-nums">{e.activeOrders}</TableCell>
                <TableCell className="text-end tabular-nums">{e.deliveredThisMonth}</TableCell>
                <TableCell className="text-end tabular-nums">{e.tasksDoneThisMonth}</TableCell>
                <TableCell className="text-muted-foreground text-xs">{e.lastLoginAt ? formatDateTime(e.lastLoginAt, t.lang) : t("Never")}</TableCell>
                <TableCell className="pe-4">
                  <div className="flex justify-end gap-1">
                    {editable && (
                      <EmployeeDialog
                        employeeId={e.id}
                        canGrantAdmin={canGrantAdmin}
                        defaultValues={{ name: e.name, email: e.email, phone: e.phone ?? "", role: e.role, department: e.department }}
                      >
                        <Button variant="ghost" size="icon-sm" aria-label={t("Edit {name}", { name: e.name })} title={t("Edit")}>
                          <Pencil />
                        </Button>
                      </EmployeeDialog>
                    )}
                    <EmployeeRowActions id={e.id} name={e.name} active={e.isActive} editable={editable} isSelf={e.id === user.id} deletable={e.deletable} />
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
