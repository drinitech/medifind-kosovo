import { BellRing, Building2, ClipboardCheck, FileSpreadsheet, MapPinned, PhoneCall, Search, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { ReportedNotice } from "@/components/common/status";
import { ListSkeleton } from "@/components/common/states";
import { SearchBar } from "@/components/medicines/search-bar";
import { SearchResults } from "@/components/medicines/search-results";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const POPULAR = ["Paracetamol", "Ibuprofen", "Amoxicillin", "Omeprazole", "Salbutamol", "Insulin"];

const STEPS = [
  { icon: Search, title: "Kërkoni barin", text: "Shkruani emrin, përbërësin aktiv ose dozën. Format dhe dozat e ndryshme shfaqen veçmas." },
  { icon: MapPinned, title: "Shihni farmacitë", text: "Shihni cilat farmaci raportojnë se e kanë, sa larg janë dhe kur u përditësua raporti." },
  { icon: PhoneCall, title: "Konfirmoni me farmacinë", text: "Disponueshmëria raportohet nga farmacitë — telefononi para se të shkoni." },
  { icon: BellRing, title: "Merrni njoftim", text: "Nëse bari mungon, krijoni një alarm dhe ju njoftojmë kur një farmaci e raporton sërish." },
];

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-accent/70 via-background to-background">
        <div className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-primary/10 blur-3xl" aria-hidden />
        <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 pt-16 pb-14 text-center md:pt-24 md:pb-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-card px-3 py-1 text-xs font-medium text-accent-foreground">
            <ShieldCheck className="size-3.5" aria-hidden /> Vetëm farmaci të verifikuara
          </span>
          <h1 className="text-4xl font-semibold text-balance md:text-5xl">
            Gjeni barin që ju duhet në <span className="text-primary">farmacitë pranë jush</span>
          </h1>
          <p className="max-w-2xl text-lg text-pretty text-muted-foreground">
            Kërkoni barna dhe shihni cilat farmaci në Kosovë raportojnë se i kanë në dispozicion, ku ndodhen dhe kur u
            përditësua inventari i tyre.
          </p>
          <Suspense fallback={<Skeleton className="h-[60px] w-full rounded-2xl" />}>
            <SearchBar />
          </Suspense>
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
            <span className="text-muted-foreground">Kërkime të shpeshta:</span>
            {POPULAR.map((term) => (
              <Link
                key={term}
                href={`/?q=${encodeURIComponent(term)}#rezultatet`}
                className="rounded-full border bg-card px-3 py-1 font-medium transition-colors hover:border-primary/40 hover:bg-accent hover:text-accent-foreground"
              >
                {term}
              </Link>
            ))}
          </div>
          <ReportedNotice className="max-w-xl text-left" />
        </div>
      </section>

      <Suspense fallback={<ListSkeleton className="mx-auto max-w-6xl px-4 py-10" />}>
        <SearchResults />
      </Suspense>

      <section className="mx-auto max-w-6xl px-4 py-16" aria-labelledby="how-heading">
        <h2 id="how-heading" className="text-center text-2xl font-semibold md:text-3xl">
          Si funksionon
        </h2>
        <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="rounded-2xl border bg-card p-6">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <step.icon className="size-5" aria-hidden />
                </span>
                <span className="text-sm font-medium text-muted-foreground">Hapi {i + 1}</span>
              </div>
              <h3 className="font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="per-farmacite" className="scroll-mt-20 border-y bg-card" aria-labelledby="join-heading">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2">
          <div className="space-y-4">
            <span className="inline-flex items-center gap-2 text-sm font-medium text-primary">
              <Building2 className="size-4" aria-hidden /> Për farmacitë
            </span>
            <h2 id="join-heading" className="text-2xl font-semibold md:text-3xl">
              Bëjeni më të lehtë për pacientët t’ju gjejnë
            </h2>
            <p className="text-muted-foreground">
              Regjistroni farmacinë, prisni verifikimin nga ekipi ynë dhe mbani inventarin të përditësuar — me dorë ose
              duke ngarkuar një skedar CSV/Excel. Ju vendosni nëse sasitë shfaqen publikisht.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button className="h-10 px-5" asChild>
                <Link href="/register?type=pharmacy">Regjistro farmacinë</Link>
              </Button>
              <Button variant="outline" className="h-10 px-5" asChild>
                <Link href="/login">Kyçu në panel</Link>
              </Button>
            </div>
          </div>
          <ol className="space-y-4">
            {[
              { icon: ClipboardCheck, title: "1. Krijoni llogarinë dhe profilin", text: "Emri, adresa dhe vendndodhja e farmacisë në hartë." },
              { icon: ShieldCheck, title: "2. Verifikimi", text: "Administratori verifikon farmacinë para se të shfaqet publikisht." },
              { icon: FileSpreadsheet, title: "3. Përditësoni inventarin", text: "Ndryshime të shpejta, përditësime në grup ose import nga skedari me parapamje." },
            ].map((s) => (
              <li key={s.title} className="flex gap-4 rounded-xl border bg-background p-4">
                <s.icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <div>
                  <h3 className="font-medium">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </>
  );
}
