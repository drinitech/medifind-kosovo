import type { Metadata } from "next";
import { Suspense } from "react";
import { RegisterForm } from "@/components/auth/auth-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Regjistrohu" };

export default function RegisterPage() {
  return (
    <div className="mx-auto flex max-w-lg flex-col px-4 py-12 md:py-16">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Krijoni llogarinë</CardTitle>
          <CardDescription>Kërkimi i barnave nuk kërkon llogari — ajo duhet vetëm për alarme dhe për farmacitë.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <RegisterForm />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
