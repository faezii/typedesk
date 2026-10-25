import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Centred icon, message and actions for access-denied, not-found and error screens. */
export function StatusPage({
  icon: Icon,
  title,
  children,
  actions,
  destructive = false,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  actions: React.ReactNode;
  destructive?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center", className)}>
      <div className={cn("grid size-12 place-items-center rounded-full", destructive ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>
        <Icon className="size-6" />
      </div>
      <div>
        <h1 className="text-xl font-semibold">{title}</h1>
        <div className="text-muted-foreground mt-1 max-w-sm text-sm">{children}</div>
      </div>
      <div className="flex gap-2">{actions}</div>
    </div>
  );
}
