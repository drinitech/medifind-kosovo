import Link from "next/link";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t bg-card">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-[2fr_1fr_1fr]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-md text-sm text-muted-foreground">
            MediFind Kosovo tregon disponueshmërinë e barnave siç raportohet nga farmacitë. Të dhënat nuk janë stok i
            konfirmuar në kohë reale — kontaktoni gjithmonë farmacinë para se të shkoni. Kjo platformë nuk jep këshilla
            mjekësore.
          </p>
        </div>
        <div className="space-y-2 text-sm">
          <h2 className="font-semibold">Platforma</h2>
          <ul className="space-y-1.5 text-muted-foreground">
            <li><Link className="hover:text-foreground" href="/">Kërko barna</Link></li>
            <li><Link className="hover:text-foreground" href="/pharmacies">Farmacitë në hartë</Link></li>
            <li><Link className="hover:text-foreground" href="/dashboard/alerts">Alarmet e disponueshmërisë</Link></li>
          </ul>
        </div>
        <div className="space-y-2 text-sm">
          <h2 className="font-semibold">Për farmacitë</h2>
          <ul className="space-y-1.5 text-muted-foreground">
            <li><Link className="hover:text-foreground" href="/register?type=pharmacy">Regjistro farmacinë</Link></li>
            <li><Link className="hover:text-foreground" href="/login">Kyçu në panel</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t py-4 text-center text-xs text-muted-foreground">
        Hartat © kontribuesit e <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>
      </div>
    </footer>
  );
}
