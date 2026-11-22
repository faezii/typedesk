import { can } from "@/lib/auth/permissions";
import { centerBlocked, getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { fileUrlFor, mimeForKey, readKey } from "@/lib/storage";

/** Serves uploaded files to signed-in users: the company logo, live documents (documents:view) and expense receipts (finance:view). */
export async function GET(req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const user = await getCurrentUser();
  if (!user || centerBlocked(user.organization)) return new Response("Not found", { status: 404 });

  const key = (await params).key.join("/");
  const fileUrl = fileUrlFor(key);
  const doc =
    ((await getSettings()).companyLogo === fileUrl && { name: "logo" }) ||
    (can(user.role, "documents:view") && (await prisma.document.findFirst({ where: { fileUrl, deletedAt: null }, select: { name: true } }))) ||
    (can(user.role, "finance:view") &&
      (await prisma.expense.findFirst({ where: { receiptUrl: fileUrl }, select: { description: true } }).then((e) => (e ? { name: `Receipt - ${e.description}` } : null)))) ||
    null;
  const bytes = doc ? await readKey(key).catch(() => null) : null;
  if (!doc || !bytes) return new Response("Not found", { status: 404 });

  const ext = key.split(".").pop();
  const filename = `${doc.name.replace(/[^\w .()-]/g, "_").slice(0, 100)}.${ext}`;
  const download = new URL(req.url).searchParams.has("download");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": mimeForKey(key),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
