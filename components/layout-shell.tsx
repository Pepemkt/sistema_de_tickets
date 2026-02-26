"use client";

import { usePathname } from "next/navigation";
import { AppShell } from "@/components/app-shell";

type Viewer = {
  username: string;
  displayName: string | null;
  role: "ADMIN" | "SELLER" | "SCANNER";
};

type Props = {
  viewer: Viewer | null;
  brandLogoUrl: string | null;
  children: React.ReactNode;
};

function isPublicExperiencePath(pathname: string) {
  return pathname.startsWith("/e/") || pathname === "/success" || pathname === "/pending" || pathname === "/failure";
}

export function LayoutShell({ viewer, brandLogoUrl, children }: Props) {
  const pathname = usePathname();

  if (!viewer || isPublicExperiencePath(pathname)) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <AppShell
      viewer={{
        username: viewer.username,
        displayName: viewer.displayName,
        role: viewer.role
      }}
      brandLogoUrl={brandLogoUrl}
    >
      {children}
    </AppShell>
  );
}
