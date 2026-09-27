import type { Role } from "@prisma/client";

/**
 * Role-based permissions (see CLAUDE.md → Roles & permissions).
 * Pure module: safe to import from the proxy, server and client components.
 */
export const PERMISSIONS = {
  "dashboard:view": ["ADMIN", "MANAGER", "FINANCE", "STAFF"],

  "workOrders:view": ["ADMIN", "MANAGER", "FINANCE", "STAFF"],
  "workOrders:edit": ["ADMIN", "MANAGER", "STAFF"],
  "translation:view": ["ADMIN", "MANAGER", "FINANCE", "STAFF"],

  "tasks:view": ["ADMIN", "MANAGER", "FINANCE", "STAFF"],
  "tasks:edit": ["ADMIN", "MANAGER", "STAFF"],
  /** See everyone's tasks by default (STAFF default to their own). */
  "tasks:viewAll": ["ADMIN", "MANAGER", "FINANCE"],

  "followUps:view": ["ADMIN", "MANAGER", "FINANCE", "STAFF"],
  "followUps:edit": ["ADMIN", "MANAGER", "STAFF"],

  "outsourced:view": ["ADMIN", "MANAGER", "FINANCE"],
  "outsourced:edit": ["ADMIN", "MANAGER"],
  "outsourced:payment": ["ADMIN", "MANAGER", "FINANCE"],

  "customers:view": ["ADMIN", "MANAGER", "FINANCE", "STAFF"],
  "customers:edit": ["ADMIN", "MANAGER", "FINANCE", "STAFF"],
  "documents:view": ["ADMIN", "MANAGER", "FINANCE", "STAFF"],
  "documents:edit": ["ADMIN", "MANAGER", "FINANCE", "STAFF"],
  "services:view": ["ADMIN", "MANAGER", "FINANCE", "STAFF"],
  "services:edit": ["ADMIN", "MANAGER"],

  "employees:view": ["ADMIN", "MANAGER"],
  "employees:edit": ["ADMIN", "MANAGER"],
  /** Grant or revoke the ADMIN role. */
  "employees:manageAdmins": ["ADMIN"],

  "finance:view": ["ADMIN", "MANAGER", "FINANCE"],
  "finance:edit": ["ADMIN", "MANAGER", "FINANCE"],
  "reports:view": ["ADMIN", "MANAGER", "FINANCE"],

  "settings:manage": ["ADMIN"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

/** Route prefix → permission needed to open it. Longest prefix wins. */
const ROUTE_PERMISSIONS: [prefix: string, permission: Permission][] = [
  ["/work-orders", "workOrders:view"],
  ["/translation", "translation:view"],
  ["/tasks", "tasks:view"],
  ["/follow-ups", "followUps:view"],
  ["/outsourced", "outsourced:view"],
  ["/customers", "customers:view"],
  ["/documents", "documents:view"],
  ["/services", "services:view"],
  ["/employees", "employees:view"],
  ["/finance", "finance:view"],
  ["/reports", "reports:view"],
  ["/settings", "settings:manage"],
];

export function permissionForPath(pathname: string): Permission | null {
  if (pathname === "/") return "dashboard:view";
  let match: [string, Permission] | undefined;
  for (const entry of ROUTE_PERMISSIONS) {
    const [prefix] = entry;
    if ((pathname === prefix || pathname.startsWith(`${prefix}/`)) && (!match || prefix.length > match[0].length)) {
      match = entry;
    }
  }
  return match ? match[1] : null;
}

export function canAccessPath(role: Role | null | undefined, pathname: string): boolean {
  const permission = permissionForPath(pathname);
  return permission ? can(role, permission) : true;
}
