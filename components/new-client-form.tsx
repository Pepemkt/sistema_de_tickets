"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function NewClientForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() })
      });
      const data = (await res.json()) as { error?: string; client?: { id: string } };
      if (!res.ok) {
        setError(data.error ?? "No se pudo crear el cliente");
        return;
      }
      const id = data.client?.id;
      if (id) {
        router.push(`/admin/clients/${id}/merchant`);
      } else {
        router.push("/admin/clients");
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="panel space-y-4 p-6">
      <div>
        <label className="block text-sm font-medium text-slate-700">Nombre del cliente</label>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          minLength={2}
          maxLength={120}
          placeholder="Ej: Productora X"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={saving || name.trim().length < 2} className="btn-primary disabled:opacity-60">
          {saving ? "Creando..." : "Crear cliente"}
        </button>
      </div>
    </form>
  );
}
