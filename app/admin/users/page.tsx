"use client";

import { FormEvent, useEffect, useState } from "react";

type UserItem = {
  id: string;
  username: string;
  displayName: string | null;
  role: "ADMIN" | "MANAGER" | "SELLER" | "SCANNER";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  managedEventIds: string[];
  _count?: { sessions: number };
};

type EventItem = {
  id: string;
  name: string;
  startsAt: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ADMIN" | "MANAGER" | "SELLER" | "SCANNER">("SCANNER");
  const [managedEventIds, setManagedEventIds] = useState<string[]>([]);

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
    setEvents(Array.isArray(data.events) ? (data.events as EventItem[]) : []);
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
        role,
        managedEventIds: role === "MANAGER" ? managedEventIds : []
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
    setManagedEventIds([]);
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

  async function setUserManagedEvents(user: UserItem, nextEventIds: string[]) {
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ managedEventIds: nextEventIds })
    });

    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "No se pudieron actualizar eventos asignados");
      return;
    }

    setMessage(`Eventos actualizados para ${user.username}`);
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
        <p className="muted mt-1">Admin tiene acceso total. Manager administra eventos asignados. Seller opera ventas/cupones y scanner valida accesos.</p>

        <form onSubmit={createUser} className="mt-5 grid gap-3 md:grid-cols-6">
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
          <select className="field" value={role} onChange={(event) => setRole(event.target.value as "ADMIN" | "MANAGER" | "SELLER" | "SCANNER")}>
            <option value="SCANNER">SCANNER</option>
            <option value="SELLER">SELLER</option>
            <option value="MANAGER">MANAGER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
          <div className="md:col-span-2">
            {role === "MANAGER" ? (
              <select
                className="field h-24"
                multiple
                value={managedEventIds}
                onChange={(event) => {
                  const values = Array.from(event.currentTarget.selectedOptions).map((option) => option.value);
                  setManagedEventIds(values);
                }}
              >
                {events.map((eventItem) => (
                  <option key={eventItem.id} value={eventItem.id}>
                    {eventItem.name} ({new Date(eventItem.startsAt).toLocaleDateString("es-AR")})
                  </option>
                ))}
              </select>
            ) : (
              <p className="mt-2 text-xs text-slate-500">Asignacion de eventos aplica solo para MANAGER.</p>
            )}
          </div>
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
                      <p className="text-sm font-medium text-slate-700">{user.role}</p>
                      {user.role === "MANAGER" && (
                        <div className="mt-2">
                          <select
                            className="field h-20 py-1 text-xs"
                            multiple
                            value={user.managedEventIds}
                            onChange={(event) => {
                              const values = Array.from(event.currentTarget.selectedOptions).map((option) => option.value);
                              void setUserManagedEvents(user, values);
                            }}
                          >
                            {events.map((eventItem) => (
                              <option key={eventItem.id} value={eventItem.id}>
                                {eventItem.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
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
