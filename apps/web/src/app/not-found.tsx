import Link from "next/link";
import { Suspense } from "react";
import { HeaderFallback } from "@/components/layout/header-fallback";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <>
      <Suspense fallback={<HeaderFallback />}>
        <SiteHeader />
      </Suspense>
      <main id="main" className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
        <p className="text-sm font-medium text-primary">404</p>
        <h1 className="text-3xl font-semibold">Faqja nuk u gjet</h1>
        <p className="text-muted-foreground">Adresa mund të jetë e gabuar ose faqja nuk ekziston më.</p>
        <Button asChild>
          <Link href="/">Kthehu te kërkimi</Link>
        </Button>
      </main>
      <SiteFooter />
    </>
  );
}
