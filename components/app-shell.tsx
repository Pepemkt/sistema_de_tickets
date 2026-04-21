"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { LogoutButton } from "@/components/logout-button";
import { BrandMark, LogoMark } from "@/components/ui";

type Viewer = {
  username: string;
  displayName: string | null;
  role: "ADMIN" | "MANAGER" | "SELLER" | "SCANNER";
};

type Props = {
  viewer: Viewer;
  brandLogoUrl: string | null;
  children: React.ReactNode;
};

type NavItem = {
  href: string;
  label: string;
  exact?: boolean;
  icon: React.ReactNode;
};

type NavGroup = {
  label: string | null; // null = ungrouped top items
  items: NavItem[];
};

function isSafeLogoSrc(value: string | null) {
  if (!value) return false;
  if (value.startsWith("data:image/")) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function NavIcon({ path, path2 }: { path: string; path2?: string }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={path} />
      {path2 && <path d={path2} />}
    </svg>
  );
}

// ─── Route → page title map ──────────────────────────────────────────────────
const PAGE_TITLES: { pattern: RegExp; label: string }[] = [
  { pattern: /^\/admin\/events\/new$/, label: "Nuevo evento" },
  { pattern: /^\/admin\/events\/[^/]+\/edit/, label: "Editar evento" },
  { pattern: /^\/admin\/events\/[^/]+\/liquidation/, label: "Liquidación" },
  { pattern: /^\/admin\/events\/[^/]+/, label: "Detalle de evento" },
  { pattern: /^\/admin\/clients$/, label: "Merchants" },
  { pattern: /^\/admin\/orders$/, label: "Órdenes" },
  { pattern: /^\/admin\/analytics$/, label: "Analytics" },
  { pattern: /^\/admin\/users$/, label: "Usuarios" },
  { pattern: /^\/admin\/settings$/, label: "Configuración" },
  { pattern: /^\/admin$/, label: "Dashboard" },
  { pattern: /^\/sales/, label: "Ventas especiales" },
  { pattern: /^\/scan/, label: "Check-in" },
  { pattern: /^\/$/, label: "Eventos" },
];

function usePageTitle(pathname: string): string {
  for (const { pattern, label } of PAGE_TITLES) {
    if (pattern.test(pathname)) return label;
  }
  // Fallback: capitalise last segment
  const last = pathname.split("/").filter(Boolean).pop() ?? "";
  return last.charAt(0).toUpperCase() + last.slice(1).replace(/-/g, " ") || "Panel";
}

// ─── Avatar initial ───────────────────────────────────────────────────────────
function getInitial(displayName: string | null, username: string) {
  const src = displayName ?? username;
  return src.charAt(0).toUpperCase();
}

export function AppShell({ viewer, brandLogoUrl, children }: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const safeBrandLogoUrl = isSafeLogoSrc(brandLogoUrl) ? brandLogoUrl : null;
  const pageTitle = usePageTitle(pathname);
  const initial = getInitial(viewer.displayName, viewer.username);

  // ─── Nav items (role-gated, same logic as before) ──────────────────────────
  const allNavItems = useMemo<NavItem[]>(() => {
    const base: NavItem[] = [
      {
        href: "/",
        label: "Eventos",
        exact: true,
        icon: <NavIcon path="M3 7h18M3 12h18M3 17h18" />,
      },
    ];

    if (viewer.role === "ADMIN" || viewer.role === "MANAGER" || viewer.role === "SELLER") {
      base.push({
        href: "/sales",
        label: "Ventas especiales",
        icon: <NavIcon path="M4 19h16M4 14h16M6 9h12M8 4h8" />,
      });
    }

    if (viewer.role === "ADMIN" || viewer.role === "MANAGER" || viewer.role === "SCANNER") {
      base.push({
        href: "/scan",
        label: "Check-in",
        icon: <NavIcon path="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM18 14v6h-4" />,
      });
    }

    if (viewer.role === "ADMIN" || viewer.role === "MANAGER") {
      base.unshift({
        href: "/admin",
        label: "Dashboard",
        exact: true,
        icon: <NavIcon path="M4 13h6V4H4v9zm10 7h6V4h-6v16zM4 20h6v-3H4v3z" />,
      });

      base.push(
        {
          href: "/admin/orders",
          label: "Órdenes",
          icon: <NavIcon path="M5 7h14M5 12h14M5 17h10" />,
        },
        {
          href: "/admin/clients",
          label: "Merchants",
          icon: <NavIcon path="M3 7h18M6 12h12M9 17h6" />,
        },
        {
          href: "/admin/analytics",
          label: "Analytics",
          icon: <NavIcon path="M5 19V9m7 10V5m7 14v-7" />,
        }
      );
    }

    if (viewer.role === "ADMIN") {
      base.push(
        {
          href: "/admin/users",
          label: "Usuarios",
          icon: <NavIcon path="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" path2="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />,
        },
        {
          href: "/admin/settings",
          label: "Configuración",
          icon: (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          ),
        }
      );
    }

    return base;
  }, [viewer.role]);

  // ─── Group nav items into sections ─────────────────────────────────────────
  const navGroups = useMemo<NavGroup[]>(() => {
    const topItems: NavItem[] = [];
    const operacionesItems: NavItem[] = [];
    const analisisItems: NavItem[] = [];
    const sistemaItems: NavItem[] = [];

    const OPERACIONES_HREFS = ["/", "/sales", "/scan", "/admin/events/new", "/admin/orders", "/admin/clients"];
    const ANALISIS_HREFS = ["/admin/analytics"];
    const SISTEMA_HREFS = ["/admin/users", "/admin/settings"];
    const TOP_HREFS = ["/admin"];

    for (const item of allNavItems) {
      if (TOP_HREFS.includes(item.href)) {
        topItems.push(item);
      } else if (ANALISIS_HREFS.includes(item.href)) {
        analisisItems.push(item);
      } else if (SISTEMA_HREFS.includes(item.href)) {
        sistemaItems.push(item);
      } else if (OPERACIONES_HREFS.includes(item.href)) {
        operacionesItems.push(item);
      } else {
        operacionesItems.push(item);
      }
    }

    const groups: NavGroup[] = [];
    if (topItems.length) groups.push({ label: null, items: topItems });
    if (operacionesItems.length) groups.push({ label: "Operaciones", items: operacionesItems });
    if (analisisItems.length) groups.push({ label: "Análisis", items: analisisItems });
    if (sistemaItems.length) groups.push({ label: "Sistema", items: sistemaItems });
    return groups;
  }, [allNavItems]);

  const sidebarWidthClass = collapsed ? "md:w-16" : "md:w-[240px]";
  const mainInsetClass = collapsed ? "md:pl-16" : "md:pl-[240px]";
  const topbarInsetClass = collapsed ? "md:left-16" : "md:left-[240px]";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-page)" }}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 md:hidden"
          style={{ backgroundColor: "var(--bg-overlay)" }}
          onClick={() => setMobileOpen(false)}
          aria-label="Cerrar menú"
        />
      )}

      {/* ─── SIDEBAR ────────────────────────────────────────────────────────── */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex w-[240px] -translate-x-full flex-col",
          "border-r transition-[width,transform] duration-200 ease-in-out",
          "md:translate-x-0",
          sidebarWidthClass,
          mobileOpen ? "translate-x-0" : "",
        ].join(" ")}
        style={{
          backgroundColor: "var(--bg-surface)",
          borderColor: "var(--border-soft)",
        }}
      >
        {/* Logo block */}
        <div
          className="flex h-14 shrink-0 items-center justify-between px-3"
          style={{ borderBottom: "1px solid var(--border-soft)" }}
        >
          <div className="flex min-w-0 items-center gap-2.5 overflow-hidden">
            {/* Logo mark / brand image */}
            <span
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ background: "var(--grad-hero)", color: "#fff" }}
            >
              {safeBrandLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={safeBrandLogoUrl}
                  alt="Logo"
                  className="h-6 w-6 rounded-md object-cover"
                />
              ) : (
                <LogoMark size="sm" />
              )}
            </span>
            {/* Wordmark — hidden when collapsed */}
            {!collapsed && (
              <span
                className="truncate font-display text-label font-bold tracking-tight"
                style={{ color: "var(--text-primary)" }}
              >
                Tickets<span style={{ color: "var(--brand-violet)" }}>.</span>
              </span>
            )}
          </div>

          {/* Collapse toggle — desktop only */}
          <button
            type="button"
            className="hidden shrink-0 rounded-md p-1.5 transition-colors duration-[120ms] md:inline-flex"
            style={{ color: "var(--text-muted)" }}
            onClick={() => setCollapsed((v) => !v)}
            aria-label="Colapsar sidebar"
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "var(--bg-sunken)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {collapsed ? (
                <path d="m9 18 6-6-6-6" />
              ) : (
                <path d="m15 18-6-6 6-6" />
              )}
            </svg>
          </button>

          {/* Mobile close button */}
          <button
            type="button"
            className="inline-flex shrink-0 rounded-md p-1.5 transition-colors duration-[120ms] md:hidden"
            style={{ color: "var(--text-muted)" }}
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar menú"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {/* Nav groups */}
        <nav className="flex-1 overflow-y-auto py-2">
          {navGroups.map((group) => (
            <div key={group.label ?? "__top"} className="px-2 pb-1">
              {/* Section overline label */}
              {group.label && !collapsed && (
                <p
                  className="px-2 pb-1 pt-3 font-display text-[10px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {group.label}
                </p>
              )}
              {group.label && collapsed && <div className="my-2 mx-2 h-px" style={{ backgroundColor: "var(--border-soft)" }} />}

              {/* Items */}
              {group.items.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    title={item.label}
                    className={[
                      "relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium",
                      "transition-[background-color,color] duration-[120ms]",
                      collapsed ? "justify-center" : "",
                    ].join(" ")}
                    style={
                      active
                        ? {
                            backgroundColor: "rgba(91,33,182,0.10)",
                            color: "var(--brand-violet)",
                            fontWeight: 600,
                          }
                        : {
                            color: "var(--text-secondary)",
                          }
                    }
                    onMouseEnter={(e) => {
                      if (!active) {
                        (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "var(--bg-sunken)";
                        (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-primary)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "transparent";
                        (e.currentTarget as HTMLAnchorElement).style.color = "var(--text-secondary)";
                      }
                    }}
                  >
                    {/* Active accent bar */}
                    {active && (
                      <span
                        className="absolute inset-y-1 left-0 w-0.5 rounded-r-full"
                        style={{ backgroundColor: "var(--brand-violet)" }}
                      />
                    )}
                    {/* Icon */}
                    <span
                      className="inline-flex shrink-0 items-center justify-center"
                      style={{ opacity: active ? 1 : 0.65 }}
                    >
                      {item.icon}
                    </span>
                    {/* Label */}
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer — user + logout */}
        <div
          className="shrink-0 p-2"
          style={{ borderTop: "1px solid var(--border-soft)" }}
        >
          {!collapsed ? (
            <div className="flex items-center gap-2.5 rounded-md px-2.5 py-2">
              {/* Avatar */}
              <span
                className="inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                style={{ background: "var(--grad-hero)" }}
              >
                {initial}
              </span>
              {/* Name + role */}
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-[12px] font-semibold"
                  style={{ color: "var(--text-primary)" }}
                >
                  {viewer.displayName ?? viewer.username}
                </p>
                <p
                  className="text-[10px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {viewer.role}
                </p>
              </div>
              {/* Logout icon */}
              <LogoutButton iconOnly />
            </div>
          ) : (
            <div className="flex justify-center">
              <LogoutButton iconOnly />
            </div>
          )}
        </div>
      </aside>

      {/* ─── TOPBAR ─────────────────────────────────────────────────────────── */}
      <header
        className={[
          "fixed right-0 top-0 z-30 left-0 flex h-14 items-center justify-between px-5",
          "transition-[left] duration-200 ease-in-out",
          topbarInsetClass,
        ].join(" ")}
        style={{
          backgroundColor: "var(--bg-surface)",
          borderBottom: "1px solid var(--border-soft)",
        }}
      >
        {/* Left: mobile burger + page title */}
        <div className="flex items-center gap-3">
          {/* Mobile burger */}
          <button
            type="button"
            className="inline-flex shrink-0 rounded-md p-1.5 transition-colors duration-[120ms] md:hidden"
            style={{ color: "var(--text-muted)" }}
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>

          {/* Page title */}
          <p
            className="text-[14px] font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {pageTitle}
          </p>
        </div>

        {/* Right: contextual actions */}
        <div className="flex items-center gap-2">
          {(viewer.role === "ADMIN" || viewer.role === "MANAGER") && (
            <Link
              href="/admin/events/new"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-[5px] text-[12px] font-semibold text-white transition-opacity duration-[120ms] hover:opacity-90"
              style={{ background: "var(--grad-hero)" }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
              Nuevo evento
            </Link>
          )}

          {(viewer.role === "ADMIN" || viewer.role === "MANAGER" || viewer.role === "SELLER") && (
            <Link
              href="/sales"
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-[5px] text-[12px] font-medium transition-colors duration-[120ms]"
              style={{
                borderColor: "var(--border-soft)",
                color: "var(--text-secondary)",
                backgroundColor: "var(--bg-surface)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "var(--bg-sunken)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "var(--bg-surface)";
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 19h16M4 14h16M6 9h12M8 4h8" />
              </svg>
              Ventas
            </Link>
          )}

          {(viewer.role === "ADMIN" || viewer.role === "MANAGER" || viewer.role === "SCANNER") && (
            <Link
              href="/scan"
              className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-[5px] text-[12px] font-medium transition-colors duration-[120ms]"
              style={{
                borderColor: "var(--border-soft)",
                color: "var(--text-secondary)",
                backgroundColor: "var(--bg-surface)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "var(--bg-sunken)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "var(--bg-surface)";
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM18 14v6h-4" />
              </svg>
              Check-in
            </Link>
          )}
        </div>
      </header>

      {/* ─── MAIN CONTENT ───────────────────────────────────────────────────── */}
      <main
        className={[
          "pt-14 transition-[padding-left] duration-200 ease-in-out",
          mainInsetClass,
        ].join(" ")}
        style={{ backgroundColor: "var(--bg-page)" }}
      >
        <div className="mx-auto w-full max-w-[1280px] px-6 pb-12 pt-6">
          {children}
        </div>
      </main>
    </div>
  );
}
