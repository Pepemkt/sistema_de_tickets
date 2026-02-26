import { redirect } from "next/navigation";
import { getCurrentViewer } from "@/lib/auth";
import { ScanClient } from "@/components/scan-client";

export default async function ScanPage() {
  const viewer = await getCurrentViewer();

  if (!viewer) {
    redirect("/login?next=/scan");
  }

  if (viewer.role !== "ADMIN" && viewer.role !== "SCANNER") {
    redirect("/");
  }

  return <ScanClient />;
}
