import "./globals.css";
import type { Metadata } from "next";
import { getCurrentViewer } from "@/lib/auth";
import { readBrandingConfig } from "@/lib/branding";
import { LayoutShell } from "@/components/layout-shell";
import { poppins, inter, geistMono } from "@/app/(fonts)/fonts";

export const metadata: Metadata = {
  title: "Aiderbrand | Gestion de Entradas",
  description: "Gestion y venta de entradas con Mercado Pago"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [viewer, branding] = await Promise.all([
    getCurrentViewer().catch(() => null),
    readBrandingConfig().catch(() => ({ sidebarLogoUrl: null }))
  ]);

  return (
    <html
      lang="es"
      data-theme="light"
      className={`${poppins.variable} ${inter.variable} ${geistMono.variable}`}
    >
      <body>
        <LayoutShell
          viewer={
            viewer
              ? {
                  username: viewer.username,
                  displayName: viewer.displayName,
                  role: viewer.role
                }
              : null
          }
          brandLogoUrl={branding.sidebarLogoUrl}
        >
          {children}
        </LayoutShell>
      </body>
    </html>
  );
}
