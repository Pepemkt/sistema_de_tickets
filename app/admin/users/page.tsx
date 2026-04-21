"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

/* ─────────────────────────────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────────────── */
function roleSupportsEventAssignments(role: "ADMIN" | "MANAGER" | "SELLER" | "SCANNER") {
  return role === "MANAGER" || role === "SELLER" || role === "SCANNER";
}

function getInitials(displayName: string | null, username: string): string {
  const name = displayName ?? username;
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

const ROLE_META: Record<
  "ADMIN" | "MANAGER" | "SELLER" | "SCANNER",
  { label: string; pill: string; desc: string }
> = {
  ADMIN: {
    label: "Admin",
    pill: "bg-[#EDE9FE] text-[#4C1D95] border-[#C4B5FD]/50",
    desc: "Acceso total al sistema",
  },
  MANAGER: {
    label: "Manager",
    pill: "bg-[#FFF1F8] text-[#9D1558] border-[#F9A8D4]/50",
    desc: "Gestión de eventos asignados",
  },
  SELLER: {
    label: "Seller",
    pill: "bg-[#FFF4E0] text-[#9B5F17] border-[#FCD34D]/40",
    desc: "Venta en eventos asignados",
  },
  SCANNER: {
    label: "Scanner",
    pill: "bg-[#E9F9EE] text-[#117A30] border-[#6EE7B7]/40",
    desc: "Escaneo de tickets",
  },
};

const AVATAR_GRADIENTS = [
  "from-[#4C1D95] to-[#7C3AED]",
  "from-[#DB1E7A] to-[#F472B6]",
  "from-[#1E40AF] to-[#60A5FA]",
  "from-[#065F46] to-[#34D399]",
  "from-[#7C2D12] to-[#F97316]",
  "from-[#1E3A5F] to-[#38BDF8]",
  "from-[#6D28D9] to-[#EC4899]",
];

/* ─────────────────────────────────────────────────────────────────────────────
   PAGE STYLES
───────────────────────────────────────────────────────────────────────────── */
const PAGE_STYLES = `
@keyframes usr-fade-up {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes usr-row-in {
  from { opacity: 0; transform: translateX(-4px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes usr-dot-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.55; transform: scale(0.8); }
}
@keyframes usr-msg-in {
  from { opacity: 0; transform: translateY(-8px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

.usr-hero    { animation: usr-fade-up 0.48s var(--ease-tactile) 0.02s both; }
.usr-chips   { animation: usr-fade-up 0.48s var(--ease-tactile) 0.08s both; }
.usr-form    { animation: usr-fade-up 0.48s var(--ease-tactile) 0.14s both; }
.usr-table   { animation: usr-fade-up 0.48s var(--ease-tactile) 0.20s both; }

/* Table row */
.usr-tr { transition: background-color 0.10s ease; cursor: default; }
.usr-tr:hover { background-color: var(--bg-sunken); }

/* Row stagger */
.usr-row { animation: usr-row-in 0.34s var(--ease-tactile) both; }
.usr-row:nth-child(1)  { animation-delay: 0.22s; }
.usr-row:nth-child(2)  { animation-delay: 0.25s; }
.usr-row:nth-child(3)  { animation-delay: 0.28s; }
.usr-row:nth-child(4)  { animation-delay: 0.31s; }
.usr-row:nth-child(5)  { animation-delay: 0.34s; }
.usr-row:nth-child(6)  { animation-delay: 0.37s; }
.usr-row:nth-child(7)  { animation-delay: 0.40s; }
.usr-row:nth-child(8)  { animation-delay: 0.43s; }

/* Pulse dot */
.usr-dot-active { animation: usr-dot-pulse 2s ease-in-out infinite; }

/* Monogram avatar */
.usr-monogram {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 800;
  font-family: var(--font-display);
  color: #fff;
  letter-spacing: -0.01em;
  user-select: none;
}

/* KPI chip strip */
.usr-chip {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 8px 14px;
  border-right: 1px solid var(--border-soft);
  min-width: 80px;
}
.usr-chip:last-child { border-right: none; }

/* Icon-only action buttons */
.usr-action-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  text-decoration: none;
  transition: background-color 0.12s ease, color 0.12s ease;
  flex-shrink: 0;
}
.usr-action-btn:hover {
  background-color: var(--bg-sunken);
  color: var(--text-primary);
}
.usr-action-btn::after {
  content: attr(data-tip);
  position: absolute;
  bottom: calc(100% + 5px);
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  background: var(--clr-arena-700);
  color: var(--clr-white);
  font-family: var(--font-body);
  font-size: 11px;
  font-weight: 500;
  padding: 3px 7px;
  border-radius: 5px;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.14s ease;
  z-index: 10;
}
.usr-action-btn:hover::after { opacity: 1; }

/* Role segmented control */
.usr-role-option {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 8px 6px 7px;
  border-radius: 8px;
  border: 1.5px solid var(--border-soft);
  background: var(--bg-surface);
  cursor: pointer;
  transition: border-color 0.14s ease, background 0.14s ease;
  user-select: none;
}
.usr-role-option:hover:not(.usr-role-selected) {
  border-color: var(--border-strong);
  background: var(--bg-sunken);
}
.usr-role-selected {
  border-color: var(--border-focus) !important;
  background: var(--clr-forest-50) !important;
  box-shadow: 0 0 0 3px rgba(91,33,182,0.12);
}

/* Message banner */
.usr-msg { animation: usr-msg-in 0.32s var(--ease-spring) both; }

/* Event multi-select */
.usr-event-select {
  width: 100%;
  min-height: 80px;
  padding: 6px;
  border-radius: 8px;
  border: 1px solid var(--border-soft);
  background: var(--bg-sunken);
  color: var(--text-primary);
  font-size: 12px;
  font-family: var(--font-body);
  outline: none;
  transition: border-color 0.15s ease;
  cursor: pointer;
}
.usr-event-select:focus {
  border-color: var(--border-focus);
  box-shadow: var(--shadow-focus);
}
.usr-event-select option:checked {
  background: var(--clr-forest-100);
  color: var(--clr-forest-800);
}

/* Inline event expander */
.usr-expand-row {
  background: var(--bg-sunken);
  border-top: 1px solid var(--border-soft);
}

/* Section divider label */
.usr-section-label {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--text-muted);
  margin-bottom: 12px;
}
.usr-section-label::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border-soft);
}
`;

/* ─────────────────────────────────────────────────────────────────────────────
   PAGE
───────────────────────────────────────────────────────────────────────────── */
export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"ADMIN" | "MANAGER" | "SELLER" | "SCANNER">("SCANNER");
  const [managedEventIds, setManagedEventIds] = useState<string[]>([]);

  // The invite form is always shown; the API itself guards role access.

  async function loadUsers() {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setMessageType("error");
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
        managedEventIds: roleSupportsEventAssignments(role) ? managedEventIds : [],
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setMessageType("error");
      setMessage(data.error ?? "No se pudo crear usuario");
      return;
    }

    setUsername("");
    setDisplayName("");
    setPassword("");
    setRole("SCANNER");
    setManagedEventIds([]);
    setMessageType("success");
    setMessage("Usuario creado correctamente");
    void loadUsers();
  }

  async function toggleActive(user: UserItem) {
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !user.isActive }),
    });

    const data = await res.json();
    if (!res.ok) {
      setMessageType("error");
      setMessage(data.error ?? "No se pudo actualizar usuario");
      return;
    }

    setMessageType("success");
    setMessage(`Usuario ${user.username} ${!user.isActive ? "activado" : "desactivado"}`);
    void loadUsers();
  }

  async function setUserManagedEvents(user: UserItem, nextEventIds: string[]) {
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ managedEventIds: nextEventIds }),
    });

    const data = await res.json();
    if (!res.ok) {
      setMessageType("error");
      setMessage(data.error ?? "No se pudieron actualizar eventos asignados");
      return;
    }

    setMessageType("success");
    setMessage(`Eventos actualizados para ${user.username}`);
    void loadUsers();
  }

  async function resetPassword(user: UserItem) {
    const nextPassword = prompt(`Nueva contrasena para ${user.username} (min 6 caracteres)`);
    if (!nextPassword) return;

    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: nextPassword }),
    });

    const data = await res.json();
    if (!res.ok) {
      setMessageType("error");
      setMessage(data.error ?? "No se pudo cambiar password");
      return;
    }

    setMessageType("success");
    setMessage(`Password actualizado para ${user.username}`);
  }

  const activeCount  = users.filter((u) => u.isActive).length;
  const adminCount   = users.filter((u) => u.role === "ADMIN").length;
  const managerCount = users.filter((u) => u.role === "MANAGER").length;
  const sellerCount  = users.filter((u) => u.role === "SELLER").length;
  const scannerCount = users.filter((u) => u.role === "SCANNER").length;

  const chips = [
    { label: "Total",    value: users.length,  color: "text-primary" },
    { label: "Activos",  value: activeCount,   color: "text-[color:var(--clr-success-700)]" },
    { label: "Admin",    value: adminCount,    color: "text-[color:var(--brand-violet)]" },
    { label: "Manager",  value: managerCount,  color: "text-[color:var(--brand-magenta)]" },
    { label: "Seller",   value: sellerCount,   color: "text-warning-700" },
    { label: "Scanner",  value: scannerCount,  color: "text-[color:var(--clr-success-700)]" },
  ];

  return (
    <>
      <style>{PAGE_STYLES}</style>

      <div className="space-y-0">

        {/* ── HERO BAR ── bare div, 1px border-bottom ── */}
        <div
          className="usr-hero flex flex-wrap items-start justify-between gap-4 pb-5"
          style={{ borderBottom: "1px solid var(--border-soft)" }}
        >
          <div>
            <p
              className="text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{ color: "var(--brand-violet)" }}
            >
              SEGURIDAD
            </p>
            <h1 className="mt-1 font-display text-[1.625rem] font-extrabold leading-tight tracking-tight text-primary">
              Usuarios &amp; roles<span style={{ color: "var(--brand-magenta)" }}>.</span>
            </h1>
            <p className="mt-1 text-[12px] text-secondary">
              ADMIN tiene acceso global. Manager, Seller y Scanner operan sobre los eventos asignados.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => document.getElementById("invite-form")?.scrollIntoView({ behavior: "smooth" })}
              className="inline-flex items-center gap-1.5 rounded-[7px] px-3.5 py-[6px] text-[12px] font-semibold text-white transition-opacity duration-[120ms] hover:opacity-90"
              style={{ background: "var(--grad-hero)" }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Invitar usuario
            </button>
          </div>
        </div>

        {/* ── KPI CHIP STRIP ── */}
        <div
          className="usr-chips flex flex-wrap items-stretch"
          style={{ borderBottom: "1px solid var(--border-soft)" }}
          aria-label="Resumen de usuarios"
        >
          {chips.map((chip) => (
            <div key={chip.label} className="usr-chip">
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-secondary">
                {chip.label}
              </span>
              <span
                className={`mt-0.5 font-display text-[1.25rem] font-extrabold leading-none tracking-tight ${chip.color}`}
              >
                {chip.value}
              </span>
            </div>
          ))}
        </div>

        {/* ── MESSAGE BANNER ── */}
        {message && (
          <div
            className="usr-msg flex items-center gap-2.5 border-b px-4 py-2.5"
            style={{
              background: messageType === "success" ? "var(--clr-success-50)" : "#FEE8EC",
              borderColor: messageType === "success" ? "rgba(31,174,74,0.3)" : "rgba(225,29,72,0.25)",
            }}
            role="status"
            aria-live="polite"
          >
            {messageType === "success" ? (
              <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: "var(--clr-success-500)" }}>
                <path d="M20 6L9 17l-5-5" />
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: "var(--clr-danger-500)" }}>
                <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
              </svg>
            )}
            <p
              className="text-[12px] font-semibold"
              style={{ color: messageType === "success" ? "var(--clr-success-700)" : "var(--clr-danger-700)" }}
            >
              {message}
            </p>
            <button
              type="button"
              onClick={() => setMessage(null)}
              className="ml-auto p-1 text-muted transition-colors hover:text-primary"
              aria-label="Cerrar mensaje"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* ── INVITE FORM ── */}
        <form
          id="invite-form"
          onSubmit={createUser}
          className="usr-form"
          aria-labelledby="invite-heading"
        >
          {/* Section header row */}
          <div
            className="flex items-center justify-between gap-4 px-0 py-4"
            style={{ borderBottom: "1px solid var(--border-soft)" }}
          >
            <div className="usr-section-label" style={{ marginBottom: 0 }}>
              <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--brand-violet)" }} aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <h2 id="invite-heading" className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                Invitar usuario
              </h2>
              <span style={{ flex: 1, height: 1, background: "var(--border-soft)" }} />
            </div>
          </div>

          <div className="py-5">
            {/* Identity group */}
            <div className="mb-5">
              <div className="usr-section-label">Identidad</div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {/* Username */}
                <div>
                  <label htmlFor="new-username" className="mb-1.5 block text-[11px] font-semibold text-secondary">
                    Usuario <span style={{ color: "var(--brand-magenta)" }}>*</span>
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center" aria-hidden="true">
                      <svg className="h-3.5 w-3.5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                      </svg>
                    </span>
                    <input
                      id="new-username"
                      className="field pl-9"
                      placeholder="ej: juan.perez"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      autoComplete="off"
                    />
                  </div>
                </div>

                {/* Display Name */}
                <div>
                  <label htmlFor="new-displayname" className="mb-1.5 block text-[11px] font-semibold text-secondary">
                    Nombre visible
                    <span className="ml-1.5 text-[10px] font-normal text-muted">(opcional)</span>
                  </label>
                  <input
                    id="new-displayname"
                    className="field"
                    placeholder="ej: Juan Pérez"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="new-password" className="mb-1.5 block text-[11px] font-semibold text-secondary">
                    Contraseña <span style={{ color: "var(--brand-magenta)" }}>*</span>
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center" aria-hidden="true">
                      <svg className="h-3.5 w-3.5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    </span>
                    <input
                      id="new-password"
                      className="field pl-9"
                      type="password"
                      placeholder="mín. 6 caracteres"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Role group */}
            <div className="mb-5">
              <div className="usr-section-label">Rol</div>
              <div
                className="grid gap-2"
                style={{ gridTemplateColumns: "repeat(4, 1fr)" }}
                role="radiogroup"
                aria-label="Seleccioná un rol"
              >
                {(["SCANNER", "SELLER", "MANAGER", "ADMIN"] as const).map((r) => {
                  const meta = ROLE_META[r];
                  const isSelected = role === r;
                  return (
                    <label
                      key={r}
                      className={`usr-role-option ${isSelected ? "usr-role-selected" : ""}`}
                      title={meta.desc}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={r}
                        checked={isSelected}
                        onChange={() => {
                          setRole(r);
                          setManagedEventIds([]);
                        }}
                        className="sr-only"
                      />
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: isSelected ? "var(--brand-violet)" : "var(--clr-arena-300)" }}
                        aria-hidden="true"
                      />
                      <span
                        className="text-[11px] font-bold leading-tight"
                        style={{ color: isSelected ? "var(--brand-violet)" : "var(--text-secondary)" }}
                      >
                        {meta.label}
                      </span>
                      <span className="hidden text-center text-[9.5px] leading-tight text-muted sm:block">
                        {meta.desc}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Event assignments (conditional) */}
            {roleSupportsEventAssignments(role) ? (
              <div className="mb-5">
                <div className="usr-section-label">
                  Eventos asignados
                  <span className="ml-1 text-[9px] font-normal normal-case text-muted">
                    Ctrl/Cmd + clic para múltiple
                  </span>
                </div>
                {events.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[color:var(--border-soft)] px-4 py-3 text-[12px] text-secondary">
                    No hay eventos disponibles para asignar.
                  </p>
                ) : (
                  <select
                    className="usr-event-select"
                    multiple
                    value={managedEventIds}
                    onChange={(e) => {
                      const values = Array.from(e.currentTarget.selectedOptions).map((o) => o.value);
                      setManagedEventIds(values);
                    }}
                    aria-label="Seleccioná eventos para asignar"
                  >
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.name} — {new Date(ev.startsAt).toLocaleDateString("es-AR")}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : (
              <div
                className="mb-5 flex items-center gap-2.5 rounded-lg border px-4 py-3"
                style={{ borderColor: "var(--border-soft)", background: "var(--bg-sunken)" }}
              >
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--brand-violet)" }} aria-hidden="true">
                  <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
                </svg>
                <p className="text-[12px] text-secondary">
                  <strong className="text-primary">ADMIN</strong> tiene acceso global — no requiere asignación de eventos.
                </p>
              </div>
            )}

            {/* Submit */}
            <div
              className="flex items-center justify-end gap-3 pt-4"
              style={{ borderTop: "1px solid var(--border-soft)" }}
            >
              <button
                type="submit"
                className="btn-primary flex items-center gap-2"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                    Creando...
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" />
                    </svg>
                    Crear usuario
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* ── USERS TABLE ── */}
        <div
          className="usr-table"
          style={{ borderTop: "1px solid var(--border-soft)" }}
        >
          {/* Table header row */}
          <div
            className="flex items-center justify-between px-0 py-3"
            style={{ borderBottom: "1px solid var(--border-soft)" }}
          >
            <div className="usr-section-label" style={{ marginBottom: 0 }}>
              <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--brand-violet)" }} aria-hidden="true">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                {loading ? "Cargando..." : `${users.length} usuario${users.length !== 1 ? "s" : ""}`}
              </span>
              <span style={{ flex: 1, height: 1, background: "var(--border-soft)" }} />
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg className="h-4 w-4 animate-spin text-muted mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              <p className="text-[12px] text-muted">Cargando usuarios...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-[13px] font-semibold text-primary">Sin usuarios todavía</p>
              <p className="mt-1 text-[11px] text-secondary max-w-xs">
                Creá el primer usuario con el formulario de arriba.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full" style={{ fontSize: "13px", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "var(--bg-sunken)", borderBottom: "1px solid var(--border-soft)" }}>
                    <th className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.11em] text-secondary">
                      Usuario
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.11em] text-secondary">
                      Rol
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.11em] text-secondary">
                      Estado
                    </th>
                    <th className="whitespace-nowrap hidden px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.11em] text-secondary sm:table-cell">
                      Sesiones
                    </th>
                    <th className="whitespace-nowrap hidden px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.11em] text-secondary md:table-cell">
                      Creado
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.11em] text-secondary">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user, idx) => {
                    const meta        = ROLE_META[user.role];
                    const initials    = getInitials(user.displayName, user.username);
                    const avatarGrad  = AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length];
                    const isExpanded  = expandedUserId === user.id;

                    return (
                      <>
                        <tr
                          key={user.id}
                          className="usr-row usr-tr"
                          style={{ borderBottom: isExpanded ? "none" : "1px solid var(--border-soft)" }}
                        >
                          {/* Avatar + Name */}
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`usr-monogram bg-gradient-to-br ${avatarGrad}`}
                                aria-hidden="true"
                              >
                                {initials}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-[13px] font-semibold text-primary max-w-[160px]">
                                  {user.displayName ?? user.username}
                                </p>
                                {user.displayName && (
                                  <p className="text-[11px] text-muted" style={{ fontFamily: "var(--font-mono)" }}>
                                    @{user.username}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Role pill */}
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.pill}`}
                            >
                              <span className="h-1.5 w-1.5 rounded-full" style={{ background: "currentColor", opacity: 0.7 }} aria-hidden="true" />
                              {meta.label}
                            </span>
                          </td>

                          {/* Status dot */}
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              {user.isActive ? (
                                <span
                                  className="usr-dot-active inline-block h-1.5 w-1.5 rounded-full"
                                  style={{ background: "var(--clr-success-500)" }}
                                  aria-hidden="true"
                                />
                              ) : (
                                <span
                                  className="inline-block h-1.5 w-1.5 rounded-full"
                                  style={{ background: "var(--clr-arena-300)" }}
                                  aria-hidden="true"
                                />
                              )}
                              <span className="text-[12px] text-secondary">
                                {user.isActive ? "Activo" : "Inactivo"}
                              </span>
                            </div>
                          </td>

                          {/* Sessions */}
                          <td className="hidden px-3 py-2 text-right text-[12px] tabular-nums text-muted sm:table-cell">
                            {user._count?.sessions ?? 0}
                          </td>

                          {/* Created */}
                          <td className="hidden px-3 py-2 text-right text-[11px] text-muted md:table-cell">
                            {new Date(user.createdAt).toLocaleDateString("es-AR")}
                          </td>

                          {/* Actions — icon-only */}
                          <td className="whitespace-nowrap px-3 py-2">
                            <div className="flex items-center justify-end gap-0.5">
                              {/* Toggle active */}
                              <button
                                type="button"
                                className="usr-action-btn"
                                data-tip={user.isActive ? "Desactivar" : "Activar"}
                                aria-label={user.isActive ? "Desactivar cuenta" : "Activar cuenta"}
                                onClick={() => void toggleActive(user)}
                                style={{ color: user.isActive ? "var(--clr-danger-500)" : "var(--clr-success-500)" }}
                              >
                                {user.isActive ? (
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <circle cx="12" cy="12" r="10" /><path d="M15 9l-6 6M9 9l6 6" />
                                  </svg>
                                ) : (
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                                  </svg>
                                )}
                              </button>

                              {/* Reset password */}
                              <button
                                type="button"
                                className="usr-action-btn"
                                data-tip="Cambiar password"
                                aria-label="Cambiar contraseña"
                                onClick={() => void resetPassword(user)}
                              >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                </svg>
                              </button>

                              {/* Edit events (only for roles that support it) */}
                              {roleSupportsEventAssignments(user.role) && (
                                <button
                                  type="button"
                                  className="usr-action-btn"
                                  data-tip="Editar eventos"
                                  aria-label="Editar eventos asignados"
                                  onClick={() => setExpandedUserId(isExpanded ? null : user.id)}
                                  style={{ color: isExpanded ? "var(--brand-violet)" : undefined }}
                                >
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Inline event expander */}
                        {isExpanded && roleSupportsEventAssignments(user.role) && (
                          <tr
                            key={`${user.id}-expand`}
                            className="usr-expand-row"
                            style={{ borderBottom: "1px solid var(--border-soft)" }}
                          >
                            <td colSpan={6} className="px-3 py-3">
                              <div className="ml-[44px]">
                                <label
                                  htmlFor={`events-${user.id}`}
                                  className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-secondary"
                                >
                                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                                  </svg>
                                  Eventos asignados
                                  {user.managedEventIds.length > 0 && (
                                    <span
                                      className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                                      style={{ background: "var(--clr-forest-100)", color: "var(--brand-violet)" }}
                                    >
                                      {user.managedEventIds.length}
                                    </span>
                                  )}
                                  <span className="ml-1 text-[9px] font-normal normal-case text-muted">Ctrl/Cmd + clic para múltiple</span>
                                </label>
                                {events.length === 0 ? (
                                  <p className="text-[11px] text-muted">No hay eventos disponibles.</p>
                                ) : (
                                  <select
                                    id={`events-${user.id}`}
                                    className="usr-event-select"
                                    style={{ maxWidth: 480 }}
                                    multiple
                                    value={user.managedEventIds}
                                    onChange={(e) => {
                                      const values = Array.from(e.currentTarget.selectedOptions).map((o) => o.value);
                                      void setUserManagedEvents(user, values);
                                    }}
                                    aria-label={`Eventos asignados a ${user.username}`}
                                  >
                                    {events.map((ev) => (
                                      <option key={ev.id} value={ev.id}>
                                        {ev.name} — {new Date(ev.startsAt).toLocaleDateString("es-AR")}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>

              {/* Footer count */}
              <div
                className="flex items-center px-3 py-2.5"
                style={{ borderTop: "1px solid var(--border-soft)" }}
              >
                <span className="text-[11px] text-muted">
                  <span className="font-medium text-secondary">{users.length}</span> usuario{users.length !== 1 ? "s" : ""} · <span className="font-medium text-secondary">{activeCount}</span> activo{activeCount !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          )}
        </div>

      </div>
    </>
  );
}
