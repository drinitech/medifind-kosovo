"use client";

import { ChevronDown, ClipboardList } from "lucide-react";
import { useState } from "react";
import { Pager } from "@/components/common/pager";
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApi } from "@/hooks/use-api";
import { dateTime } from "@/lib/format";
import { AUDIT_ACTION_LABELS } from "@/lib/labels";
import type { Paginated } from "@/lib/types";

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  createdAt: string;
  user: { id: string; fullName: string; email: string } | null;
}

const ALL = "__all";
const ENTITY_TYPES = ["User", "Pharmacy", "Medicine", "PharmacyInventory", "System"];

export default function AuditLogsPage() {
  const [action, setAction] = useState(ALL);
  const [entityType, setEntityType] = useState(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi<Paginated<AuditEntry> & { actions: string[] }>("/admin/audit-logs", {
    action: action === ALL ? undefined : action,
    entityType: entityType === ALL ? undefined : entityType,
    from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
    to: to ? new Date(`${to}T23:59:59`).toISOString() : undefined,
    page,
    pageSize: 25,
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Regjistri i auditimit" description="Ndryshimet e ndjeshme: llogaritë, verifikimet, katalogu dhe inventari." />
      <Card className="gap-0 p-0">
        <div className="flex flex-wrap items-end gap-3 border-b p-3">
          <div className="space-y-1">
            <Label htmlFor="al-action" className="text-xs text-muted-foreground">Veprimi</Label>
            <Select value={action} onValueChange={(v) => { setAction(v); setPage(1); }}>
              <SelectTrigger id="al-action" className="h-9 w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Të gjitha veprimet</SelectItem>
                {(data?.actions ?? []).map((a) => <SelectItem key={a} value={a}>{AUDIT_ACTION_LABELS[a] ?? a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="al-entity" className="text-xs text-muted-foreground">Objekti</Label>
            <Select value={entityType} onValueChange={(v) => { setEntityType(v); setPage(1); }}>
              <SelectTrigger id="al-entity" className="h-9 w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Të gjitha</SelectItem>
                {ENTITY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="al-from" className="text-xs text-muted-foreground">Nga</Label>
            <Input id="al-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="h-9 w-40" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="al-to" className="text-xs text-muted-foreground">Deri</Label>
            <Input id="al-to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="h-9 w-40" />
          </div>
        </div>
        {error ? (
          <div className="p-4"><ErrorState error={error} onRetry={reload} /></div>
        ) : !data && loading ? (
          <ListSkeleton className="p-4" />
        ) : data && data.items.length === 0 ? (
          <div className="p-4"><EmptyState icon={ClipboardList} title="Asnjë hyrje" description="Asnjë veprim nuk përputhet me filtrat." /></div>
        ) : data ? (
          <ul className="divide-y">
            {data.items.map((e) => (
              <li key={e.id} className="px-4 py-3">
                <details className="group">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 rounded">
                    <Badge variant="secondary">{AUDIT_ACTION_LABELS[e.action] ?? e.action}</Badge>
                    <span className="text-sm">{e.user ? `${e.user.fullName} (${e.user.email})` : "Sistemi"}</span>
                    <span className="text-xs text-muted-foreground">{e.entityType}{e.entityId ? ` · ${e.entityId}` : ""}</span>
                    <time className="ml-auto text-xs text-muted-foreground" dateTime={e.createdAt}>{dateTime(e.createdAt)}</time>
                    <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
                  </summary>
                  <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-muted p-3 text-xs">{JSON.stringify(e.metadata ?? {}, null, 2)}</pre>
                </details>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="px-4 pb-3"><Pager meta={data?.meta} onPage={setPage} /></div>
      </Card>
    </div>
  );
}
