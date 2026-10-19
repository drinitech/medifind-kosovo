"use client";

import { Bell, BellOff, BellRing, CheckCheck, MapPin, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Pager } from "@/components/common/pager";
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApi } from "@/hooks/use-api";
import { api, errorMessage } from "@/lib/api";
import { dateTime, timeAgo } from "@/lib/format";
import { medicineLabel } from "@/lib/labels";
import type { Alert, AppNotification, Paginated } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function AlertsPage() {
  const { refresh } = useAuth();
  const [page, setPage] = useState(1);
  const notifications = useApi<Paginated<AppNotification> & { unreadCount: number }>("/notifications", { page, pageSize: 15 });
  const alerts = useApi<Alert[]>("/alerts");

  async function markRead(n: AppNotification) {
    if (n.readAt) return;
    try {
      await api(`/notifications/${n.id}/read`, { method: "PATCH" });
      notifications.mutate((prev) =>
        prev
          ? { ...prev, unreadCount: Math.max(0, prev.unreadCount - 1), items: prev.items.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)) }
          : prev,
      );
      void refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function markAll() {
    try {
      await api("/notifications/read-all", { method: "PATCH" });
      notifications.reload();
      void refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  async function toggleAlert(a: Alert) {
    try {
      await api(`/alerts/${a.id}`, { method: "PATCH", body: { isActive: !a.isActive } });
      toast.success(a.isActive ? "Alarmi u çaktivizua." : "Alarmi u riaktivizua.");
      alerts.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const unread = notifications.data?.unreadCount ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader title="Njoftimet & alarmet" description="Njoftimet dërgohen në aplikacion. Email-i nuk dërgohet ende." />
      <Tabs defaultValue="notifications">
        <TabsList>
          <TabsTrigger value="notifications">
            Njoftimet {unread > 0 ? <Badge className="ml-1.5 h-5 px-1.5">{unread}</Badge> : null}
          </TabsTrigger>
          <TabsTrigger value="alerts">Alarmet e mia {alerts.data ? `(${alerts.data.filter((a) => a.isActive).length})` : ""}</TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Njoftimet</CardTitle>
              <Button variant="ghost" size="sm" onClick={markAll} disabled={unread === 0}>
                <CheckCheck aria-hidden /> Shëno të gjitha si të lexuara
              </Button>
            </CardHeader>
            <CardContent>
              {notifications.error ? (
                <ErrorState error={notifications.error} onRetry={notifications.reload} />
              ) : !notifications.data ? (
                <ListSkeleton rows={3} />
              ) : notifications.data.items.length === 0 ? (
                <EmptyState icon={Bell} title="Nuk keni njoftime" description="Krijoni një alarm nga faqja e një bari dhe do të njoftoheni kur të raportohet në dispozicion." />
              ) : (
                <>
                  <ul className="divide-y">
                    {notifications.data.items.map((n) => (
                      <li key={n.id} className={cn("flex gap-3 py-3", !n.readAt && "font-medium")}>
                        <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")} aria-hidden />
                        <div className="min-w-0 flex-1 space-y-1">
                          <p>{n.title}</p>
                          <p className="text-sm font-normal text-muted-foreground">{n.message}</p>
                          <div className="flex flex-wrap items-center gap-3 text-xs font-normal text-muted-foreground">
                            <time dateTime={n.createdAt} title={dateTime(n.createdAt)}>{timeAgo(n.createdAt)}</time>
                            {n.link ? (
                              <Link href={n.link} onClick={() => void markRead(n)} className="font-medium text-primary hover:underline">
                                Shiko disponueshmërinë
                              </Link>
                            ) : null}
                            {!n.readAt ? (
                              <button type="button" onClick={() => void markRead(n)} className="hover:text-foreground hover:underline">
                                Shëno si të lexuar
                              </button>
                            ) : (
                              <span>Lexuar</span>
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <Pager meta={notifications.data.meta} onPage={setPage} />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Alarmet e disponueshmërisë</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link href="/"><Search aria-hidden /> Kërko një bar</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {alerts.error ? (
                <ErrorState error={alerts.error} onRetry={alerts.reload} />
              ) : !alerts.data ? (
                <ListSkeleton rows={2} />
              ) : alerts.data.length === 0 ? (
                <EmptyState icon={BellRing} title="Nuk keni alarme" description="Hapni faqen e një bari dhe zgjidhni “Më njofto kur të jetë në dispozicion”." />
              ) : (
                <ul className="divide-y">
                  {alerts.data.map((a) => (
                    <li key={a.id} className={cn("flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between", !a.isActive && "opacity-60")}>
                      <div className="space-y-1">
                        <Link href={`/medicines/${a.medicine.id}`} className="font-medium hover:text-primary hover:underline">
                          {medicineLabel(a.medicine)}
                        </Link>
                        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MapPin className="size-3" aria-hidden />
                            {a.preferredCity ? a.preferredCity : a.radiusKm ? `Brenda ${a.radiusKm} km` : "Kudo në Kosovë"}
                          </span>
                          <span>Krijuar {timeAgo(a.createdAt)}</span>
                          {a.lastNotifiedAt ? <span>Njoftimi i fundit {timeAgo(a.lastNotifiedAt)}</span> : null}
                        </p>
                        {a.isActive && a.currentlyAvailableCount > 0 ? (
                          <Badge variant="outline" className="border-success/30 bg-success-soft text-success">
                            {a.currentlyAvailableCount} farmaci e raportojnë tani në dispozicion
                          </Badge>
                        ) : null}
                      </div>
                      {a.isActive ? (
                        <ConfirmDialog
                          title="Çaktivizo alarmin?"
                          description="Nuk do të merrni më njoftime për këtë bar. Mund ta riaktivizoni më vonë."
                          confirmLabel="Çaktivizo"
                          onConfirm={() => toggleAlert(a)}
                          trigger={
                            <Button variant="outline" size="sm">
                              <BellOff aria-hidden /> Çaktivizo
                            </Button>
                          }
                        />
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => toggleAlert(a)}>
                          <BellRing aria-hidden /> Riaktivizo
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
