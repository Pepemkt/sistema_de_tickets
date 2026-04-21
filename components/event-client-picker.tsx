"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type ClientOption = { id: string; name: string };

type Props = {
  eventId: string;
  currentClientId: string | null;
  currentClientName: string | null;
  clients: ClientOption[];
};

export function EventClientPicker({ eventId, currentClientId, currentClientName, clients }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<string>(currentClientId ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/client`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: selected || null })
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "No se pudo asignar el cliente");
        return;
      }
      setMessage("Cliente actualizado");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1">
          <label className="text-overline font-semibold uppercase tracking-wide text-muted">Cliente asignado</label>
          <select
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            className="field mt-1"
          >
            <option value="">Sin cliente (flujo global)</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={saving || selected === (currentClientId ?? "")}
          className="btn-primary disabled:opacity-60"
        >
          {saving ? "Guardando..." : "Guardar cliente"}
        </button>
        <Link href="/admin/clients/new" className="btn-secondary">
          Nuevo cliente
        </Link>
      </div>
      {currentClientName ? <p className="text-caption text-muted">Cliente actual: {currentClientName}</p> : null}
      {message ? <p className="text-caption text-success-700">{message}</p> : null}
      {error ? <p className="text-caption text-danger-500">{error}</p> : null}
    </form>
  );
}
