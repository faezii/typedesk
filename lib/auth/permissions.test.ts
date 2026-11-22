import { describe, expect, it } from "vitest";
import type { Role } from "@prisma/client";
import { navForRole } from "@/lib/nav";
import { can, canAccessPath, permissionForPath, type Permission } from "./permissions";

const ROLES: Role[] = ["ADMIN", "MANAGER", "FINANCE", "STAFF"];

// The roles table in CLAUDE.md, one row per permission: which roles have it.
const MATRIX: [Permission, Role[]][] = [
  ["dashboard:view", ["ADMIN", "MANAGER", "FINANCE", "STAFF"]],
  ["dashboard:viewAll", ["ADMIN", "MANAGER", "FINANCE"]],
  ["workOrders:edit", ["ADMIN", "MANAGER", "STAFF"]],
  ["tasks:viewAll", ["ADMIN", "MANAGER", "FINANCE"]],
  ["outsourced:view", ["ADMIN", "MANAGER", "FINANCE"]],
  ["outsourced:edit", ["ADMIN", "MANAGER"]],
  ["outsourced:payment", ["ADMIN", "MANAGER", "FINANCE"]],
  ["services:edit", ["ADMIN", "MANAGER"]],
  ["employees:edit", ["ADMIN", "MANAGER"]],
  ["employees:manageAdmins", ["ADMIN"]],
  ["finance:edit", ["ADMIN", "MANAGER", "FINANCE"]],
  ["reports:view", ["ADMIN", "MANAGER", "FINANCE"]],
  ["settings:manage", ["ADMIN"]],
];

describe("can", () => {
  it.each(MATRIX)("%s", (perm, allowed) => {
    for (const role of ROLES) expect(can(role, perm), `${role} ${perm}`).toBe(allowed.includes(role));
  });
  it("denies a missing role", () => expect(can(undefined, "dashboard:view")).toBe(false));
});

describe("route gating", () => {
  it("longest prefix wins", () => {
    expect(permissionForPath("/finance/invoices/abc")).toBe("finance:view");
    expect(permissionForPath("/settings")).toBe("settings:manage");
    expect(permissionForPath("/")).toBe("dashboard:view");
  });
  it("doesn't match a prefix inside a word", () => expect(permissionForPath("/reportsx")).toBeNull());
  it("STAFF can't open finance, reports, employees or settings", () => {
    for (const p of ["/finance/invoices", "/reports/vat", "/employees", "/settings", "/outsourced"]) expect(canAccessPath("STAFF", p), p).toBe(false);
    for (const p of ["/work-orders", "/customers/1", "/tasks", "/account"]) expect(canAccessPath("STAFF", p), p).toBe(true);
  });
  it("only ADMIN opens settings", () => expect(ROLES.filter((r) => canAccessPath(r, "/settings"))).toEqual(["ADMIN"]));
});

describe("navForRole", () => {
  const titles = (role: Role) => navForRole(role).flatMap((g) => g.items.map((i) => i.title));
  it("hides sections the role can't open", () => {
    expect(titles("STAFF")).not.toContain("Invoices & Quotes");
    expect(titles("STAFF")).not.toContain("Settings");
    expect(titles("FINANCE")).not.toContain("Employees");
    expect(titles("MANAGER")).not.toContain("Settings");
    expect(titles("ADMIN")).toContain("Settings");
  });
  it("drops empty groups", () => expect(navForRole("STAFF").every((g) => g.items.length > 0)).toBe(true));

  it("shows Center management only to TypeDesk owners", () => {
    expect(titles("ADMIN")).not.toContain("Center management");
    expect(navForRole("STAFF", true).flatMap((g) => g.items.map((i) => i.title))).toContain("Center management");
  });
});
