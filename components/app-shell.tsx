"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { LogoutButton } from "@/components/logout-button";

type Viewer = {
  username: string;
  displayName: string | null;
  role: "ADMIN" | "SELLER" | "SCANNER";
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

function BrandMark() {
  return (
    <svg className="h-5 w-5 text-blue-600" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M18.0835 3.23358C9.88316 3.23358 3.23548 9.8771 3.23548 18.0723V35.5832H0.583496V18.0723C0.583496 8.41337 8.41851 0.583252 18.0835 0.583252C27.7485 0.583252 35.5835 8.41337 35.5835 18.0723C35.5835 27.7312 27.7485 35.5614 18.0835 35.5614H16.7357V32.911H18.0835C26.2838 32.911 32.9315 26.2675 32.9315 18.0723C32.9315 9.8771 26.2838 3.23358 18.0835 3.23358Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M18.0833 8.62162C12.8852 8.62162 8.62666 12.9245 8.62666 18.2879V35.5833H5.97468V18.2879C5.97468 11.5105 11.3713 5.97129 18.0833 5.97129C24.7954 5.97129 30.192 11.5105 30.192 18.2879C30.192 25.0653 24.7954 30.6045 18.0833 30.6045H16.7355V27.9542H18.0833C23.2815 27.9542 27.54 23.6513 27.54 18.2879C27.54 12.9245 23.2815 8.62162 18.0833 8.62162Z"
        fill="currentColor"
      />
      <path
        d="M24.8225 18.1012C24.8225 21.8208 21.8053 24.8361 18.0833 24.8361C14.3614 24.8361 11.3442 21.8208 11.3442 18.1012C11.3442 14.3815 14.3614 11.3662 18.0833 11.3662C21.8053 11.3662 24.8225 14.3815 24.8225 18.1012Z"
        fill="currentColor"
      />
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

    if (viewer.role === "ADMIN" || viewer.role === "SELLER") {
      base.push({
        href: "/sales",
        label: "Ventas especiales",
        icon: <NavIcon path="M4 19h16M4 14h16M6 9h12M8 4h8" />
      });
    }

    if (viewer.role === "ADMIN" || viewer.role === "SCANNER") {
      base.push({
        href: "/scan",
        label: "Check-in",
        icon: <NavIcon path="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM18 14v6h-4" />
      });
    }

    if (viewer.role === "ADMIN") {
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
          href: "/admin/orders",
          label: "Ordenes",
          icon: <NavIcon path="M5 7h14M5 12h14M5 17h10" />
        },
        {
          href: "/admin/analytics",
          label: "Analytics",
          icon: <NavIcon path="M5 19V9m7 10V5m7 14v-7" />
        },
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
    <div className="min-h-screen bg-slate-100">
      {mobileOpen && <button type="button" className="fixed inset-0 z-40 bg-slate-900/40 md:hidden" onClick={() => setMobileOpen(false)} aria-label="Cerrar menu" />}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 -translate-x-full border-r border-slate-200 bg-white transition-all duration-300 md:translate-x-0 ${asideWidthClass} ${mobileOpen ? "translate-x-0" : ""}`}
      >
        <div className="flex h-full flex-col">
          <header className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50">
                {safeBrandLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={safeBrandLogoUrl} alt="Logo" className="h-6 w-6 rounded object-cover" />
                ) : (
                  <BrandMark />
                )}
              </span>
              {!collapsed && <span className="truncate text-sm font-semibold text-slate-900">Aiderbrand</span>}
            </div>
            <button
              type="button"
              className="hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:inline-flex"
              onClick={() => setCollapsed((v) => !v)}
              aria-label="Colapsar sidebar"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {collapsed ? <path d="m8 9 4 4 4-4" /> : <path d="m16 15-4-4-4 4" />}
              </svg>
            </button>
            <button type="button" className="inline-flex rounded-full border border-slate-300 p-1.5 text-slate-500 md:hidden" onClick={() => setMobileOpen(false)}>
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
                  className={`group flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition ${
                    active ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                  title={item.label}
                >
                  <span className="-ml-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center">{item.icon}</span>
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-slate-200 p-2">
            {!collapsed && (
              <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                <p className="truncate text-sm font-medium text-slate-900">{viewer.displayName ?? viewer.username}</p>
                <p className="text-xs uppercase text-slate-500">{viewer.role}</p>
              </div>
            )}
            <LogoutButton iconOnly={collapsed} />
          </div>
        </div>
      </aside>

      <header className={`fixed right-0 top-0 z-30 left-0 border-b border-slate-200 bg-white/95 backdrop-blur md:right-0 ${headerInsetClass}`}>
        <div className="flex h-14 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>
            <p className="text-sm font-medium text-slate-800">Panel de gestion</p>
          </div>

          <div className="flex items-center gap-2">
            {viewer.role === "ADMIN" && (
              <Link href="/admin/events/new" className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
                Nuevo evento
              </Link>
            )}
            {(viewer.role === "ADMIN" || viewer.role === "SELLER") && (
              <Link href="/sales" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                Ventas especiales
              </Link>
            )}
            {(viewer.role === "ADMIN" || viewer.role === "SCANNER") && (
              <Link href="/scan" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                Check-in
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className={`pt-20 transition-all duration-300 ${collapsed ? "md:pl-20" : "md:pl-64"}`}>
        <div className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6">{children}</div>
      </main>
    </div>
  );
}
