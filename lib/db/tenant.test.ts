import { describe, expect, it } from "vitest";
import { isTenantModel, scopeArgs } from "./tenant";

const ORG = "org_a";

describe("scopeArgs", () => {
  it("adds the center to reads, updates and deletes", () => {
    expect(scopeArgs("Customer", "findMany", { where: { deletedAt: null } }, ORG)).toEqual({ where: { deletedAt: null, organizationId: ORG } });
    expect(scopeArgs("Customer", "findUnique", { where: { id: "c1" } }, ORG).where).toEqual({ id: "c1", organizationId: ORG });
    expect(scopeArgs("Invoice", "count", undefined, ORG)).toEqual({ where: { organizationId: ORG } });
    expect(scopeArgs("Task", "deleteMany", {}, ORG).where).toEqual({ organizationId: ORG });
  });

  it("stamps created rows, including nested creates", () => {
    const a = scopeArgs("Invoice", "create", { data: { customerId: "c1", items: { create: [{ description: "x" }, { description: "y" }] } } }, ORG);
    expect(a.data).toEqual({
      customerId: "c1",
      organizationId: ORG,
      items: { create: [{ description: "x", organizationId: ORG }, { description: "y", organizationId: ORG }] },
    });
    expect(scopeArgs("Task", "createMany", { data: [{ title: "a" }] }, ORG).data).toEqual([{ title: "a", organizationId: ORG }]);
  });

  it("overrides a center sent in the data and never moves a row to another center", () => {
    expect(scopeArgs("Customer", "create", { data: { name: "n", organizationId: "org_b" } }, ORG).data).toEqual({ name: "n", organizationId: ORG });
    expect(scopeArgs("Customer", "update", { where: { id: "c1" }, data: { name: "n", organizationId: "org_b" } }, ORG).data).toEqual({ name: "n" });
  });

  it("scopes upserts on both sides", () => {
    const a = scopeArgs("Setting", "upsert", { where: { organizationId_key: { organizationId: ORG, key: "k" } }, create: { key: "k", value: "1" }, update: { value: "1" } }, ORG);
    expect(a.where).toEqual({ organizationId_key: { organizationId: ORG, key: "k" }, organizationId: ORG });
    expect(a.create).toEqual({ key: "k", value: "1", organizationId: ORG });
  });

  it("refuses nested writes that could reach another center's rows", () => {
    expect(() => scopeArgs("WorkOrder", "create", { data: { customer: { connect: { id: "c1" } } } }, ORG)).toThrow(/isn't supported/);
  });

  it("leaves unscoped models alone", () => {
    expect(isTenantModel("AuthToken")).toBe(false);
    expect(isTenantModel("Organization")).toBe(false);
    expect(scopeArgs("AuthToken", "findUnique", { where: { tokenHash: "h" } }, ORG)).toEqual({ where: { tokenHash: "h" } });
  });
});
