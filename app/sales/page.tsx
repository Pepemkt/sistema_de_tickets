import { requirePageRole } from "@/lib/auth";
import { SalesConsole } from "@/components/sales-console";

export default async function SalesPage() {
  await requirePageRole(["ADMIN", "SELLER"]);

  return <SalesConsole />;
}

