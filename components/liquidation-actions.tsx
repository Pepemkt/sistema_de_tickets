"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type LiquidationStatus = "DRAFT" | "FINALIZED" | "SETTLED" | "CANCELLED";

type CreateProps = {
  mode: "create";
  eventId: string;
  disabled?: boolean;
  disabledReason?: string;
};

type TransitionProps = {
  mode: "transition";
  liquidationId: string;
  current: LiquidationStatus;
  viewerRole: "ADMIN" | "MANAGER";
};

type Props = CreateProps | TransitionProps;

const transitionLabels: Record<LiquidationStatus, string> = {
  DRAFT: "Borrador",
  FINALIZED: "Finalizada",
  SETTLED: "Liquidada",
  CANCELLED: "Cancelada"
};

const allowed: Record<LiquidationStatus, LiquidationStatus[]> = {
  DRAFT: ["FINALIZED", "CANCELLED"],
  FINALIZED: ["SETTLED", "CANCELLED"],
  SETTLED: [],
  CANCELLED: []
};

export function LiquidationActions(props: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (props.mode !== "create") return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/${props.eventId}/liquidation`, { method: "POST" });
      const data = (await res.json()) as { error?: string; liquidationId?: string };
      if (!res.ok) {
        setError(data.error ?? "No se pudo crear");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleTransition(next: LiquidationStatus) {
    if (props.mode !== "transition") return;
    if (next === "SETTLED" && props.viewerRole !== "ADMIN") {
      setError("Solo ADMIN puede marcar como liquidada");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/liquidations/${props.liquidationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next })
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "No se pudo actualizar");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (props.mode === "create") {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={handleCreate}
          disabled={busy || props.disabled}
          className="btn-primary disabled:opacity-60"
        >
          {busy ? "Creando..." : "Crear liquidacion (DRAFT)"}
        </button>
        {props.disabled && props.disabledReason ? <p className="text-caption text-secondary">{props.disabledReason}</p> : null}
        {error ? <p className="text-caption text-danger-700">{error}</p> : null}
      </div>
    );
  }

  const nextStates = allowed[props.current];
  if (nextStates.length === 0) {
    return <p className="text-caption text-secondary">Sin transiciones disponibles</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {nextStates.map((state) => {
          const blocked = state === "SETTLED" && props.viewerRole !== "ADMIN";
          return (
            <button
              key={state}
              type="button"
              onClick={() => handleTransition(state)}
              disabled={busy || blocked}
              className={
                state === "CANCELLED"
                  ? "rounded-sm border border-danger-500 bg-surface px-3 py-1.5 text-caption font-semibold text-danger-700 transition-colors duration-base ease-tactile hover:bg-danger-50 focus-visible:outline-none focus-visible:shadow-focus disabled:opacity-60"
                  : "rounded-sm bg-forest-600 px-3 py-1.5 text-caption font-semibold text-onprimary transition-colors duration-base ease-tactile hover:bg-forest-700 focus-visible:outline-none focus-visible:shadow-focus disabled:opacity-60"
              }
              title={blocked ? "Solo ADMIN" : undefined}
            >
              {busy ? "..." : `Marcar ${transitionLabels[state]}`}
            </button>
          );
        })}
      </div>
      {error ? <p className="text-caption text-danger-700">{error}</p> : null}
    </div>
  );
}
