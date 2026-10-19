import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect width="32" height="32" rx="9" className="fill-primary" />
      <path d="M13 8h6v5h5v6h-5v5h-6v-5H8v-6h5z" className="fill-primary-foreground" />
      <circle cx="23.5" cy="23.5" r="4.5" className="fill-primary-foreground" />
      <path d="M26.6 26.6 29 29" className="stroke-primary-foreground" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="23.5" cy="23.5" r="2.6" className="fill-primary" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2 rounded-md font-semibold", className)} aria-label="MediFind Kosovo — faqja kryesore">
      <LogoMark />
      <span className="text-lg leading-none">
        Medi<span className="text-primary">Find</span>
        <span className="ml-1 text-sm font-medium text-muted-foreground">Kosovo</span>
      </span>
    </Link>
  );
}
