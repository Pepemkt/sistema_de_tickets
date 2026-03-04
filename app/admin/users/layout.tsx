import { requirePageRole } from "@/lib/auth";

export default async function AdminUsersLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(["ADMIN"]);
  return <>{children}</>;
}

