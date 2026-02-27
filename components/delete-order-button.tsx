"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  orderId: string;
  hasAttendedTickets: boolean;
};

async function readJsonSafe(response: Response) {
  const raw = await response.text();
  if (!raw) return {};

  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { error: raw };
  }
}

export function DeleteOrderButton({ orderId, hasAttendedTickets }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onDelete() {
    if (hasAttendedTickets) {
      window.alert("No puedes eliminar una orden con tickets ya validados en acceso");
      return;
    }

    const confirmed = window.confirm("Esta accion eliminara la orden y sus tickets emitidos. Deseas continuar?");
    if (!confirmed) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "DELETE"
      });

      const data = await readJsonSafe(res);
      if (!res.ok) {
        const errorText = typeof data.error === "string" ? data.error : "No se pudo eliminar la orden";
        window.alert(errorText);
        return;
      }

      router.refresh();
    } catch {
      window.alert("No se pudo conectar con el servidor");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onDelete()}
      disabled={loading || hasAttendedTickets}
      className="inline-flex items-center rounded-xl border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
      title={hasAttendedTickets ? "Tiene tickets validados en acceso" : "Eliminar orden"}
    >
      {loading ? "Eliminando..." : "Eliminar"}
    </button>
  );
}
