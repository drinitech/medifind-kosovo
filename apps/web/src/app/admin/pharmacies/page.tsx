"use client";

import { BadgeCheck, Building2, ExternalLink, Loader2, Power, PowerOff, ShieldOff, UserMinus, UserPlus } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Pager } from "@/components/common/pager";
import { DemoBadge } from "@/components/common/status";
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApi } from "@/hooks/use-api";
import { useUrlSyncedState } from "@/hooks/use-url-synced-state";
import { api, errorMessage } from "@/lib/api";
import { dateOnly, timeAgo, placeLabel } from "@/lib/format";
import type { Paginated } from "@/lib/types";

interface AdminPharmacy {
  id: string;
  name: string;
  slug: string;
  address: string;
  city: string;
  phone: string | null;
  email: string | null;
  isDemo: boolean;
  dataSource: "REGISTRATION" | "OSM" | "SEED";
  isVerified: boolean;
  isActive: boolean;
  verifiedAt: string | null;
  createdAt: string;
  verifiedBy: { fullName: string } | null;
  memberships: { role: string; user: { id: string; fullName: string; email: string } }[];
  _count: { inventory: number };
  lastInventoryUpdate: string | null;
}

type StatusFilter = "all" | "verified" | "unverified" | "directory" | "inactive";

export default function AdminPharmaciesPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <PharmaciesAdmin />
    </Suspense>
  );
}

function PharmaciesAdmin() {
  const params = useSearchParams();
  const [q, setQ] = useState("");
  const [statusRaw, setStatus] = useUrlSyncedState(params.get("status"), "all");
  const status = statusRaw as StatusFilter;
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi<Paginated<AdminPharmacy>>("/admin/pharmacies", { q: q.trim() || undefined, status, page, pageSize: 15 });

  async function run(promise: Promise<unknown>, message: string) {
    try {
      await promise;
      toast.success(message);
      reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Farmacitë" description="Verifikoni farmacitë e reja, menaxhoni qasjen dhe çaktivizoni regjistrime të dyshimta." />
      <div className="flex flex-wrap gap-2">
        <label htmlFor="ph-q" className="sr-only">Kërko</label>
        <Input id="ph-q" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Emri, qyteti ose adresa…" className="h-9 w-72" />
        <Select value={status} onValueChange={(v) => { setStatus(v as StatusFilter); setPage(1); }}>
          <SelectTrigger className="h-9 w-48" aria-label="Statusi"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Të gjitha</SelectItem>
            <SelectItem value="unverified">Në pritje të verifikimit</SelectItem>
            <SelectItem value="directory">Nga OpenStreetMap (pa pronar)</SelectItem>
            <SelectItem value="verified">Të verifikuara</SelectItem>
            <SelectItem value="inactive">Të çaktivizuara</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data && loading ? (
        <ListSkeleton />
      ) : data && data.items.length === 0 ? (
        <EmptyState icon={Building2} title="Asnjë farmaci" />
      ) : data ? (
        <>
          <ul className="space-y-3">
            {data.items.map((p) => (
              <li key={p.id}>
                <Card className={`gap-3 p-5 ${!p.isActive ? "opacity-70" : ""}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">{p.name}</h2>
                        {p.isDemo ? <DemoBadge /> : null}
                        {!p.isActive ? (
                          <Badge variant="outline" className="border-destructive/30 text-destructive">E çaktivizuar</Badge>
                        ) : p.isVerified ? (
                          <Badge variant="outline" className="gap-1 border-success/30 bg-success-soft text-success"><BadgeCheck className="size-3.5" aria-hidden /> E verifikuar</Badge>
                        ) : p.dataSource === "OSM" ? (
                          <Badge variant="outline">OpenStreetMap · pa pronar</Badge>
                        ) : (
                          <Badge variant="outline" className="border-warning/40 bg-warning-soft">Në pritje</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{placeLabel(p)} {p.phone ? `· ${p.phone}` : ""} {p.email ? `· ${p.email}` : ""}</p>
                      <p className="text-xs text-muted-foreground">
                        Regjistruar {dateOnly(p.createdAt)}
                        {p.verifiedAt ? ` · verifikuar ${dateOnly(p.verifiedAt)}${p.verifiedBy ? ` nga ${p.verifiedBy.fullName}` : ""}` : ""}
                        {` · ${p._count.inventory} barna aktive · inventari ${p.lastInventoryUpdate ? `përditësuar ${timeAgo(p.lastInventoryUpdate)}` : "pa raport"}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {p.isVerified && p.isActive ? (
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/pharmacies/${p.slug}`}><ExternalLink aria-hidden /> Profili publik</Link>
                        </Button>
                      ) : null}
                      {p.isVerified ? (
                        <ConfirmDialog
                          title="Hiq verifikimin?"
                          description={`${p.name} dhe inventari i saj do të hiqen nga kërkimet publike derisa të verifikohet sërish.`}
                          confirmLabel="Hiq verifikimin"
                          destructive
                          onConfirm={() => run(api(`/admin/pharmacies/${p.id}/verify`, { method: "PATCH", body: { isVerified: false } }), "Verifikimi u hoq.")}
                          trigger={<Button variant="outline" size="sm"><ShieldOff aria-hidden /> Hiq verifikimin</Button>}
                        />
                      ) : (
                        <ConfirmDialog
                          title="Verifiko farmacinë?"
                          description={`Konfirmoni që keni kontrolluar se ${p.name} është farmaci e licencuar dhe të dhënat janë të sakta. Pas verifikimit, farmacia shfaqet publikisht.`}
                          confirmLabel="Verifiko"
                          onConfirm={() => run(api(`/admin/pharmacies/${p.id}/verify`, { method: "PATCH", body: { isVerified: true } }), "Farmacia u verifikua.")}
                          trigger={<Button size="sm" disabled={!p.isActive}><BadgeCheck aria-hidden /> Verifiko</Button>}
                        />
                      )}
                      {p.isActive ? (
                        <ConfirmDialog
                          title="Çaktivizo farmacinë?"
                          description={`${p.name} do të fshihet nga publiku. Të dhënat dhe historiku ruhen; mund ta riaktivizoni.`}
                          confirmLabel="Çaktivizo"
                          destructive
                          onConfirm={() => run(api(`/admin/pharmacies/${p.id}`, { method: "PATCH", body: { isActive: false } }), "Farmacia u çaktivizua.")}
                          trigger={<Button variant="outline" size="sm" className="text-destructive"><PowerOff aria-hidden /> Çaktivizo</Button>}
                        />
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => run(api(`/admin/pharmacies/${p.id}`, { method: "PATCH", body: { isActive: true } }), "Farmacia u riaktivizua.")}>
                          <Power aria-hidden /> Riaktivizo
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 border-t pt-3 text-sm">
                    <span className="text-muted-foreground">Menaxherët:</span>
                    {p.memberships.length === 0 ? <span className="text-muted-foreground">asnjë</span> : null}
                    {p.memberships.map((m) => (
                      <span key={m.user.id} className="inline-flex items-center gap-1 rounded-full bg-muted py-0.5 pr-1 pl-3">
                        {m.user.fullName} <span className="text-xs text-muted-foreground">({m.user.email})</span>
                        <ConfirmDialog
                          title="Hiq qasjen?"
                          description={`${m.user.fullName} nuk do të mund të menaxhojë më ${p.name}.`}
                          confirmLabel="Hiq qasjen"
                          destructive
                          onConfirm={() => run(api(`/admin/pharmacies/${p.id}/members/${m.user.id}`, { method: "DELETE" }), "Qasja u hoq.")}
                          trigger={
                            <button type="button" className="rounded-full p-1 hover:bg-destructive/10" aria-label={`Hiq qasjen e ${m.user.fullName}`}>
                              <UserMinus className="size-3.5 text-destructive" />
                            </button>
                          }
                        />
                      </span>
                    ))}
                    <AddMemberDialog pharmacy={p} onDone={reload} />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
          <Pager meta={data.meta} onPage={setPage} />
        </>
      ) : null}
    </div>
  );
}

function AddMemberDialog({ pharmacy, onDone }: { pharmacy: AdminPharmacy; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api(`/admin/pharmacies/${pharmacy.id}/members`, { method: "POST", body: { email } });
      toast.success("Qasja u dha.");
      setOpen(false);
      setEmail("");
      onDone();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm"><UserPlus aria-hidden /> Shto menaxher</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Jep qasje në {pharmacy.name}</DialogTitle>
          <DialogDescription>Përdoruesi duhet të ketë llogari. Nëse është përdorues i zakonshëm, bëhet menaxher farmacie.</DialogDescription>
        </DialogHeader>
        <form id={`member-${pharmacy.id}`} onSubmit={submit} className="space-y-2">
          <Label htmlFor={`member-email-${pharmacy.id}`}>Email-i i përdoruesit</Label>
          <Input id={`member-email-${pharmacy.id}`} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Anulo</Button>
          <Button type="submit" form={`member-${pharmacy.id}`} disabled={busy || !email}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : null} Jep qasje
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
