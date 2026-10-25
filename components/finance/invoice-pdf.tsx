// PdfImage: react-pdf's <Image> draws into the PDF and takes no alt (not an HTML <img>)
import { Document, Image as PdfImage, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Prisma } from "@prisma/client";
import { formatLocal } from "@/lib/dates";
import { amountInWords } from "@/lib/invoice-math";
import { PDF_FONT, arabicLine } from "@/lib/pdf-fonts";
import type { Settings } from "@/lib/settings";

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
  customer: { name: string; companyName: string | null; phone: string; email: string | null; taxNo: string | null };
  items: { description: string; quantity: Money; unitPrice: Money; lineTotal: Money }[];
};

const amount = (v: Money) => v.toNumber().toLocaleString("en-QA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const GREEN = "#047857";

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: PDF_FONT, color: "#1f2937", lineHeight: 1.4 },
  row: { flexDirection: "row" },
  header: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 2, borderBottomColor: GREEN, paddingBottom: 12, marginBottom: 16 },
  logo: { height: 44, maxWidth: 160, objectFit: "contain", objectPosition: "left", marginBottom: 8 },
  company: { fontSize: 14, fontWeight: 700, color: GREEN, marginBottom: 3 },
  muted: { color: "#6b7280" },
  title: { fontSize: 16, fontWeight: 700, textAlign: "right", marginBottom: 6, letterSpacing: 1 },
  metaRow: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  metaLabel: { color: "#6b7280", width: 70, textAlign: "right" },
  metaValue: { width: 95, textAlign: "right", fontWeight: 700 },
  sectionLabel: { fontSize: 8, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 },
  billTo: { marginBottom: 16 },
  bold: { fontWeight: 700 },
  th: { flexDirection: "row", backgroundColor: "#ecfdf5", borderBottomWidth: 1, borderBottomColor: GREEN, paddingVertical: 5, fontWeight: 700 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb", paddingVertical: 5 },
  cNo: { width: 22, paddingLeft: 4 },
  cDesc: { flex: 1, paddingRight: 6 },
  cQty: { width: 50, textAlign: "right" },
  cRate: { width: 75, textAlign: "right" },
  cAmt: { width: 85, textAlign: "right", paddingRight: 4 },
  totals: { marginTop: 10, marginLeft: "auto", width: 230 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  grand: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, marginTop: 3, borderTopWidth: 1, borderTopColor: GREEN, fontWeight: 700, fontSize: 11 },
  words: { marginTop: 10, padding: 8, backgroundColor: "#f9fafb", borderRadius: 3 },
  terms: { marginTop: 16 },
  footer: { position: "absolute", bottom: 24, left: 36, right: 36, textAlign: "center", fontSize: 7.5, color: "#9ca3af" },
});

export function InvoicePdf({ doc, company, logo }: { doc: PdfDoc; company: Settings; logo?: Buffer | null }) {
  const isInvoice = doc.kind === "invoice";
  const hasVat = !doc.vatRate.isZero(); // Qatar has no VAT today: plain "Invoice", no VAT line
  const title = isInvoice ? (hasVat ? "Tax Invoice" : "Invoice") : "Quotation";
  const vatPct = doc.vatRate.times(100).toDecimalPlaces(2).toString();
  const balance = isInvoice && doc.amountPaid ? doc.totalAmount.minus(doc.amountPaid) : null;

  return (
    <Document title={`${title} ${doc.number}`} author={company.companyName}>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={{ maxWidth: 280 }}>
            {logo ? <PdfImage src={{ data: logo, format: company.companyLogo.endsWith(".png") ? "png" : "jpg" }} style={s.logo} /> : null}
            <Text style={[s.company, arabicLine(company.companyName)]}>{company.companyName}</Text>
            {company.companyAddress ? <Text style={[s.muted, arabicLine(company.companyAddress)]}>{company.companyAddress}</Text> : null}
            <Text style={s.muted}>{[company.companyPhone, company.companyEmail].filter(Boolean).join("  ·  ")}</Text>
            {company.companyTaxNo ? <Text style={s.bold}>CR / Tax no.: {company.companyTaxNo}</Text> : null}
          </View>
          <View>
            <Text style={s.title}>{title.toUpperCase()}</Text>
            <Meta label={isInvoice ? "Invoice no." : "Quote no."} value={doc.number} />
            <Meta label="Date" value={formatLocal(doc.issueDate, "d MMM yyyy")} />
            {doc.dueDate ? <Meta label={isInvoice ? "Due date" : "Valid until"} value={formatLocal(doc.dueDate, "d MMM yyyy")} /> : null}
            {doc.status === "CANCELLED" ? <Meta label="Status" value="CANCELLED" /> : null}
          </View>
        </View>

        <View style={s.billTo}>
          <Text style={s.sectionLabel}>{isInvoice ? "Bill to" : "Prepared for"}</Text>
          <Text style={[s.bold, arabicLine(doc.customer.companyName ?? doc.customer.name)]}>{doc.customer.companyName ?? doc.customer.name}</Text>
          {doc.customer.companyName ? <Text style={arabicLine(doc.customer.name)}>Attn: {doc.customer.name}</Text> : null}
          <Text style={s.muted}>{[doc.customer.phone, doc.customer.email].filter(Boolean).join("  ·  ")}</Text>
          {doc.customer.taxNo ? <Text>CR / Tax no.: {doc.customer.taxNo}</Text> : null}
        </View>

        <View style={s.th}>
          <Text style={s.cNo}>#</Text>
          <Text style={s.cDesc}>Description</Text>
          <Text style={s.cQty}>Qty</Text>
          <Text style={s.cRate}>Unit price</Text>
          <Text style={s.cAmt}>Amount (QAR)</Text>
        </View>
        {doc.items.map((it, i) => (
          <View key={i} style={s.tr} wrap={false}>
            <Text style={s.cNo}>{i + 1}</Text>
            <Text style={[s.cDesc, arabicLine(it.description)]}>{it.description}</Text>
            <Text style={s.cQty}>{it.quantity.toString()}</Text>
            <Text style={s.cRate}>{amount(it.unitPrice)}</Text>
            <Text style={s.cAmt}>{amount(it.lineTotal)}</Text>
          </View>
        ))}

        <View style={s.totals} wrap={false}>
          {hasVat ? (
            <>
              <Row label="Subtotal (excl. VAT)" value={amount(doc.subtotal)} />
              <Row label={`VAT @ ${vatPct}%`} value={amount(doc.vatAmount)} />
            </>
          ) : null}
          <View style={s.grand}>
            <Text>Total (QAR)</Text>
            <Text>{amount(doc.totalAmount)}</Text>
          </View>
          {balance && doc.amountPaid!.gt(0) ? (
            <>
              <Row label="Paid" value={amount(doc.amountPaid!)} />
              <Row label="Balance due" value={amount(balance)} bold />
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
                <Text style={{ marginBottom: 8, ...arabicLine(doc.notes) }}>{doc.notes}</Text>
              </>
            ) : null}
            {company.invoiceTerms ? (
              <>
                <Text style={s.sectionLabel}>{isInvoice ? "Payment terms" : "Terms"}</Text>
                <Text style={arabicLine(company.invoiceTerms)}>{company.invoiceTerms}</Text>
              </>
            ) : null}
          </View>
        ) : null}

        <Text style={s.footer} fixed render={({ pageNumber, totalPages }) => `${isInvoice ? `This is a computer-generated ${title.toLowerCase()}.` : "This quotation is not an invoice."}  ·  Page ${pageNumber} of ${totalPages}`} />
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
