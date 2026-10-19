"use client";

import { Power, PowerOff, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Pager } from "@/components/common/pager";
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApi } from "@/hooks/use-api";
import { api, errorMessage } from "@/lib/api";
import { dateOnly } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/labels";
import type { Paginated, Role } from "@/lib/types";

interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  memberships: { pharmacy: { id: string; name: string } }[];
  _count: { alerts: number };
}

const ALL = "__all";

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const [q, setQ] = useState("");
  const [role, setRole] = useState(ALL);
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi<Paginated<AdminUser>>("/admin/users", {
    q: q.trim() || undefined,
    role: role === ALL ? undefined : role,
    status,
    page,
    pageSize: 20,
  });

  async function update(u: AdminUser, body: { role?: Role; isActive?: boolean }, message: string) {
    try {
      await api(`/admin/users/${u.id}`, { method: "PATCH", body });
      toast.success(message);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Përdoruesit" description="Ndryshoni rolet ose çaktivizoni llogaritë. Fjalëkalimet nuk shfaqen kurrë." />
      <Card className="gap-0 p-0">
        <div className="flex flex-wrap gap-2 border-b p-3">
          <label htmlFor="u-q" className="sr-only">Kërko</label>
          <Input id="u-q" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Emri ose email-i…" className="h-9 w-72" />
          <Select value={role} onValueChange={(v) => { setRole(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-48" aria-label="Roli"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Të gjitha rolet</SelectItem>
              {(Object.keys(ROLE_LABELS) as Role[]).map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => { setStatus(v as typeof status); setPage(1); }}>
            <SelectTrigger className="h-9 w-36" aria-label="Statusi"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Të gjitha</SelectItem>
              <SelectItem value="active">Aktive</SelectItem>
              <SelectItem value="inactive">Joaktive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {error ? (
          <div className="p-4"><ErrorState error={error} onRetry={reload} /></div>
        ) : !data && loading ? (
          <ListSkeleton className="p-4" />
        ) : data && data.items.length === 0 ? (
          <div className="p-4"><EmptyState icon={Users} title="Asnjë përdorues" /></div>
        ) : data ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Përdoruesi</TableHead>
                  <TableHead>Roli</TableHead>
                  <TableHead>Farmacitë</TableHead>
                  <TableHead>Regjistruar</TableHead>
                  <TableHead><span className="sr-only">Veprime</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((u) => {
                  const self = u.id === me?.id;
                  return (
                    <TableRow key={u.id} className={!u.isActive ? "opacity-60" : undefined}>
                      <TableCell>
                        <p className="font-medium">{u.fullName} {self ? <span className="text-xs text-muted-foreground">(ju)</span> : null}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                        {!u.isActive ? <Badge variant="outline" className="mt-1">Joaktiv</Badge> : null}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={u.role}
                          disabled={self}
                          onValueChange={(r) => update(u, { role: r as Role }, `Roli u ndryshua në “${ROLE_LABELS[r as Role]}”.`)}
                        >
                          <SelectTrigger className="h-8 w-48" aria-label={`Roli i ${u.fullName}`}><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(Object.keys(ROLE_LABELS) as Role[]).map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-sm">{u.memberships.map((m) => m.pharmacy.name).join(", ") || "—"}</TableCell>
                      <TableCell className="text-sm">{dateOnly(u.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        {self ? null : u.isActive ? (
                          <ConfirmDialog
                            destructive
                            title="Çaktivizo llogarinë?"
                            description={`${u.fullName} do të dalë menjëherë nga sistemi dhe nuk do të mund të kyçet.`}
                            confirmLabel="Çaktivizo"
                            onConfirm={() => update(u, { isActive: false }, "Llogaria u çaktivizua.")}
                            trigger={<Button variant="ghost" size="sm" className="text-destructive"><PowerOff aria-hidden /> Çaktivizo</Button>}
                          />
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => update(u, { isActive: true }, "Llogaria u riaktivizua.")}>
                            <Power aria-hidden /> Riaktivizo
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : null}
        <div className="px-4 pb-3"><Pager meta={data?.meta} onPage={setPage} /></div>
      </Card>
    </div>
  );
}
