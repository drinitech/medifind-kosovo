"use client";

import { Package, Power, PowerOff } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Pager } from "@/components/common/pager";
import { FreshnessBadge, StatusBadge } from "@/components/common/status";
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from "@/components/common/states";
import { HistoryList } from "@/components/dashboard/history-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { useUrlSyncedState } from "@/hooks/use-url-synced-state";
import { api, errorMessage } from "@/lib/api";
import { dateTime, timeAgo } from "@/lib/format";
import { SOURCE_LABELS, STATUS_LABELS } from "@/lib/labels";
import type { AvailabilityStatus, Freshness, HistoryEntry, InventorySource, Medicine, Paginated } from "@/lib/types";

interface AdminInventoryRow {
  id: string;
  availabilityStatus: AvailabilityStatus;
  quantity: number | null;
  isActive: boolean;
  lastReportedAt: string;
  source: InventorySource;
  freshness: Freshness;
  medicine: Medicine;
  pharmacy: { id: string; name: string; city: string; isVerified: boolean };
}

const ALL = "__all";

export default function AdminInventoryPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <AdminInventory />
    </Suspense>
  );
}

function AdminInventory() {
  const params = useSearchParams();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(ALL);
  const [freshness, setFreshness] = useUrlSyncedState(params.get("freshness"), ALL);
  const [active, setActive] = useState<"active" | "inactive" | "all">("active");
  const [page, setPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const { data, error, loading, reload } = useApi<Paginated<AdminInventoryRow>>("/admin/inventory", {
    q: q.trim() || undefined,
    status: status === ALL ? undefined : status,
    freshness: freshness === ALL ? undefined : freshness,
    active,
    page,
    pageSize: 20,
  });
  const history = useApi<Paginated<HistoryEntry>>("/admin/inventory-history", { page: historyPage, pageSize: 10 });

  async function toggle(row: AdminInventoryRow, isActive: boolean) {
    try {
      await api(`/admin/inventory/${row.id}`, { method: "PATCH", body: { isActive } });
      toast.success(isActive ? "Regjistrimi u rikthye." : "Regjistrimi u çaktivizua.");
      reload();
      history.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Shqyrtimi i inventarit" description="Raportet më të vjetra shfaqen të parat. Çaktivizoni regjistrimet e pasakta — historiku ruhet." />
      <Card className="gap-0 p-0">
        <div className="flex flex-wrap gap-2 border-b p-3">
          <label htmlFor="ai-q" className="sr-only">Kërko barin</label>
          <Input id="ai-q" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Kërko barin…" className="h-9 w-64" />
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-44" aria-label="Statusi"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Të gjitha statuset</SelectItem>
              {(Object.keys(STATUS_LABELS) as AvailabilityStatus[]).map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={freshness} onValueChange={(v) => { setFreshness(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-44" aria-label="Freskia"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Çdo përditësim</SelectItem>
              <SelectItem value="fresh">Të freskëta</SelectItem>
              <SelectItem value="aging">Jo shumë të reja</SelectItem>
              <SelectItem value="stale">Të vjetruara</SelectItem>
            </SelectContent>
          </Select>
          <Select value={active} onValueChange={(v) => { setActive(v as typeof active); setPage(1); }}>
            <SelectTrigger className="h-9 w-40" aria-label="Aktive"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Aktive</SelectItem>
              <SelectItem value="inactive">Të çaktivizuara</SelectItem>
              <SelectItem value="all">Të gjitha</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {error ? (
          <div className="p-4"><ErrorState error={error} onRetry={reload} /></div>
        ) : !data && loading ? (
          <ListSkeleton className="p-4" />
        ) : data && data.items.length === 0 ? (
          <div className="p-4"><EmptyState icon={Package} title="Asnjë regjistrim" /></div>
        ) : data ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bari</TableHead>
                  <TableHead>Farmacia</TableHead>
                  <TableHead>Statusi</TableHead>
                  <TableHead>Raportuar</TableHead>
                  <TableHead><span className="sr-only">Veprime</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((r) => (
                  <TableRow key={r.id} className={!r.isActive ? "opacity-60" : undefined}>
                    <TableCell>
                      <Link href={`/medicines/${r.medicine.id}`} className="font-medium hover:underline">{r.medicine.name} {r.medicine.strength}</Link>
                      {!r.isActive ? <Badge variant="outline" className="ml-2">Çaktivizuar</Badge> : null}
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.pharmacy.name}
                      <span className="block text-xs text-muted-foreground">{r.pharmacy.city}{r.pharmacy.isVerified ? "" : " · e paverifikuar"}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge status={r.availabilityStatus} />
                        <span className="text-xs text-muted-foreground tabular-nums">{r.quantity ?? "—"} copë</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <time dateTime={r.lastReportedAt} title={dateTime(r.lastReportedAt)}>{timeAgo(r.lastReportedAt)}</time>
                      <span className="block text-xs text-muted-foreground">{SOURCE_LABELS[r.source]}</span>
                      <FreshnessBadge freshness={r.freshness} className="mt-1" />
                    </TableCell>
                    <TableCell className="text-right">
                      {r.isActive ? (
                        <ConfirmDialog
                          destructive
                          title="Çaktivizo regjistrimin?"
                          description={`${r.medicine.name} ${r.medicine.strength ?? ""} në ${r.pharmacy.name} nuk do të shfaqet më publikisht. Ndryshimi regjistrohet në historik dhe në auditim.`}
                          confirmLabel="Çaktivizo"
                          onConfirm={() => toggle(r, false)}
                          trigger={<Button variant="ghost" size="sm" className="text-destructive"><PowerOff aria-hidden /> Çaktivizo</Button>}
                        />
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => toggle(r, true)}><Power aria-hidden /> Rikthe</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
        <div className="px-4 pb-3"><Pager meta={data?.meta} onPage={setPage} /></div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Historiku i përditësimeve (të gjitha farmacitë)</CardTitle>
        </CardHeader>
        <CardContent>
          {history.error ? (
            <ErrorState error={history.error} onRetry={history.reload} />
          ) : !history.data ? (
            <ListSkeleton rows={3} />
          ) : (
            <>
              <HistoryList items={history.data.items} showPharmacy />
              <Pager meta={history.data.meta} onPage={setHistoryPage} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
