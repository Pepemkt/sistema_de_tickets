"use client";

import { useEffect } from "react";
import { StateIllustration } from "@/components/ui/state-illustration";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 py-hero">
      <StateIllustration variant="error" size={200} />
      <h1 className="font-display text-title-xl text-primary">
        Se rompió algo de nuestro lado
      </h1>
      <p className="max-w-md text-center text-body text-secondary">
        No te preocupes, ya lo estamos viendo. Probá de nuevo o volvé al inicio.
      </p>
      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={reset}>
          Reintentar
        </button>
        <a className="btn-secondary" href="/">
          Volver al inicio
        </a>
      </div>
      {process.env.NODE_ENV === "development" && (
        <details className="mt-4 max-w-xl w-full">
          <summary className="cursor-pointer text-label text-secondary">
            Detalle del error
          </summary>
          <pre className="muted mt-2 overflow-auto rounded-sm p-3 text-caption">
            {error.message}
          </pre>
        </details>
      )}
    </div>
  );
}
