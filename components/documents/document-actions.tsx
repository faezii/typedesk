"use client";


import { useT } from "@/components/i18n";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Eye, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { deleteDocument } from "@/server/actions/documents";

type Doc = { id: string; name: string; fileUrl: string; mimeType: string };

export function DocumentActions({ doc, canDelete }: { doc: Doc; canDelete: boolean }) {
  const t = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const previewable = doc.mimeType.startsWith("image/") || doc.mimeType === "application/pdf";

  return (
    <div className="flex justify-end gap-1">
      {previewable && (
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t("Preview {name}", { name: doc.name })}>
              <Eye />
            </Button>
          </DialogTrigger>
          <DialogContent className="flex h-[85vh] flex-col sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle className="truncate pe-8">{doc.name}</DialogTitle>
              <DialogDescription className="sr-only">{t("Document preview")}</DialogDescription>
            </DialogHeader>
            <div className="bg-muted min-h-0 flex-1 overflow-auto rounded-lg">
              {doc.mimeType === "application/pdf" ? (
                <iframe src={doc.fileUrl} title={doc.name} className="size-full rounded-lg" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element -- private, auth-gated file; next/image can't optimise it
                <img src={doc.fileUrl} alt={doc.name} className="mx-auto max-h-full object-contain" />
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
      <Button variant="ghost" size="icon-sm" asChild>
        <a href={`${doc.fileUrl}?download`} aria-label={t("Download {name}", { name: doc.name })}>
          <Download />
        </a>
      </Button>
      {canDelete && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("Delete {name}", { name: doc.name })}
          disabled={pending}
          onClick={() => {
            if (!confirm(t("Delete \"{name}\"? It will no longer be available to download.", { name: doc.name }))) return;
            startTransition(async () => {
              const res = await deleteDocument(doc.id);
              if (!res.ok) return void toast.error(t(res.error));
              toast.success(t("Document deleted"));
              router.refresh();
            });
          }}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 />
        </Button>
      )}
    </div>
  );
}
