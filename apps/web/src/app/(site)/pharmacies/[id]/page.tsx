import type { Metadata } from "next";
import { Suspense, use } from "react";
import { ListSkeleton } from "@/components/common/states";
import { PharmacyProfileView } from "@/components/pharmacies/pharmacy-profile-view";

export const metadata: Metadata = { title: "Profili i farmacisë" };

function ProfileFromParams({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <PharmacyProfileView id={id} />;
}

export default function PharmacyPage({ params }: PageProps<"/pharmacies/[id]">) {
  return (
    <Suspense fallback={<ListSkeleton className="mx-auto max-w-6xl px-4 py-8" />}>
      <ProfileFromParams params={params} />
    </Suspense>
  );
}
