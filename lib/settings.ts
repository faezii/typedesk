import "server-only";
import { cache } from "react";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export const DEFAULT_PAYMENT_DAYS = 15;

/** Company details, VAT rate and invoice terms from the Setting table (once per request). */
export const getSettings = cache(async () => {
  const rows = await prisma.setting.findMany();
  const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const vat = Number(s.vatRate);
  return {
    // Missing or mistyped: no VAT (Qatar has none today).
    vatRate: new Prisma.Decimal(Number.isFinite(vat) && vat >= 0 && vat < 1 ? s.vatRate! : "0"),
    companyName: s.companyName ?? "TypeDesk",
    companyTaxNo: s.companyTaxNo ?? "",
    companyAddress: s.companyAddress ?? "",
    companyPhone: s.companyPhone ?? "",
    companyEmail: s.companyEmail ?? "",
    invoiceTerms: s.invoiceTerms ?? "",
    /** fileUrl of the uploaded logo, "" when none. */
    companyLogo: s.companyLogo ?? "",
  };
});

export type Settings = Awaited<ReturnType<typeof getSettings>>;
