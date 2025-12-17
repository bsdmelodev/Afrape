"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export const dynamic = "force-dynamic";

export default function NotFound() {
  const router = useRouter();

  // Redireciona após 5 segundos no cliente
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push("/dashboard");
    }, 5000);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-muted/40 px-6 text-center">
      <div>
        <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
          404
        </p>
        <h1 className="text-3xl font-semibold">Página não encontrada</h1>
        <p className="text-muted-foreground">
          Você será redirecionado em 5 segundos. Ou clique abaixo para voltar.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground shadow-sm transition hover:brightness-110"
      >
        Ir para o dashboard
      </Link>
    </div>
  );
}
