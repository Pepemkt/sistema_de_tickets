"use client";

import { FormEvent, useEffect, useState } from "react";

type UserItem = {
  id: string;
  username: string;
  displayName: string | null;
  role: "ADMIN" | "SELLER" | "SCANNER";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { sessions: number };
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ADMIN" | "SELLER" | "SCANNER">("SCANNER");

  async function loadUsers() {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setMessage(data.error ?? "No se pudieron cargar usuarios");
      return;
    }

    setUsers(data.users);
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username,
        displayName,
        password,
        role
      })
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setMessage(data.error ?? "No se pudo crear usuario");
      return;
    }

    setUsername("");
    setDisplayName("");
    setPassword("");
    setRole("SCANNER");
    setMessage("Usuario creado");
    void loadUsers();
  }

  async function toggleActive(user: UserItem) {
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !user.isActive })
    });

    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "No se pudo actualizar usuario");
      return;
    }

    setMessage(`Usuario ${user.username} actualizado`);
    void loadUsers();
  }

  async function setUserRole(user: UserItem, nextRole: "ADMIN" | "SELLER" | "SCANNER") {
    if (user.role === nextRole) return;
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: nextRole })
    });

    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "No se pudo cambiar rol");
      return;
    }

    setMessage(`Rol actualizado para ${user.username}`);
    void loadUsers();
  }

  async function resetPassword(user: UserItem) {
    const nextPassword = prompt(`Nueva contrasena para ${user.username} (min 6 caracteres)`);
    if (!nextPassword) return;

    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: nextPassword })
    });

    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "No se pudo cambiar password");
      return;
    }

    setMessage(`Password actualizado para ${user.username}`);
  }

  return (
    <div className="space-y-6">
      <section className="panel p-6">
        <h2 className="section-title">Usuarios y roles</h2>
        <p className="muted mt-1">Admin tiene acceso total. Seller opera ventas/cupones y scanner valida accesos.</p>

        <form onSubmit={createUser} className="mt-5 grid gap-3 md:grid-cols-5">
          <input className="field" placeholder="usuario" value={username} onChange={(event) => setUsername(event.target.value)} required />
          <input className="field" placeholder="nombre visible" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
          <input
            className="field"
            type="password"
            placeholder="contrasena"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <select className="field" value={role} onChange={(event) => setRole(event.target.value as "ADMIN" | "SELLER" | "SCANNER")}>
            <option value="SCANNER">SCANNER</option>
            <option value="SELLER">SELLER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
          <button className="btn-primary" disabled={saving}>
            {saving ? "Guardando..." : "Crear usuario"}
          </button>
        </form>
      </section>

      <section className="panel p-6">
        <h3 className="text-lg font-semibold text-slate-900">Listado</h3>

        {loading ? (
          <p className="muted mt-4">Cargando usuarios...</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="pb-2 pr-3">Usuario</th>
                  <th className="pb-2 pr-3">Rol</th>
                  <th className="pb-2 pr-3">Estado</th>
                  <th className="pb-2 pr-3">Sesiones</th>
                  <th className="pb-2 pr-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-slate-100">
                    <td className="py-3 pr-3">
                      <p className="font-medium text-slate-800">{user.username}</p>
                      <p className="text-xs text-slate-500">{user.displayName ?? "Sin nombre"}</p>
                    </td>
                    <td className="py-3 pr-3">
                      <select
                        className="field h-9 py-1 text-sm"
                        value={user.role}
                        onChange={(event) => void setUserRole(user, event.target.value as "ADMIN" | "SELLER" | "SCANNER")}
                      >
                        <option value="SCANNER">SCANNER</option>
                        <option value="SELLER">SELLER</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </td>
                    <td className="py-3 pr-3">{user.isActive ? "Activo" : "Inactivo"}</td>
                    <td className="py-3 pr-3">{user._count?.sessions ?? 0}</td>
                    <td className="py-3 pr-3">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="btn-secondary" onClick={() => void toggleActive(user)}>
                          {user.isActive ? "Desactivar" : "Activar"}
                        </button>
                        <button type="button" className="btn-secondary" onClick={() => void resetPassword(user)}>
                          Password
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {message && <p className="mt-4 text-sm text-slate-600">{message}</p>}
      </section>
    </div>
  );
}
