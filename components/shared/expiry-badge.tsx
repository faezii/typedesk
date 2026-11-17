import { getT } from "@/lib/i18n/server";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { formatDate } from "@/lib/format";
import { expiryStatus } from "@/lib/expiry";
import { ToneBadge } from "./tone-badge";

const META = {
  valid: { tone: "green", label: "Valid", Icon: CheckCircle2 },
  expiring: { tone: "amber", label: "Expiring", Icon: Clock },
  expired: { tone: "red", label: "Expired", Icon: AlertTriangle },
} as const;

/** Valid / Expiring (≤ 30 days) / Expired, with the date as a tooltip-free subtitle when asked. */
export async function ExpiryBadge({ date, showDate = false }: { date: Date | null; showDate?: boolean }) {
  const t = await getT();
  if (!date) return <span className="text-muted-foreground text-xs">—</span>;
  const { tone, label, Icon } = META[expiryStatus(date)];
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <ToneBadge tone={tone}>
        <Icon className="size-3" aria-hidden /> {t(label)}
      </ToneBadge>
      {showDate && <span className="text-muted-foreground text-[11px] tabular-nums">{formatDate(date, t.lang)}</span>}
    </span>
  );
}
