"use client";

import { Loader2, type LucideIcon, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import { homeFor, useAuth } from "@/components/auth-provider";
import { EmptyState } from "@/components/common/states";
import { HeaderFallback } from "@/components/layout/header-fallback";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import type { CurrentUser, Role } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: Role[];
  exact?: boolean;
}

/**
 * Authenticated area layout. Role checks here only decide what is rendered;
 * the API independently rejects anything the account is not allowed to do.
 */
export function AppShell(props: AppShellProps) {
  return (
    <>
      <Suspense fallback={<HeaderFallback />}>
        <SiteHeader />
      </Suspense>
      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center text-muted-foreground" aria-busy="true">
            <Loader2 className="size-6 animate-spin" aria-label="Duke u ngarkuar" />
          </div>
        }
      >
        <ShellBody {...props} />
      </Suspense>
    </>
  );
}

interface AppShellProps {
  nav: NavItem[];
  allow: Role[];
  title: string;
  aside?: (user: CurrentUser) => React.ReactNode;
  children: React.ReactNode;
}

function ShellBody({
  nav,
  allow,
  title,
  aside,
  children,
}: AppShellProps) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [loading, user, pathname, router]);

  const items = user ? nav.filter((n) => !n.roles || n.roles.includes(user.role)) : [];

  return (
    <>
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:flex-row">
        {user && allow.includes(user.role) ? (
          <aside className="md:w-56 md:shrink-0">
            <p className="mb-2 hidden px-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase md:block">{title}</p>
            {aside?.(user)}
            <nav aria-label={title} className="-mx-1 flex gap-1 overflow-x-auto pb-1 md:mx-0 md:flex-col md:overflow-visible">
              {items.map((item) => {
                const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                      active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <item.icon className="size-4" aria-hidden />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        ) : null}
        <main id="main" className="min-w-0 flex-1">
          {loading || !user ? (
            <div className="flex h-64 items-center justify-center text-muted-foreground" aria-busy="true">
              <Loader2 className="size-6 animate-spin" aria-label="Duke u ngarkuar" />
            </div>
          ) : !allow.includes(user.role) ? (
            <EmptyState
              icon={ShieldAlert}
              title="Nuk keni qasje në këtë faqe"
              description="Kjo pjesë është vetëm për llogaritë me rolin përkatës."
              action={
                <Button asChild>
                  <Link href={homeFor(user)}>Shko te paneli juaj</Link>
                </Button>
              }
            />
          ) : (
            children
          )}
        </main>
      </div>
    </>
  );
}
