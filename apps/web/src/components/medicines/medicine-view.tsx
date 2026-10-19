"use client";

import { ArrowLeft, Building2, PackageX, Pill } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { Pager } from "@/components/common/pager";
import { ReportedNotice } from "@/components/common/status";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { LazyPharmacyMap, type MapMarker } from "@/components/map/lazy-map";
import { type ChosenLocation, LocationPicker } from "@/components/map/location-picker";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useApi } from "@/hooks/use-api";
import { placeLabel } from "@/lib/format";
import { DOSAGE_FORM_LABELS, STATUS_LABELS } from "@/lib/labels";
import type { AvailabilityResponse, AvailabilityStatus, MedicineDetail } from "@/lib/types";
import { AvailabilityCard } from "./availability-card";
import { CreateAlertDialog } from "./create-alert-dialog";

const STATUSES: AvailabilityStatus[] = ["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK", "UNKNOWN"];

export function MedicineView({ id }: { id: string }) {
  const medicine = useApi<MedicineDetail>(`/medicines/${id}`);
  const [location, setLocation] = useState<ChosenLocation | null>(null);
  const [statuses, setStatuses] = useState<AvailabilityStatus[]>(["IN_STOCK", "LOW_STOCK"]);
  const [radius, setRadius] = useState<string>("none");
  const [hideStale, setHideStale] = useState(false);
  const [sort, setSort] = useState<"status" | "distance" | "updated">("status");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  const availability = useApi<AvailabilityResponse>(`/medicines/${id}/availability`, {
    lat: location?.lat,
    lng: location?.lng,
    radiusKm: location && radius !== "none" ? Number(radius) : undefined,
    status: statuses.length === STATUSES.length ? undefined : statuses,
    hideStale: hideStale || undefined,
    sort: sort === "distance" && !location ? "status" : sort,
    page,
    pageSize: 10,
  });

  const markers = useMemo<MapMarker[]>(
    () =>
      (availability.data?.items ?? []).map((r) => ({
        id: r.pharmacy.id,
        lat: r.pharmacy.latitude,
        lng: r.pharmacy.longitude,
        title: r.pharmacy.name,
        subtitle: placeLabel(r.pharmacy),
        status: r.availabilityStatus,
        href: `/pharmacies/${r.pharmacy.slug}`,
        phone: r.pharmacy.phone,
      })),
    [availability.data],
  );

  function update<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  if (medicine.error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <ErrorState error={medicine.error} onRetry={medicine.reload} />
      </div>
    );
  }

  const m = medicine.data;
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Kthehu te kërkimi
      </Link>

      {!m ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : (
        <Card className="p-0">
          <CardContent className="flex flex-col gap-6 p-6 md:flex-row md:items-start md:justify-between">
            <div className="flex gap-4">
              <div className="hidden size-14 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground sm:flex">
                <Pill className="size-7" aria-hidden />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-semibold md:text-3xl">{m.name}</h1>
                <div className="flex flex-wrap gap-2">
                  {m.strength ? <Badge variant="secondary" className="text-sm">{m.strength}</Badge> : null}
                  {m.dosageForm ? <Badge variant="secondary" className="text-sm">{DOSAGE_FORM_LABELS[m.dosageForm]}</Badge> : null}
                  {m.packageSize ? <Badge variant="outline" className="text-sm">{m.packageSize}</Badge> : null}
                </div>
                <dl className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="inline text-muted-foreground">Përbërësi aktiv: </dt>
                    <dd className="inline">{m.activeIngredient ?? "I panjohur"}</dd>
                  </div>
                  <div>
                    <dt className="inline text-muted-foreground">Prodhuesi: </dt>
                    <dd className="inline">{m.manufacturer ?? "I pa specifikuar"}</dd>
                  </div>
                  {m.catalogCode ? (
                    <div>
                      <dt className="inline text-muted-foreground">Kodi: </dt>
                      <dd className="inline font-mono text-xs">{m.catalogCode}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            </div>
            <CreateAlertDialog medicine={m} location={location} />
          </CardContent>
          {m.variants.length > 0 ? (
            <div className="border-t px-6 py-4">
              <p className="mb-2 text-sm text-muted-foreground">Doza dhe forma të tjera (produkte të ndryshme):</p>
              <div className="flex flex-wrap gap-2">
                {m.variants.map((v) => (
                  <Link
                    key={v.id}
                    href={`/medicines/${v.id}`}
                    className="rounded-full border px-3 py-1 text-sm hover:border-primary/40 hover:bg-accent hover:text-accent-foreground"
                  >
                    {v.name} {v.strength} {v.dosageForm ? `· ${DOSAGE_FORM_LABELS[v.dosageForm].toLowerCase()}` : ""}
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </Card>
      )}

      <section aria-labelledby="availability-heading" className="space-y-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 id="availability-heading" className="text-xl font-semibold">
              Disponueshmëria e raportuar
            </h2>
            {availability.data ? (
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {availability.data.summary.inStock + availability.data.summary.lowStock} farmaci e raportojnë në dispozicion
                {availability.data.summary.stale > 0 ? ` · ${availability.data.summary.stale} me raport të vjetruar` : ""}
              </p>
            ) : null}
          </div>
        </div>
        <ReportedNotice />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
          <div className="space-y-4">
            <Card className="gap-4 p-4">
              <LocationPicker value={location} onChange={update(setLocation)} />
              <div className="flex flex-wrap items-end gap-x-6 gap-y-3 border-t pt-4">
                <fieldset className="space-y-1.5">
                  <legend className="text-xs font-medium text-muted-foreground">Statusi</legend>
                  <div className="flex flex-wrap gap-3">
                    {STATUSES.map((s) => (
                      <div key={s} className="flex items-center gap-1.5">
                        <Checkbox
                          id={`st-${s}`}
                          checked={statuses.includes(s)}
                          onCheckedChange={(c) => {
                            const next = c ? [...statuses, s] : statuses.filter((x) => x !== s);
                            if (next.length > 0) update(setStatuses)(next); // at least one status stays selected
                          }}
                        />
                        <Label htmlFor={`st-${s}`} className="text-sm font-normal">
                          {STATUS_LABELS[s]}
                        </Label>
                      </div>
                    ))}
                  </div>
                </fieldset>
                <div className="space-y-1">
                  <Label htmlFor="radius" className="text-xs text-muted-foreground">Distanca</Label>
                  <Select value={radius} onValueChange={update(setRadius)} disabled={!location}>
                    <SelectTrigger id="radius" className="h-9 w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Pa kufi</SelectItem>
                      {["2", "5", "10", "25", "50"].map((r) => (
                        <SelectItem key={r} value={r}>
                          Brenda {r} km
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="sort" className="text-xs text-muted-foreground">Rendit</Label>
                  <Select value={sort} onValueChange={(v) => update(setSort)(v as typeof sort)}>
                    <SelectTrigger id="sort" className="h-9 w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="status">Disponueshmëria</SelectItem>
                      <SelectItem value="distance" disabled={!location}>
                        Më afër {location ? "" : "(zgjidhni vendndodhjen)"}
                      </SelectItem>
                      <SelectItem value="updated">Përditësimi më i ri</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex h-9 items-center gap-2">
                  <Switch id="hide-stale" checked={hideStale} onCheckedChange={update(setHideStale)} />
                  <Label htmlFor="hide-stale" className="text-sm font-normal">Fshih raportet e vjetruara</Label>
                </div>
              </div>
            </Card>

            {availability.error ? (
              <ErrorState error={availability.error} onRetry={availability.reload} />
            ) : availability.loading && !availability.data ? (
              <ListSkeleton rows={3} />
            ) : availability.data && availability.data.items.length === 0 ? (
              <EmptyState
                icon={statuses.every((s) => s === "IN_STOCK" || s === "LOW_STOCK") ? PackageX : Building2}
                title="Asnjë farmaci nuk përputhet me filtrat"
                description="Asnjë farmaci e verifikuar nuk e raporton këtë bar me këto kritere. Provoni të zgjeroni distancën, të përfshini statuset e tjera ose krijoni një alarm."
              />
            ) : availability.data ? (
              <>
                <ul className="space-y-3" aria-busy={availability.loading}>
                  {availability.data.items.map((row) => (
                    <li key={row.inventoryId}>
                      <AvailabilityCard
                        row={row}
                        selected={selected === row.pharmacy.id}
                        onShowOnMap={() => {
                          setSelected(row.pharmacy.id);
                          mapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                        }}
                      />
                    </li>
                  ))}
                </ul>
                <Pager meta={availability.data.meta} onPage={setPage} />
              </>
            ) : null}
          </div>

          <div ref={mapRef} className="lg:sticky lg:top-20 lg:self-start">
            <LazyPharmacyMap
              markers={markers}
              selectedId={selected}
              userLocation={location}
              onSelect={setSelected}
              onPickLocation={(lat, lng) => update(setLocation)({ lat, lng, label: "Pika në hartë" })}
              className="h-80 w-full rounded-xl border lg:h-[560px]"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Ngjyra e shenjës tregon statusin e raportuar. Klikoni në hartë për të vendosur pikën tuaj.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
