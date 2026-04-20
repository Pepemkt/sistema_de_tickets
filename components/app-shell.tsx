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

function NavIcon({ path }: { path: string }) {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} />
    </svg>
  );
}

export function AppShell({ viewer, brandLogoUrl, children }: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const safeBrandLogoUrl = isSafeLogoSrc(brandLogoUrl) ? brandLogoUrl : null;

  const navItems = useMemo<NavItem[]>(() => {
    const base: NavItem[] = [
      {
        href: "/",
        label: "Eventos",
        icon: <NavIcon path="M3 7h18M3 12h18M3 17h18" />
      }
    ];

    if (viewer.role === "ADMIN" || viewer.role === "MANAGER" || viewer.role === "SELLER") {
      base.push({
        href: "/sales",
        label: "Ventas especiales",
        icon: <NavIcon path="M4 19h16M4 14h16M6 9h12M8 4h8" />
      });
    }

    if (viewer.role === "ADMIN" || viewer.role === "MANAGER" || viewer.role === "SCANNER") {
      base.push({
        href: "/scan",
        label: "Check-in",
        icon: <NavIcon path="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM18 14v6h-4" />
      });
    }

    if (viewer.role === "ADMIN" || viewer.role === "MANAGER") {
      base.unshift({
        href: "/admin",
        label: "Dashboard",
        exact: true,
        icon: <NavIcon path="M4 13h6V4H4v9zm10 7h6V4h-6v16zM4 20h6v-3H4v3z" />
      });

      base.push(
        {
          href: "/admin/events/new",
          label: "Nuevo evento",
          icon: <NavIcon path="M12 5v14M5 12h14" />
        },
        {
          href: "/admin/clients",
          label: "Merchants",
          icon: <NavIcon path="M3 7h18M6 12h12M9 17h6" />
        },
        {
          href: "/admin/orders",
          label: "Ordenes",
          icon: <NavIcon path="M5 7h14M5 12h14M5 17h10" />
        },
        {
          href: "/admin/analytics",
          label: "Analytics",
          icon: <NavIcon path="M5 19V9m7 10V5m7 14v-7" />
        }
      );
    }

    if (viewer.role === "ADMIN") {
      base.push(
        {
          href: "/admin/users",
          label: "Usuarios",
          icon: <NavIcon path="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87" />
        },
        {
          href: "/admin/settings",
          label: "Configuracion",
          icon: <NavIcon path="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.06-.95l2.11-1.65-2-3.46-2.49 1a7.38 7.38 0 0 0-1.64-.95l-.38-2.65h-4l-.38 2.65c-.58.23-1.13.54-1.64.95l-2.49-1-2 3.46 2.11 1.65A7.4 7.4 0 0 0 4.6 12c0 .32.02.64.06.95l-2.11 1.65 2 3.46 2.49-1c.51.41 1.06.72 1.64.95l.38 2.65h4l.38-2.65c.58-.23 1.13-.54 1.64-.95l2.49 1 2-3.46-2.11-1.65c.04-.31.06-.63.06-.95z" />
        }
      );
    }

    return base;
  }, [viewer.role]);

  const asideWidthClass = collapsed ? "md:w-16" : "md:w-64";
  const headerInsetClass = collapsed ? "md:left-16" : "md:left-64";

  return (
    <div className="min-h-screen bg-page">
      {mobileOpen && <button type="button" className="fixed inset-0 z-40 bg-overlay md:hidden" onClick={() => setMobileOpen(false)} aria-label="Cerrar menu" />}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 -translate-x-full border-r border-soft bg-surface transition-all duration-slow ease-tactile md:translate-x-0 ${asideWidthClass} ${mobileOpen ? "translate-x-0" : ""}`}
      >
        <div className="flex h-full flex-col">
          <header className="flex items-center justify-between border-b border-soft px-3 py-2.5">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-sunken text-forest-600">
                {safeBrandLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={safeBrandLogoUrl} alt="Logo" className="h-6 w-6 rounded-xs object-cover" />
                ) : (
                  <LogoMark size="sm" />
                )}
              </span>
              {!collapsed && (
                <span className="truncate">
                  <BrandMark size="sm" />
                </span>
              )}
            </div>
            <button
              type="button"
              className="hidden rounded-sm p-2 text-secondary transition-colors duration-base ease-tactile hover:bg-sunken md:inline-flex"
              onClick={() => setCollapsed((v) => !v)}
              aria-label="Colapsar sidebar"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {collapsed ? <path d="m8 9 4 4 4-4" /> : <path d="m16 15-4-4-4 4" />}
              </svg>
            </button>
            <button type="button" className="inline-flex rounded-full border border-strong p-1.5 text-secondary transition-colors duration-base ease-tactile hover:bg-sunken md:hidden" onClick={() => setMobileOpen(false)} aria-label="Cerrar menu">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </header>

          <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
            {navItems.map((item) => {
              const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`group flex items-center gap-2 rounded-sm px-2.5 py-2 text-body-s transition-colors duration-base ease-tactile ${
                    active ? "bg-forest-600 text-onprimary" : "text-secondary hover:bg-sunken hover:text-primary"
                  }`}
                  title={item.label}
                >
                  <span className="-ml-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center">{item.icon}</span>
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-soft p-2">
            {!collapsed && (
              <div className="mb-2 rounded-sm border border-soft bg-sunken px-2.5 py-2">
                <p className="truncate text-body-s font-medium text-primary">{viewer.displayName ?? viewer.username}</p>
                <p className="text-overline text-primary">{viewer.role}</p>
              </div>
            )}
            <LogoutButton iconOnly={collapsed} />
          </div>
        </div>
      </aside>

      <header className={`fixed right-0 top-0 z-30 left-0 border-b border-soft bg-surface/95 backdrop-blur md:right-0 ${headerInsetClass}`}>
        <div className="flex h-14 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex rounded-sm p-2 text-secondary transition-colors duration-base ease-tactile hover:bg-sunken md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>
            <p className="text-body-s font-medium text-primary">Panel de gestion</p>
          </div>

          <div className="flex items-center gap-2">
            {(viewer.role === "ADMIN" || viewer.role === "MANAGER") && (
              <Link href="/admin/events/new" className="btn-primary--sm">
                Nuevo evento
              </Link>
            )}
            {(viewer.role === "ADMIN" || viewer.role === "MANAGER" || viewer.role === "SELLER") && (
              <Link href="/sales" className="btn-secondary--sm">
                Ventas especiales
              </Link>
            )}
            {(viewer.role === "ADMIN" || viewer.role === "MANAGER" || viewer.role === "SCANNER") && (
              <Link href="/scan" className="btn-secondary--sm">
                Check-in
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className={`pt-20 transition-all duration-slow ease-tactile ${collapsed ? "md:pl-20" : "md:pl-64"}`}>
        <div className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6">{children}</div>
      </main>
    </div>
  );
}
