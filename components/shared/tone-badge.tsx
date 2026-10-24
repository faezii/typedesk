import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type Tone = "green" | "amber" | "red" | "blue" | "violet" | "gray";

const TONES: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-800 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20",
  red: "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-400/20",
  blue: "bg-sky-50 text-sky-800 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/20",
  violet: "bg-violet-50 text-violet-800 ring-violet-600/20 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-400/20",
  gray: "bg-muted text-muted-foreground ring-border",
};

/** Status pill: always pair tone with a text label (never colour alone). */
export function ToneBadge({ tone, className, children }: { tone: Tone; className?: string; children: React.ReactNode }) {
  return (
    <Badge variant="outline" className={cn("gap-1 border-0 font-medium ring-1 ring-inset", TONES[tone], className)}>
      {children}
    </Badge>
  );
}
