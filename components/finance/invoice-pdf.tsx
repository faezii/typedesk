import { Document, Font, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Prisma } from "@prisma/client";
import { formatDubai } from "@/lib/dates";
import { amountInWords } from "@/lib/invoice-math";
import type { Settings } from "@/lib/settings";

// shortcut: built-in Helvetica has no Arabic glyphs — register a Noto Sans Arabic font here if names/addresses need Arabic script.

// Wrap whole words only — no "Cen-ter" splits in names and descriptions.
Font.registerHyphenationCallback((word) => [word]);

type Money = Prisma.Decimal;
export type PdfDoc = {
  kind: "invoice" | "quotation";
  number: string;
  issueDate: Date;
  dueDate: Date | null;
  notes: string | null;
  vatRate: Money;
  subtotal: Money;
  vatAmount: Money;
  totalAmount: Money;
  amountPaid?: Money;
  status: string;
  customer: { name: string; companyName: string | null; phone: string; email: string | null; trn: string | null };
  items: { description: string; quantity: Money; unitPrice: Money; lineTotal: Money }[];
};

const aed = (v: Money) => v.toNumber().toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const GREEN = "#047857";

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica", color: "#1f2937", lineHeight: 1.4 },
  row: { flexDirection: "row" },
  header: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 2, borderBottomColor: GREEN, paddingBottom: 12, marginBottom: 16 },
  company: { fontSize: 14, fontFamily: "Helvetica-Bold", color: GREEN, marginBottom: 3 },
  muted: { color: "#6b7280" },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", textAlign: "right", marginBottom: 6, letterSpacing: 1 },
  metaRow: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  metaLabel: { color: "#6b7280", width: 70, textAlign: "right" },
  metaValue: { width: 95, textAlign: "right", fontFamily: "Helvetica-Bold" },
  sectionLabel: { fontSize: 8, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 },
  billTo: { marginBottom: 16 },
  bold: { fontFamily: "Helvetica-Bold" },
  th: { flexDirection: "row", backgroundColor: "#ecfdf5", borderBottomWidth: 1, borderBottomColor: GREEN, paddingVertical: 5, fontFamily: "Helvetica-Bold" },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb", paddingVertical: 5 },
  cNo: { width: 22, paddingLeft: 4 },
  cDesc: { flex: 1, paddingRight: 6 },
  cQty: { width: 50, textAlign: "right" },
  cRate: { width: 75, textAlign: "right" },
  cAmt: { width: 85, textAlign: "right", paddingRight: 4 },
  totals: { marginTop: 10, marginLeft: "auto", width: 230 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  grand: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, marginTop: 3, borderTopWidth: 1, borderTopColor: GREEN, fontFamily: "Helvetica-Bold", fontSize: 11 },
  words: { marginTop: 10, padding: 8, backgroundColor: "#f9fafb", borderRadius: 3 },
  terms: { marginTop: 16 },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, textAlign: "center", fontSize: 7.5, color: "#9ca3af" },
});

export function InvoicePdf({ doc, company }: { doc: PdfDoc; company: Settings }) {
  const isInvoice = doc.kind === "invoice";
  const vatPct = doc.vatRate.times(100).toDecimalPlaces(2).toString();
  const balance = isInvoice && doc.amountPaid ? doc.totalAmount.minus(doc.amountPaid) : null;

  return (
    <Document title={`${isInvoice ? "Tax Invoice" : "Quotation"} ${doc.number}`} author={company.companyName}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={{ maxWidth: 280 }}>
            <Text style={s.company}>{company.companyName}</Text>
            {company.companyAddress ? <Text style={s.muted}>{company.companyAddress}</Text> : null}
            <Text style={s.muted}>{[company.companyPhone, company.companyEmail].filter(Boolean).join("  ·  ")}</Text>
            {company.companyTrn ? <Text style={s.bold}>TRN: {company.companyTrn}</Text> : null}
          </View>
          <View>
            <Text style={s.title}>{isInvoice ? "TAX INVOICE" : "QUOTATION"}</Text>
            <Meta label={isInvoice ? "Invoice no." : "Quote no."} value={doc.number} />
            <Meta label="Date" value={formatDubai(doc.issueDate, "d MMM yyyy")} />
            {doc.dueDate ? <Meta label={isInvoice ? "Due date" : "Valid until"} value={formatDubai(doc.dueDate, "d MMM yyyy")} /> : null}
            {doc.status === "CANCELLED" ? <Meta label="Status" value="CANCELLED" /> : null}
          </View>
        </View>

        <View style={s.billTo}>
          <Text style={s.sectionLabel}>{isInvoice ? "Bill to" : "Prepared for"}</Text>
          <Text style={s.bold}>{doc.customer.companyName ?? doc.customer.name}</Text>
          {doc.customer.companyName ? <Text>Attn: {doc.customer.name}</Text> : null}
          <Text style={s.muted}>{[doc.customer.phone, doc.customer.email].filter(Boolean).join("  ·  ")}</Text>
          {doc.customer.trn ? <Text>Customer TRN: {doc.customer.trn}</Text> : null}
        </View>

        <View style={s.th}>
          <Text style={s.cNo}>#</Text>
          <Text style={s.cDesc}>Description</Text>
          <Text style={s.cQty}>Qty</Text>
          <Text style={s.cRate}>Unit price</Text>
          <Text style={s.cAmt}>Amount (AED)</Text>
        </View>
        {doc.items.map((it, i) => (
          <View key={i} style={s.tr} wrap={false}>
            <Text style={s.cNo}>{i + 1}</Text>
            <Text style={s.cDesc}>{it.description}</Text>
            <Text style={s.cQty}>{it.quantity.toString()}</Text>
            <Text style={s.cRate}>{aed(it.unitPrice)}</Text>
            <Text style={s.cAmt}>{aed(it.lineTotal)}</Text>
          </View>
        ))}

        <View style={s.totals} wrap={false}>
          <Row label="Subtotal (excl. VAT)" value={aed(doc.subtotal)} />
          <Row label={`VAT @ ${vatPct}%`} value={aed(doc.vatAmount)} />
          <View style={s.grand}>
            <Text>Total (AED)</Text>
            <Text>{aed(doc.totalAmount)}</Text>
          </View>
          {balance && doc.amountPaid!.gt(0) ? (
            <>
              <Row label="Paid" value={aed(doc.amountPaid!)} />
              <Row label="Balance due" value={aed(balance)} bold />
            </>
          ) : null}
        </View>

        <View style={s.words} wrap={false}>
          <Text style={s.sectionLabel}>Amount in words</Text>
          <Text style={s.bold}>{amountInWords(doc.totalAmount)}</Text>
        </View>

        {doc.notes || company.invoiceTerms ? (
          <View style={s.terms} wrap={false}>
            {doc.notes ? (
              <>
                <Text style={s.sectionLabel}>Notes</Text>
                <Text style={{ marginBottom: 8 }}>{doc.notes}</Text>
              </>
            ) : null}
            {company.invoiceTerms ? (
              <>
                <Text style={s.sectionLabel}>{isInvoice ? "Payment terms" : "Terms"}</Text>
                <Text>{company.invoiceTerms}</Text>
              </>
            ) : null}
          </View>
        ) : null}

        <Text style={s.footer} fixed render={({ pageNumber, totalPages }) => `${isInvoice ? "This is a computer-generated tax invoice." : "This quotation is not a tax invoice."}  ·  Page ${pageNumber} of ${totalPages}`} />
      </Page>
    </Document>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.metaRow}>
      <Text style={s.metaLabel}>{label}</Text>
      <Text style={s.metaValue}>{value}</Text>
    </View>
  );
}

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={s.totalRow}>
      <Text style={bold ? s.bold : undefined}>{label}</Text>
      <Text style={bold ? s.bold : undefined}>{value}</Text>
    </View>
  );
}
