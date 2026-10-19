"use client";

import { Bell, LayoutDashboard, LogOut, Menu, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { homeFor, useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ROLE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

const NAV = [
  { href: "/", label: "Kërko barna" },
  { href: "/pharmacies", label: "Farmacitë" },
  { href: "/#per-farmacite", label: "Për farmacitë" },
];

export function SiteHeader() {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    await logout();
    setOpen(false);
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Logo />
        <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="Navigimi kryesor">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                pathname === item.href && "text-foreground",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {loading ? null : user ? (
            <>
              <Button variant="ghost" size="icon-lg" asChild>
                <Link href="/dashboard/alerts" aria-label={`Njoftimet${user.unreadNotifications ? ` (${user.unreadNotifications} të palexuara)` : ""}`} className="relative">
                  <Bell />
                  {user.unreadNotifications > 0 ? (
                    <span className="absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                      {user.unreadNotifications > 9 ? "9+" : user.unreadNotifications}
                    </span>
                  ) : null}
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="hidden h-9 gap-2 md:inline-flex">
                    <UserRound aria-hidden />
                    <span className="max-w-32 truncate">{user.fullName}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="font-normal">
                      <div className="truncate font-medium">{user.fullName}</div>
                      <div className="truncate text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</div>
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    {user.role === "ADMIN" ? (
                      <DropdownMenuItem asChild>
                        <Link href="/admin">
                          <ShieldCheck /> Paneli i administratorit
                        </Link>
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem asChild>
                      <Link href={user.role === "USER" ? "/dashboard/alerts" : "/dashboard"}>
                        <LayoutDashboard /> {user.role === "USER" ? "Alarmet e mia" : "Paneli i farmacisë"}
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleLogout}>
                    <LogOut /> Dil
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Button variant="ghost" className="h-9" asChild>
                <Link href={`/login${pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : ""}`}>Kyçu</Link>
              </Button>
              <Button className="h-9" asChild>
                <Link href="/register">Regjistrohu</Link>
              </Button>
            </div>
          )}

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon-lg" className="md:hidden" aria-label="Hap menynë">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle>Menyja</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-4" aria-label="Navigimi në celular">
                {NAV.map((item) => (
                  <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className="rounded-md px-3 py-2.5 font-medium hover:bg-accent">
                    {item.label}
                  </Link>
                ))}
                <div className="my-2 border-t" />
                {user ? (
                  <>
                    <Link href={homeFor(user)} onClick={() => setOpen(false)} className="rounded-md px-3 py-2.5 font-medium hover:bg-accent">
                      {user.role === "ADMIN" ? "Paneli i administratorit" : user.role === "USER" ? "Alarmet e mia" : "Paneli i farmacisë"}
                    </Link>
                    <button type="button" onClick={handleLogout} className="rounded-md px-3 py-2.5 text-left font-medium hover:bg-accent">
                      Dil
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/login" onClick={() => setOpen(false)} className="rounded-md px-3 py-2.5 font-medium hover:bg-accent">
                      Kyçu
                    </Link>
                    <Link href="/register" onClick={() => setOpen(false)} className="rounded-md px-3 py-2.5 font-medium hover:bg-accent">
                      Regjistrohu
                    </Link>
                  </>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
