import { renderToBuffer } from "@react-pdf/renderer";
import { InvoicePdf, type PdfDoc } from "@/components/finance/invoice-pdf";
import { can } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { getInvoice, getQuotation } from "@/server/queries/invoices";

/** GET /api/finance/invoice/<id>/pdf (or /quotation/…); add ?download for an attachment. */
export async function GET(req: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "finance:view")) return new Response("Not found", { status: 404 });
  const { kind, id } = await params;

  let doc: PdfDoc | null = null;
  if (kind === "invoice") {
    const inv = await getInvoice(id);
    if (inv) doc = { ...inv, kind, number: inv.invoiceNo };
  } else if (kind === "quotation") {
    const q = await getQuotation(id);
    if (q) doc = { ...q, kind, number: q.quoteNo, dueDate: q.validUntil };
  }
  if (!doc) return new Response("Not found", { status: 404 });

  const pdf = await renderToBuffer(<InvoicePdf doc={doc} company={await getSettings()} />);
  const download = new URL(req.url).searchParams.has("download");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${doc.number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
