import "server-only";
import type { DocumentCategory, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DOCUMENT_CATEGORY_LABEL } from "@/lib/labels";

export const DOC_PAGE_SIZE = 25;

export type DocumentListParams = { q?: string; category?: string; customerId?: string; page?: string };

export async function listDocuments(params: DocumentListParams) {
  const page = Math.max(1, Number(params.page) || 1);
  const category = params.category && params.category in DOCUMENT_CATEGORY_LABEL ? (params.category as DocumentCategory) : undefined;
  const q = params.q?.trim();
  const where: Prisma.DocumentWhereInput = {
    deletedAt: null,
    ...(category ? { category } : {}),
    ...(params.customerId ? { customerId: params.customerId } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { customer: { name: { contains: q, mode: "insensitive" } } },
            { workOrder: { orderNo: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.document.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * DOC_PAGE_SIZE,
      take: DOC_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        fileUrl: true,
        mimeType: true,
        size: true,
        category: true,
        expiryDate: true,
        createdAt: true,
        customer: { select: { id: true, name: true } },
        workOrder: { select: { id: true, orderNo: true } },
        uploadedBy: { select: { name: true } },
      },
    }),
    prisma.document.count({ where }),
  ]);
  return { rows, total, page };
}

export type DocumentRow = Awaited<ReturnType<typeof listDocuments>>["rows"][number];

/** Recent orders for the upload dialog's work-order picker. */
export async function customerWorkOrderOptions(customerId: string) {
  return prisma.workOrder.findMany({
    where: { customerId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, orderNo: true, service: { select: { title: true } } },
  });
}
