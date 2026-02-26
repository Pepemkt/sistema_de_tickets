import { NextResponse } from "next/server";
import { UserRole } from "@prisma/client";
import { getCurrentViewer } from "@/lib/auth";

export async function checkApiRole(roles: UserRole[]) {
  const viewer = await getCurrentViewer();
  if (!viewer) {
    return {
      viewer: null,
      response: NextResponse.json({ error: "No autenticado" }, { status: 401 })
    };
  }

  if (!roles.includes(viewer.role)) {
    return {
      viewer: null,
      response: NextResponse.json({ error: "Sin permisos" }, { status: 403 })
    };
  }

  return {
    viewer,
    response: null
  };
}
