"use client"; // Los error boundaries deben ser Client Components

import { useEffect } from "react";

import { Button } from "@/components/ui/Button";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="eyebrow !text-f1red-bright">Bandera roja</p>
      <h1 className="font-wide text-2xl uppercase">Algo ha fallado</h1>
      <p className="max-w-md text-sm text-ink-3">
        La aplicación ha encontrado un error inesperado. Puedes reintentarlo; si persiste, recarga
        la página.
      </p>
      <Button variant="primary" onClick={() => unstable_retry()}>
        Reintentar
      </Button>
    </main>
  );
}
