import { requirePageRole } from "@/lib/auth";

export default async function AdminSettingsLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(["ADMIN"]);
  return <>{children}</>;
}

