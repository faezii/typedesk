import { Prisma, type PrismaClient } from "@prisma/client";

/**
 * Center (organization) scoping for Prisma. Every model except these carries organizationId:
 * reads, updates and deletes get `organizationId` added to their `where`, and created rows
 * (including rows created through nested `create`) get it stamped on.
 * Cross-center links (a work order pointing at another center's customer) are refused by the
 * `same_center_fk` triggers in the database, which run inside the same transaction.
 */
const UNSCOPED = new Set(["Organization", "AuthToken"]);

const MODELS = new Map(Prisma.dmmf.datamodel.models.map((m) => [m.name, m]));
export const isTenantModel = (model: string) => MODELS.has(model) && !UNSCOPED.has(model);

const relationTargets = new Map(
  [...MODELS.values()].map((m) => [m.name, new Map(m.fields.filter((f) => f.kind === "object").map((f) => [f.name, f.type]))]),
);

type Data = Record<string, unknown>;
const isObject = (v: unknown): v is Data =>
  typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Date) && !Prisma.Decimal.isDecimal(v);
const each = (v: unknown, f: (d: Data) => Data) => (Array.isArray(v) ? v.map(f) : f(v as Data));

/** A row being created, with its center and its nested creates stamped. */
function stamp(model: string, data: Data, orgId: string): Data {
  const out = nested(model, data, orgId);
  return isTenantModel(model) ? { ...out, organizationId: orgId } : out;
}

/** Stamps rows created through nested writes; refuses nested writes that could reach another center's rows. */
function nested(model: string, data: Data, orgId: string): Data {
  const relations = relationTargets.get(model)!;
  const out: Data = { ...data };
  for (const [field, value] of Object.entries(data)) {
    const target = relations.get(field);
    if (!target || !isObject(value)) continue;
    const write: Data = {};
    for (const [op, arg] of Object.entries(value)) {
      if (op === "create") write.create = each(arg, (d) => stamp(target, d, orgId));
      else if (op === "createMany" && isObject(arg)) write.createMany = { ...arg, data: each(arg.data, (d) => stamp(target, d, orgId)) };
      else if (op === "deleteMany") write.deleteMany = each(arg ?? {}, (w) => ({ ...w, organizationId: orgId }));
      else throw new Error(`Nested "${op}" on ${model}.${field} isn't supported by the center scope; write the related row on its own.`);
    }
    out[field] = write;
  }
  return out;
}

const withoutCenter = (data: Data): Data => Object.fromEntries(Object.entries(data).filter(([k]) => k !== "organizationId"));

const WITH_WHERE = new Set([
  "findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy",
  "update", "updateMany", "updateManyAndReturn", "delete", "deleteMany", "upsert",
]);

/** The query arguments with the center added. Pure, so it is unit-tested on its own. */
export function scopeArgs(model: string, operation: string, args: unknown, orgId: string): Data {
  const a: Data = { ...((args as Data) ?? {}) };
  if (!isTenantModel(model)) return a;
  if (WITH_WHERE.has(operation)) a.where = { ...(a.where as Data), organizationId: orgId };
  switch (operation) {
    case "create":
      a.data = stamp(model, a.data as Data, orgId);
      break;
    case "createMany":
    case "createManyAndReturn":
      a.data = each(a.data, (d) => stamp(model, d, orgId));
      break;
    case "update":
    case "updateMany":
    case "updateManyAndReturn": {
      a.data = nested(model, withoutCenter(a.data as Data), orgId); // a row never changes center
      break;
    }
    case "upsert": {
      a.create = stamp(model, a.create as Data, orgId);
      a.update = nested(model, withoutCenter(a.update as Data), orgId);
      break;
    }
  }
  return a;
}

/** `base` limited to one center. `orgId` is called per query (it may look up the signed-in user). */
export function withTenant(base: PrismaClient, orgId: () => string | Promise<string>) {
  return base.$extends({
    name: "tenant",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!isTenantModel(model)) return query(args);
          return query(scopeArgs(model, operation, args, await orgId()) as typeof args);
        },
      },
    },
  });
}
