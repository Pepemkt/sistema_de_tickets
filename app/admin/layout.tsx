import { requirePageRole } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(["ADMIN"]);

  return <div className="space-y-6">{children}</div>;
}
