"use client";

import { Clock, MapPin, Navigation, Phone, PhoneOff } from "lucide-react";
import Link from "next/link";
import { DemoBadge, FreshnessBadge, StatusBadge } from "@/components/common/status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { dateTime, directionsHref, km, telHref, timeAgo, placeLabel } from "@/lib/format";
import { SOURCE_LABELS } from "@/lib/labels";
import type { AvailabilityRow } from "@/lib/types";
import { cn } from "@/lib/utils";

export function AvailabilityCard({
  row,
  selected,
  onShowOnMap,
}: {
  row: AvailabilityRow;
  selected?: boolean;
  onShowOnMap: () => void;
}) {
  const p = row.pharmacy;
  return (
    <Card className={cn("gap-3 p-4 transition-shadow sm:p-5", selected && "ring-2 ring-primary/40", row.freshness === "STALE" && "bg-muted/40")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/pharmacies/${p.slug}`} className="text-base font-semibold hover:text-primary hover:underline">
              {p.name}
            </Link>
            {p.isDemo ? <DemoBadge /> : null}
          </div>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" aria-hidden />
            {placeLabel(p)}
            {row.distanceKm !== null ? <span className="font-medium text-foreground">· {km(row.distanceKm)}</span> : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={row.availabilityStatus} />
          <FreshnessBadge freshness={row.freshness} />
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">Sasia e raportuar</dt>
          <dd>{row.quantity !== null ? `${row.quantity} copë` : <span className="text-muted-foreground">Nuk publikohet</span>}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Përditësuar</dt>
          <dd className="flex items-center gap-1">
            <Clock className="size-3.5 text-muted-foreground" aria-hidden />
            <time dateTime={row.lastReportedAt} title={dateTime(row.lastReportedAt)}>
              {timeAgo(row.lastReportedAt)}
            </time>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Burimi</dt>
          <dd>{SOURCE_LABELS[row.source]}</dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2 border-t pt-3">
        {p.phone ? (
          <Button size="sm" className="h-8" asChild>
            <a href={telHref(p.phone)}>
              <Phone aria-hidden /> Telefono për konfirmim
            </a>
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>
                <Button size="sm" className="h-8" disabled>
                  <PhoneOff aria-hidden /> Pa numër publik
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Farmacia nuk ka publikuar numër telefoni. Shihni profilin ose vizitoni adresën.</TooltipContent>
          </Tooltip>
        )}
        <Button size="sm" variant="outline" className="h-8" onClick={onShowOnMap}>
          <MapPin aria-hidden /> Shiko në hartë
        </Button>
        <Button size="sm" variant="ghost" className="h-8" asChild>
          <a href={directionsHref(p.latitude, p.longitude)} target="_blank" rel="noreferrer">
            <Navigation aria-hidden /> Udhëzime
          </a>
        </Button>
      </div>
    </Card>
  );
}
