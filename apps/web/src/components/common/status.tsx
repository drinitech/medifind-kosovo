import { AlertTriangle, BadgeCheck, CheckCircle2, CircleHelp, Clock, Info, PackageX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FRESHNESS_HINTS, FRESHNESS_LABELS, REPORTED_NOTICE, STATUS_LABELS } from "@/lib/labels";
import type { AvailabilityStatus, Freshness } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<AvailabilityStatus, string> = {
  IN_STOCK: "bg-success-soft text-success border-success/25",
  LOW_STOCK: "bg-warning-soft text-[oklch(0.45_0.11_65)] border-warning/30",
  OUT_OF_STOCK: "bg-danger-soft text-destructive border-destructive/20",
  UNKNOWN: "bg-muted text-muted-foreground border-border",
};

const STATUS_ICONS = {
  IN_STOCK: CheckCircle2,
  LOW_STOCK: AlertTriangle,
  OUT_OF_STOCK: PackageX,
  UNKNOWN: CircleHelp,
} as const;

export function StatusBadge({ status, className }: { status: AvailabilityStatus; className?: string }) {
  const Icon = STATUS_ICONS[status];
  return (
    <Badge variant="outline" className={cn("gap-1 font-medium", STATUS_STYLES[status], className)}>
      <Icon className="size-3.5" aria-hidden />
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function FreshnessBadge({ freshness, className }: { freshness: Freshness; className?: string }) {
  if (freshness === "FRESH") return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          tabIndex={0}
          className={cn(
            "gap-1",
            freshness === "STALE"
              ? "border-destructive/30 bg-danger-soft text-destructive"
              : "border-warning/30 bg-warning-soft text-[oklch(0.45_0.11_65)]",
            className,
          )}
        >
          <Clock className="size-3.5" aria-hidden />
          {FRESHNESS_LABELS[freshness]}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{FRESHNESS_HINTS[freshness]}</TooltipContent>
    </Tooltip>
  );
}

export function DemoBadge({ className }: { className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" tabIndex={0} className={cn("border-dashed text-muted-foreground", className)}>
          Demo
        </Badge>
      </TooltipTrigger>
      <TooltipContent>Të dhëna fiktive demonstruese — nuk është farmaci reale.</TooltipContent>
    </Tooltip>
  );
}

export function ReportedNotice({ className }: { className?: string }) {
  return (
    <p className={cn("flex items-start gap-2 rounded-lg border border-primary/15 bg-accent px-3 py-2 text-sm text-accent-foreground", className)}>
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{REPORTED_NOTICE}</span>
    </p>
  );
}

/** Whether a directory pharmacy participates in MediFind (verified, reports inventory) or is only a listing. */
export function ParticipationBadge({ verified, className }: { verified: boolean | undefined; className?: string }) {
  if (verified) {
    return (
      <Badge variant="outline" className={cn("gap-1 border-success/30 bg-success-soft text-success", className)}>
        <BadgeCheck className="size-3.5" aria-hidden />
        Raporton inventar
      </Badge>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" tabIndex={0} className={cn("text-muted-foreground", className)}>
          Nuk raporton inventar
        </Badge>
      </TooltipTrigger>
      <TooltipContent>Farmaci nga OpenStreetMap. Nuk merr pjesë ende në MediFind, ndaj nuk ka të dhëna për barnat.</TooltipContent>
    </Tooltip>
  );
}
