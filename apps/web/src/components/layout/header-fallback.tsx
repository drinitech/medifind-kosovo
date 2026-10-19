import { Logo } from "./logo";

/** Static header shown while URL-dependent header state streams in. */
export function HeaderFallback() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Logo />
      </div>
    </header>
  );
}
