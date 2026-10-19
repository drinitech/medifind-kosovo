import type { Metadata } from "next";
import { Suspense, use } from "react";
import { ListSkeleton } from "@/components/common/states";
import { MedicineView } from "@/components/medicines/medicine-view";

export const metadata: Metadata = { title: "Disponueshmëria e barit" };

function MedicineFromParams({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <MedicineView id={id} />;
}

export default function MedicinePage({ params }: PageProps<"/medicines/[id]">) {
  return (
    <Suspense fallback={<ListSkeleton className="mx-auto max-w-6xl px-4 py-8" />}>
      <MedicineFromParams params={params} />
    </Suspense>
  );
}
