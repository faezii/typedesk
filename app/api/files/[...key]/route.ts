import { can } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { fileUrlFor, mimeForKey, readKey } from "@/lib/storage";

/** Serves uploaded files to signed-in users, only for documents that still exist. */
export async function GET(req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "documents:view")) return new Response("Not found", { status: 404 });

  const key = (await params).key.join("/");
  const doc = await prisma.document.findFirst({ where: { fileUrl: fileUrlFor(key), deletedAt: null }, select: { name: true } });
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
