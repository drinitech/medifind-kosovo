import { ArrowRight } from "lucide-react";
import { StatusBadge } from "@/components/common/status";
import { Badge } from "@/components/ui/badge";
import { dateTime, timeAgo } from "@/lib/format";
import { SOURCE_LABELS } from "@/lib/labels";
import type { HistoryEntry } from "@/lib/types";

export function HistoryList({ items, showPharmacy = false }: { items: HistoryEntry[]; showPharmacy?: boolean }) {
  return (
    <ul className="divide-y">
      {items.map((h) => (
        <li key={h.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-0.5">
            <p className="font-medium">
              {h.inventory.medicine.name} {h.inventory.medicine.strength}
              {showPharmacy && h.pharmacy ? <span className="font-normal text-muted-foreground"> · {h.pharmacy.name}</span> : null}
            </p>
            <p className="text-xs text-muted-foreground">
              <time dateTime={h.createdAt} title={dateTime(h.createdAt)}>{timeAgo(h.createdAt)}</time>
              {" · "}
              {h.changedBy ? h.changedBy.fullName : "Sistemi"}
              {" · "}
              {SOURCE_LABELS[h.source]}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {h.previousStatus ? <StatusBadge status={h.previousStatus} /> : <Badge variant="outline">E re</Badge>}
            {h.previousQuantity !== h.newQuantity && h.previousStatus ? (
              <span className="text-xs text-muted-foreground tabular-nums">{h.previousQuantity ?? "—"}</span>
            ) : null}
            <ArrowRight className="size-4 text-muted-foreground" aria-label="në" />
            <StatusBadge status={h.newStatus} />
            <span className="text-xs text-muted-foreground tabular-nums">{h.newQuantity ?? "—"} copë</span>
            {!h.newIsActive ? <Badge variant="outline">Çaktivizuar</Badge> : h.previousIsActive === false ? <Badge variant="outline">Riaktivizuar</Badge> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
