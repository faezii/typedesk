import { Construction } from "lucide-react";
import { PageHeader } from "./page-header";

/** Placeholder for sections that are built in later phases. */
export function ComingSoon({ title, description, phase }: { title: string; description: string; phase: number }) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <div className="text-muted-foreground flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-10 text-center">
        <div className="bg-primary/10 text-primary grid size-11 place-items-center rounded-full">
          <Construction className="size-5" />
        </div>
        <div className="text-foreground font-medium">This section arrives in Phase {phase}</div>
        <p className="max-w-sm text-sm">The navigation, permissions and layout are in place; the screens are built next.</p>
      </div>
    </>
  );
}
