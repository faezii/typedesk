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
    // Guard against a mistyped setting: fall back to the UAE standard rate.
    vatRate: new Prisma.Decimal(Number.isFinite(vat) && vat >= 0 && vat < 1 ? s.vatRate! : "0.05"),
    companyName: s.companyName ?? "TypeDesk",
    companyTrn: s.companyTrn ?? "",
    companyAddress: s.companyAddress ?? "",
    companyPhone: s.companyPhone ?? "",
    companyEmail: s.companyEmail ?? "",
    invoiceTerms: s.invoiceTerms ?? "",
  };
});

export type Settings = Awaited<ReturnType<typeof getSettings>>;
