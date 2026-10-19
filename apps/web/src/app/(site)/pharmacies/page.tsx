import type { Metadata } from "next";
import { PharmaciesView } from "@/components/pharmacies/pharmacies-view";

export const metadata: Metadata = { title: "Farmacitë" };

export default function PharmaciesPage() {
  return <PharmaciesView />;
}
