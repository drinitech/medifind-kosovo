"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SiteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center" role="alert">
      <AlertCircle className="size-10 text-destructive" aria-hidden />
      <h1 className="text-2xl font-semibold">Diçka shkoi keq</h1>
      <p className="text-muted-foreground">Ndodhi një gabim i papritur gjatë shfaqjes së faqes.</p>
      <Button onClick={reset}>Provo përsëri</Button>
    </div>
  );
}
