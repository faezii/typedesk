"use client";

import type { InvoiceStatus, QuotationStatus } from "@prisma/client";
import { useT } from "@/components/i18n";
import { ToneBadge, type Tone } from "@/components/shared/tone-badge";
import { INVOICE_STATUS_LABEL } from "@/lib/labels";

const INVOICE_TONE: Record<InvoiceStatus, Tone> = { UNPAID: "red", PARTIAL: "amber", PAID: "green", CANCELLED: "gray" };
const QUOTE: Record<QuotationStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draft", tone: "gray" },
  SENT: { label: "Sent", tone: "blue" },
  ACCEPTED: { label: "Accepted", tone: "green" },
  REJECTED: { label: "Rejected", tone: "red" },
  CONVERTED: { label: "Invoiced", tone: "violet" },
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const t = useT();
  return <ToneBadge tone={INVOICE_TONE[status]}>{t(INVOICE_STATUS_LABEL[status])}</ToneBadge>;
}

export function QuoteStatusBadge({ status }: { status: QuotationStatus }) {
  const t = useT();
  return <ToneBadge tone={QUOTE[status].tone}>{t(QUOTE[status].label)}</ToneBadge>;
}
