"use client";

import { BadgeCheck, ExternalLink, Hourglass } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { ErrorState, ListSkeleton, PageHeader } from "@/components/common/states";
import { ManagerGate } from "@/components/dashboard/manager-gate";
import { PharmacyProfileForm } from "@/components/dashboard/pharmacy-profile-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useApi } from "@/hooks/use-api";
import type { OwnPharmacy } from "@/lib/types";

export default function ProfilePage() {
  return <ManagerGate>{(id) => <ProfileView pharmacyId={id} />}</ManagerGate>;
}

function ProfileView({ pharmacyId }: { pharmacyId: string }) {
  const { refresh } = useAuth();
  const { data, error, reload } = useApi<OwnPharmacy>("/pharmacy/profile", { pharmacyId });
  return (
    <div className="space-y-5">
      <PageHeader
        title="Profili i farmacisë"
        description="Këto të dhëna shfaqen publikisht. Mos vendosni të dhëna personale."
        actions={
          data?.isVerified ? (
            <Button variant="outline" className="h-9" asChild>
              <Link href={`/pharmacies/${data.slug}`}>
                <ExternalLink aria-hidden /> Shiko profilin publik
              </Link>
            </Button>
          ) : null
        }
      />
      {data ? (
        <div>
          {data.isVerified ? (
            <Badge variant="outline" className="gap-1 border-success/30 bg-success-soft text-success">
              <BadgeCheck className="size-3.5" aria-hidden /> E verifikuar
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1">
              <Hourglass className="size-3.5" aria-hidden /> Në pritje të verifikimit
            </Badge>
          )}
        </div>
      ) : null}
      <Card>
        <CardContent className="pt-6">
          {error ? (
            <ErrorState error={error} onRetry={reload} />
          ) : !data ? (
            <ListSkeleton rows={2} />
          ) : (
            <PharmacyProfileForm
              key={data.updatedAt ?? data.id}
              initial={data}
              pharmacyId={pharmacyId}
              onSaved={() => {
                reload();
                void refresh();
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
