"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function resolveSafeNextPath(next: string | null) {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//")) {
    return null;
  }
  return next;
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "No se pudo iniciar sesion");
      return;
    }

    const next = resolveSafeNextPath(params.get("next"));
    router.push(next ?? (data.user.role === "ADMIN" ? "/admin" : data.user.role === "SELLER" ? "/sales" : "/scan"));
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label">Usuario</label>
        <input
          className="field"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="admin"
          required
        />
      </div>

      <div>
        <label className="label">Contrasena</label>
        <input
          className="field"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="********"
          required
        />
      </div>

      <button className="btn-primary w-full" disabled={loading}>
        {loading ? "Ingresando..." : "Iniciar sesion"}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <p className="text-xs text-slate-500">
        Credenciales demo (seed): admin/admin1234, seller/seller1234 y scanner/scanner1234.
      </p>
    </form>
  );
}
