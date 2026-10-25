import type { InvoiceStatus, QuotationStatus } from "@prisma/client";
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

export const InvoiceStatusBadge = ({ status }: { status: InvoiceStatus }) => <ToneBadge tone={INVOICE_TONE[status]}>{INVOICE_STATUS_LABEL[status]}</ToneBadge>;
export const QuoteStatusBadge = ({ status }: { status: QuotationStatus }) => <ToneBadge tone={QUOTE[status].tone}>{QUOTE[status].label}</ToneBadge>;
