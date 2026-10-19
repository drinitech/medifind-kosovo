"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, CheckCheck, Eye, EyeOff, MoreHorizontal, Package, Pencil, Plus, Power, PowerOff } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Pager } from "@/components/common/pager";
import { FreshnessBadge, StatusBadge } from "@/components/common/status";
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from "@/components/common/states";
import { InventoryFormDialog } from "@/components/dashboard/inventory-form-dialog";
import { ManagerGate } from "@/components/dashboard/manager-gate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { useUrlSyncedState } from "@/hooks/use-url-synced-state";
import { api, errorMessage } from "@/lib/api";
import { dateTime, timeAgo } from "@/lib/format";
import { DOSAGE_FORM_LABELS, SOURCE_LABELS, STATUS_LABELS } from "@/lib/labels";
import type { AvailabilityStatus, InventoryEntry, Paginated } from "@/lib/types";

const ALL = "__all";
const SORT_FIELDS: Record<string, string> = { medicine: "name", status: "status", quantity: "quantity", lastReportedAt: "lastReportedAt" };

export default function InventoryPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <ManagerGate>{(id) => <InventoryView pharmacyId={id} />}</ManagerGate>
    </Suspense>
  );
}

function InventoryView({ pharmacyId }: { pharmacyId: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState("");
  const [status, setStatus] = useUrlSyncedState(params.get("status"), ALL);
  const [active, setActive] = useState<"active" | "inactive" | "all">("active");
  const [freshness, setFreshness] = useUrlSyncedState(params.get("freshness"), ALL);
  const [sorting, setSorting] = useState<SortingState>([{ id: "medicine", desc: false }]);
  const [page, setPage] = useState(1);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [editing, setEditing] = useState<InventoryEntry | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  // "?new=1" (e.g. from the overview's "Shto bar") opens the add dialog. The page may be kept
  // alive between visits (Cache Components / <Activity>), so react to the URL, not to mount.
  const wantsNew = params.get("new") === "1";
  const [handledNew, setHandledNew] = useState(false);
  if (wantsNew && !handledNew) {
    setHandledNew(true);
    setEditing(null);
    setFormOpen(true);
  } else if (!wantsNew && handledNew) {
    setHandledNew(false);
  }
  const [bulkBusy, setBulkBusy] = useState(false);

  const sort = sorting[0];
  const { data, error, loading, reload } = useApi<Paginated<InventoryEntry>>("/pharmacy/inventory", {
    pharmacyId,
    q: q.trim() || undefined,
    status: status === ALL ? undefined : status,
    active,
    freshness: freshness === ALL ? undefined : freshness,
    sort: sort ? SORT_FIELDS[sort.id] : "name",
    order: sort?.desc ? "desc" : "asc",
    page,
    pageSize: 20,
  });

  function resetPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
      setRowSelection({});
    };
  }

  async function quickUpdate(entry: InventoryEntry, body: Record<string, unknown>, message: string) {
    try {
      await api(`/pharmacy/inventory/${entry.id}`, { method: "PATCH", body });
      toast.success(message);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const columns = useMemo<ColumnDef<InventoryEntry>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && "indeterminate")}
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label="Zgjidh të gjitha në këtë faqe"
          />
        ),
        cell: ({ row }) => (
          <Checkbox checked={row.getIsSelected()} onCheckedChange={(v) => row.toggleSelected(!!v)} aria-label={`Zgjidh ${row.original.medicine.name}`} />
        ),
        enableSorting: false,
      },
      {
        id: "medicine",
        header: "Bari",
        cell: ({ row }) => {
          const m = row.original.medicine;
          return (
            <div className="min-w-48">
              <p className="font-medium">
                {m.name} {m.strength}
              </p>
              <p className="text-xs text-muted-foreground">
                {[m.dosageForm ? DOSAGE_FORM_LABELS[m.dosageForm] : null, m.packageSize, m.catalogCode].filter(Boolean).join(" · ")}
              </p>
              {!row.original.isActive ? <Badge variant="outline" className="mt-1">Çaktivizuar</Badge> : null}
            </div>
          );
        },
      },
      {
        id: "status",
        header: "Statusi",
        cell: ({ row }) => <StatusBadge status={row.original.availabilityStatus} />,
      },
      {
        id: "quantity",
        header: "Sasia",
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 tabular-nums">
            {row.original.quantity ?? "—"}
            {row.original.showQuantityPublicly ? (
              <Eye className="size-3.5 text-muted-foreground" aria-label="Sasia shfaqet publikisht" />
            ) : (
              <EyeOff className="size-3.5 text-muted-foreground" aria-label="Sasia nuk shfaqet publikisht" />
            )}
          </div>
        ),
      },
      {
        id: "lastReportedAt",
        header: "Raportuar",
        cell: ({ row }) => (
          <div className="space-y-1">
            <time className="block text-sm" dateTime={row.original.lastReportedAt} title={dateTime(row.original.lastReportedAt)}>
              {timeAgo(row.original.lastReportedAt)}
            </time>
            <span className="text-xs text-muted-foreground">{SOURCE_LABELS[row.original.source]}</span>
            <FreshnessBadge freshness={row.original.freshness} className="ml-1" />
          </div>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Veprime</span>,
        enableSorting: false,
        cell: ({ row }) => {
          const e = row.original;
          return (
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="icon" onClick={() => { setEditing(e); setFormOpen(true); }} aria-label={`Ndrysho ${e.medicine.name}`}>
                <Pencil />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label={`Më shumë veprime për ${e.medicine.name}`}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuGroup>
                    <DropdownMenuItem onSelect={() => quickUpdate(e, { availabilityStatus: e.availabilityStatus, quantity: e.quantity }, "U konfirmua si aktuale.")}>
                      <CheckCheck /> Konfirmo si aktuale
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => quickUpdate(e, { showQuantityPublicly: !e.showQuantityPublicly }, e.showQuantityPublicly ? "Sasia u fsheh nga publiku." : "Sasia tani shfaqet publikisht.")}>
                      {e.showQuantityPublicly ? <EyeOff /> : <Eye />} {e.showQuantityPublicly ? "Fshih sasinë" : "Shfaq sasinë"}
                    </DropdownMenuItem>
                    {e.isActive ? null : (
                      <DropdownMenuItem onSelect={() => quickUpdate(e, { isActive: true }, "U riaktivizua.")}>
                        <Power /> Riaktivizo
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              {e.isActive ? (
                <ConfirmDialog
                  destructive
                  title="Çaktivizo nga inventari?"
                  description={`${e.medicine.name} ${e.medicine.strength ?? ""} nuk do të shfaqet më publikisht. Historiku ruhet dhe mund ta riaktivizoni më vonë.`}
                  confirmLabel="Çaktivizo"
                  onConfirm={async () => {
                    try {
                      await api(`/pharmacy/inventory/${e.id}`, { method: "DELETE" });
                      toast.success("U çaktivizua.");
                      reload();
                    } catch (err) {
                      toast.error(errorMessage(err));
                    }
                  }}
                  trigger={
                    <Button variant="ghost" size="icon" aria-label={`Çaktivizo ${e.medicine.name}`}>
                      <PowerOff className="text-destructive" />
                    </Button>
                  }
                />
              ) : null}
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reload],
  );

  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    getRowId: (r) => r.id,
    state: { sorting, rowSelection },
    onSortingChange: (u) => {
      setSorting(u);
      setPage(1);
    },
    onRowSelectionChange: setRowSelection,
    manualSorting: true,
    manualPagination: true,
    enableSortingRemoval: false,
    getCoreRowModel: getCoreRowModel(),
  });

  const selectedIds = Object.keys(rowSelection).filter((k) => rowSelection[k]);

  async function bulk(body: Record<string, unknown>, message: string) {
    setBulkBusy(true);
    try {
      await api("/pharmacy/inventory/bulk-update", { method: "POST", query: { pharmacyId }, body: { ids: selectedIds, ...body } });
      toast.success(message);
      setRowSelection({});
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Inventari"
        description="Çdo ruajtje regjistrohet si raport i ri me orën aktuale dhe ruhet në historik."
        actions={
          <Button className="h-9" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus aria-hidden /> Shto bar
          </Button>
        }
      />

      <Card className="gap-0 p-0">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <label htmlFor="inv-search" className="sr-only">Kërko në inventar</label>
          <Input id="inv-search" value={q} onChange={(e) => resetPage(setQ)(e.target.value)} placeholder="Kërko sipas emrit, përbërësit ose kodit…" className="h-9 w-full sm:w-72" />
          <Select value={status} onValueChange={resetPage(setStatus)}>
            <SelectTrigger className="h-9 w-44" aria-label="Filtro sipas statusit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Të gjitha statuset</SelectItem>
              {(Object.keys(STATUS_LABELS) as AvailabilityStatus[]).map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
              ))}
              {status.includes(",") ? <SelectItem value={status}>Nuk ka / e panjohur</SelectItem> : null}
            </SelectContent>
          </Select>
          <Select value={freshness} onValueChange={resetPage(setFreshness)}>
            <SelectTrigger className="h-9 w-44" aria-label="Filtro sipas freskisë">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Çdo përditësim</SelectItem>
              <SelectItem value="fresh">Të freskëta</SelectItem>
              <SelectItem value="aging">Jo shumë të reja</SelectItem>
              <SelectItem value="stale">Të vjetruara</SelectItem>
            </SelectContent>
          </Select>
          <Select value={active} onValueChange={(v) => resetPage(setActive)(v as typeof active)}>
            <SelectTrigger className="h-9 w-36" aria-label="Aktive ose jo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Aktive</SelectItem>
              <SelectItem value="inactive">Të çaktivizuara</SelectItem>
              <SelectItem value="all">Të gjitha</SelectItem>
            </SelectContent>
          </Select>
          {(status !== ALL || freshness !== ALL || q) ? (
            <Button variant="ghost" size="sm" onClick={() => { setQ(""); setStatus(ALL); setFreshness(ALL); setPage(1); router.replace(pathname); }}>
              Pastro filtrat
            </Button>
          ) : null}
        </div>

        {selectedIds.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-b bg-accent/60 p-3 text-sm" role="region" aria-label="Veprime në grup">
            <span className="font-medium">{selectedIds.length} të zgjedhura</span>
            <Select disabled={bulkBusy} onValueChange={(v) => bulk({ availabilityStatus: v }, `Statusi u ndryshua për ${selectedIds.length} barna.`)}>
              <SelectTrigger className="h-8 w-44 bg-card" aria-label="Vendos statusin për të zgjedhurat">
                <SelectValue placeholder="Vendos statusin…" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_LABELS) as AvailabilityStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="bg-card" disabled={bulkBusy} onClick={() => bulk({ confirmCurrent: true }, "U konfirmuan si aktuale.")}>
              <CheckCheck aria-hidden /> Konfirmo si aktuale
            </Button>
            <Button size="sm" variant="outline" className="bg-card" disabled={bulkBusy} onClick={() => bulk({ showQuantityPublicly: true }, "Sasitë tani shfaqen publikisht.")}>
              <Eye aria-hidden /> Shfaq sasitë
            </Button>
            <Button size="sm" variant="outline" className="bg-card" disabled={bulkBusy} onClick={() => bulk({ showQuantityPublicly: false }, "Sasitë u fshehën.")}>
              <EyeOff aria-hidden /> Fshih sasitë
            </Button>
            <ConfirmDialog
              destructive
              title={`Çaktivizo ${selectedIds.length} barna?`}
              description="Nuk do të shfaqen më publikisht. Historiku ruhet dhe mund t’i riaktivizoni."
              confirmLabel="Çaktivizo"
              onConfirm={() => bulk({ isActive: false }, "U çaktivizuan.")}
              trigger={
                <Button size="sm" variant="outline" className="bg-card text-destructive" disabled={bulkBusy}>
                  <PowerOff aria-hidden /> Çaktivizo
                </Button>
              }
            />
            <Button size="sm" variant="ghost" onClick={() => setRowSelection({})}>Anulo zgjedhjen</Button>
          </div>
        ) : null}

        {error ? (
          <div className="p-4"><ErrorState error={error} onRetry={reload} /></div>
        ) : !data && loading ? (
          <ListSkeleton className="p-4" rows={5} />
        ) : data && data.items.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Package}
              title="Nuk ka barna për t’u shfaqur"
              description={q || status !== ALL || freshness !== ALL ? "Asnjë rezultat me këto filtra." : "Shtoni barin e parë ose importoni inventarin nga një skedar."}
            />
          </div>
        ) : (
          <div className="overflow-x-auto" aria-busy={loading}>
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((h) => {
                      const canSort = h.column.getCanSort();
                      const dir = h.column.getIsSorted();
                      return (
                        <TableHead key={h.id} aria-sort={dir ? (dir === "desc" ? "descending" : "ascending") : undefined} className={h.id === "select" ? "w-10" : undefined}>
                          {canSort ? (
                            <button type="button" className="inline-flex items-center gap-1 rounded hover:text-foreground" onClick={h.column.getToggleSortingHandler()}>
                              {flexRender(h.column.columnDef.header, h.getContext())}
                              {dir === "asc" ? <ArrowUp className="size-3.5" aria-hidden /> : dir === "desc" ? <ArrowDown className="size-3.5" aria-hidden /> : <ArrowUpDown className="size-3.5 opacity-40" aria-hidden />}
                            </button>
                          ) : (
                            flexRender(h.column.columnDef.header, h.getContext())
                          )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined} className={!row.original.isActive ? "opacity-60" : undefined}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <div className="px-4 pb-3">
          <Pager meta={data?.meta} onPage={(p) => { setPage(p); setRowSelection({}); }} />
        </div>
      </Card>

      <InventoryFormDialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) {
            setEditing(null);
            if (wantsNew) router.replace(pathname, { scroll: false });
          }
        }}
        entry={editing}
        pharmacyId={pharmacyId}
        onSaved={reload}
      />
    </div>
  );
}
