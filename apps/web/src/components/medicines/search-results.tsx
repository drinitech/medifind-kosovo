"use client";

import { ArrowRight, Building2, Clock, PackageSearch } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/states";
import { Pager } from "@/components/common/pager";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useApi } from "@/hooks/use-api";
import { timeAgo } from "@/lib/format";
import { DOSAGE_FORM_LABELS } from "@/lib/labels";
import type { DosageForm, MedicineSearchResult, Paginated } from "@/lib/types";

const ALL = "__all";

export function SearchResults() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const q = params.get("q") ?? "";
  const dosageForm = params.get("form") ?? "";
  const strength = params.get("strength") ?? "";
  const availableOnly = params.get("available") === "1";
  const sort = params.get("sort") ?? "relevance";
  const page = Number(params.get("page") ?? 1) || 1;
  const active = Boolean(q || dosageForm || strength);

  const { data, error, loading, reload } = useApi<Paginated<MedicineSearchResult>>(active ? "/medicines" : null, {
    q,
    dosageForm,
    strength,
    availableOnly: availableOnly || undefined,
    sort,
    page,
    pageSize: 10,
  });

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  if (!active) return null;

  return (
    <section id="rezultatet" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-10" aria-labelledby="results-heading">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 id="results-heading" className="text-xl font-semibold">
            {q ? <>Rezultatet për “{q}”</> : "Rezultatet"}
          </h2>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {loading ? "Duke kërkuar…" : data ? `${data.meta.total} produkte` : null}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="filter-form" className="text-xs">Forma</Label>
            <Select value={dosageForm || ALL} onValueChange={(v) => setParam("form", v === ALL ? null : v)}>
              <SelectTrigger id="filter-form" className="h-9 w-40">
                <SelectValue placeholder="Të gjitha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Të gjitha format</SelectItem>
                {(Object.keys(DOSAGE_FORM_LABELS) as DosageForm[]).map((f) => (
                  <SelectItem key={f} value={f}>
                    {DOSAGE_FORM_LABELS[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="filter-strength" className="text-xs">Doza</Label>
            <Input
              id="filter-strength"
              key={strength}
              defaultValue={strength}
              placeholder="p.sh. 500 mg"
              className="h-9 w-32"
              onBlur={(e) => e.target.value !== strength && setParam("strength", e.target.value.trim() || null)}
              onKeyDown={(e) => e.key === "Enter" && setParam("strength", e.currentTarget.value.trim() || null)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="filter-sort" className="text-xs">Rendit</Label>
            <Select value={sort} onValueChange={(v) => setParam("sort", v === "relevance" ? null : v)}>
              <SelectTrigger id="filter-sort" className="h-9 w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="relevance">Më të përshtatshmit</SelectItem>
                <SelectItem value="availability">Më shumë farmaci</SelectItem>
                <SelectItem value="name">Emri (A–Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex h-9 items-center gap-2">
            <Switch id="filter-available" checked={availableOnly} onCheckedChange={(c) => setParam("available", c ? "1" : null)} />
            <Label htmlFor="filter-available" className="text-sm">Vetëm të disponueshmet</Label>
          </div>
        </div>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <ListSkeleton rows={4} />
      ) : data && data.items.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="Nuk u gjet asnjë bar"
          description="Provoni një emër tjetër, përbërësin aktiv (p.sh. “ibuprofen”) ose hiqni filtrat. Katalogu mund të mos jetë i plotë."
        />
      ) : data ? (
        <div className="space-y-3">
          <ul className="grid gap-3 md:grid-cols-2">
            {data.items.map((m) => (
              <li key={m.id}>
                <Card className="group h-full gap-0 p-0 transition-shadow hover:shadow-md">
                  <Link href={`/medicines/${m.id}`} className="flex h-full flex-col gap-3 rounded-xl p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold group-hover:text-primary">{m.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {m.activeIngredient && m.activeIngredient !== m.name ? `${m.activeIngredient} · ` : ""}
                          {m.packageSize ?? ""}
                        </p>
                      </div>
                      <ArrowRight className="mt-1 size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {m.strength ? <Badge variant="secondary">{m.strength}</Badge> : null}
                      {m.dosageForm ? <Badge variant="secondary">{DOSAGE_FORM_LABELS[m.dosageForm]}</Badge> : null}
                    </div>
                    <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-3 text-sm">
                      <span className={m.availablePharmacyCount > 0 ? "flex items-center gap-1.5 font-medium text-success" : "flex items-center gap-1.5 text-muted-foreground"}>
                        <Building2 className="size-4" aria-hidden />
                        {m.availablePharmacyCount > 0
                          ? `${m.availablePharmacyCount} farmaci raportojnë se e kanë`
                          : "Asnjë farmaci nuk e raporton në dispozicion"}
                      </span>
                      {m.latestReportAt ? (
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="size-4" aria-hidden />
                          {timeAgo(m.latestReportAt)}
                        </span>
                      ) : null}
                    </div>
                  </Link>
                </Card>
              </li>
            ))}
          </ul>
          <Pager meta={data.meta} onPage={(p) => setParam("page", String(p))} />
        </div>
      ) : null}
    </section>
  );
}
