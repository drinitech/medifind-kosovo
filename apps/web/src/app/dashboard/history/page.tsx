"use client";

import { History } from "lucide-react";
import { useState } from "react";
import { Pager } from "@/components/common/pager";
import { EmptyState, ErrorState, ListSkeleton, PageHeader } from "@/components/common/states";
import { HistoryList } from "@/components/dashboard/history-list";
import { ManagerGate } from "@/components/dashboard/manager-gate";
import { Card, CardContent } from "@/components/ui/card";
import { useApi } from "@/hooks/use-api";
import type { HistoryEntry, Paginated } from "@/lib/types";

export default function HistoryPage() {
  return <ManagerGate>{(id) => <HistoryView pharmacyId={id} />}</ManagerGate>;
}

function HistoryView({ pharmacyId }: { pharmacyId: string }) {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi<Paginated<HistoryEntry>>("/pharmacy/inventory/history", { pharmacyId, page, pageSize: 25 });
  return (
    <div className="space-y-5">
      <PageHeader title="Historiku i inventarit" description="Çdo ndryshim statusi, sasie ose aktivizimi, me orën dhe llogarinë përgjegjëse." />
      <Card>
        <CardContent>
          {error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : !data && loading ? (
            <ListSkeleton rows={5} />
          ) : data && data.items.length === 0 ? (
            <EmptyState icon={History} title="Ende pa histori" description="Ndryshimet e inventarit do të shfaqen këtu." />
          ) : data ? (
            <>
              <HistoryList items={data.items} />
              <Pager meta={data.meta} onPage={setPage} />
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
