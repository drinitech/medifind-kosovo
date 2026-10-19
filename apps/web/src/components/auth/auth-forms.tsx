"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Loader2, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { homeFor, useAuth } from "@/components/auth-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

/** Only same-site relative paths are accepted as post-login redirects (no open redirects). */
export function safeNext(next: string | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}

const loginSchema = z.object({
  email: z.string().trim().email("Shkruani një email të vlefshëm"),
  password: z.string().min(1, "Shkruani fjalëkalimin"),
});

export function LoginForm() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof loginSchema>>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  useEffect(() => {
    if (!loading && user) router.replace(next ?? homeFor(user));
  }, [loading, user, next, router]);

  async function onSubmit(values: z.infer<typeof loginSchema>) {
    setError(null);
    try {
      const me = await login(values.email, values.password);
      if (me) router.replace(next ?? homeFor(me));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const { errors, isSubmitting } = form.formState;
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Field label="Email" id="email" error={errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" className="h-10" aria-invalid={!!errors.email} {...form.register("email")} />
      </Field>
      <Field label="Fjalëkalimi" id="password" error={errors.password?.message}>
        <Input id="password" type="password" autoComplete="current-password" className="h-10" aria-invalid={!!errors.password} {...form.register("password")} />
      </Field>
      <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Kyçu
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Nuk keni llogari?{" "}
        <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-primary hover:underline">
          Regjistrohuni
        </Link>
      </p>
    </form>
  );
}

const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, "Shkruani emrin e plotë").max(100),
    email: z.string().trim().email("Shkruani një email të vlefshëm"),
    password: z
      .string()
      .min(8, "Të paktën 8 karaktere")
      .max(128)
      .regex(/(?=.*[A-Za-z])(?=.*\d)/, "Duhet të ketë të paktën një shkronjë dhe një numër"),
    confirm: z.string(),
    accountType: z.enum(["USER", "PHARMACY"]),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Fjalëkalimet nuk përputhen" });

export function RegisterForm() {
  const { register: registerAccount } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [error, setError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirm: "",
      accountType: params.get("type") === "pharmacy" ? "PHARMACY" : "USER",
    },
  });
  const accountType = form.watch("accountType");

  async function onSubmit({ fullName, email, password, accountType }: z.infer<typeof registerSchema>) {
    setError(null);
    try {
      const me = await registerAccount({ fullName, email, password, accountType });
      if (me) router.replace(me.role === "PHARMACY_MANAGER" ? "/dashboard" : (next ?? homeFor(me)));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const { errors, isSubmitting } = form.formState;
  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <fieldset className="grid grid-cols-2 gap-3">
        <legend className="mb-2 text-sm font-medium">Lloji i llogarisë</legend>
        {(
          [
            { value: "USER", icon: UserRound, title: "Përdorues", text: "Kërkoni barna dhe krijoni alarme" },
            { value: "PHARMACY", icon: Building2, title: "Farmaci", text: "Menaxhoni inventarin e farmacisë" },
          ] as const
        ).map((o) => (
          <label
            key={o.value}
            className={cn(
              "flex cursor-pointer flex-col gap-1 rounded-xl border p-3 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
              accountType === o.value ? "border-primary bg-accent text-accent-foreground" : "hover:bg-muted",
            )}
          >
            <input type="radio" value={o.value} className="sr-only" {...form.register("accountType")} />
            <o.icon className="size-5" aria-hidden />
            <span className="font-medium">{o.title}</span>
            <span className="text-xs text-muted-foreground">{o.text}</span>
          </label>
        ))}
      </fieldset>
      {error ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Field label="Emri i plotë" id="fullName" error={errors.fullName?.message}>
        <Input id="fullName" autoComplete="name" className="h-10" aria-invalid={!!errors.fullName} {...form.register("fullName")} />
      </Field>
      <Field label="Email" id="reg-email" error={errors.email?.message}>
        <Input id="reg-email" type="email" autoComplete="email" className="h-10" aria-invalid={!!errors.email} {...form.register("email")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fjalëkalimi" id="reg-password" error={errors.password?.message}>
          <Input id="reg-password" type="password" autoComplete="new-password" className="h-10" aria-invalid={!!errors.password} {...form.register("password")} />
        </Field>
        <Field label="Përsëritni fjalëkalimin" id="reg-confirm" error={errors.confirm?.message}>
          <Input id="reg-confirm" type="password" autoComplete="new-password" className="h-10" aria-invalid={!!errors.confirm} {...form.register("confirm")} />
        </Field>
      </div>
      {accountType === "PHARMACY" ? (
        <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          Pas regjistrimit do të plotësoni profilin e farmacisë. Farmacia shfaqet publikisht vetëm pasi të verifikohet nga
          administratori.
        </p>
      ) : null}
      <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>
        {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Krijo llogarinë
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Ruajmë vetëm emrin, email-in dhe alarmet që krijoni. Nuk ruajmë historikun e kërkimeve.
      </p>
      <p className="text-center text-sm text-muted-foreground">
        Keni llogari?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Kyçuni
        </Link>
      </p>
    </form>
  );
}

function Field({ label, id, error, children }: { label: string; id: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
