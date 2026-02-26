import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkApiRole } from "@/lib/api-auth";
import { hashPassword } from "@/lib/password";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ id: string }>;
};

const patchSchema = z.object({
  role: z.enum(["ADMIN", "SELLER", "SCANNER"]).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).max(100).optional(),
  displayName: z.string().max(60).nullable().optional()
});

export async function PATCH(request: Request, { params }: Params) {
  const auth = await checkApiRole(["ADMIN"]);
  if (auth.response) return auth.response;
  const actor = auth.viewer!;

  try {
    const { id } = await params;
    const data = patchSchema.parse(await request.json());

    if (id === actor.id && data.isActive === false) {
      throw new Error("No puedes desactivar tu propio usuario");
    }

    if (id === actor.id && data.role && data.role !== "ADMIN") {
      throw new Error("No puedes quitarte el rol ADMIN");
    }

    const target = await db.user.findUnique({
      where: { id },
      select: { role: true, isActive: true }
    });

    if (!target) {
      throw new Error("Usuario no encontrado");
    }

    const removesAdminPrivileges =
      target.role === "ADMIN" &&
      target.isActive &&
      (data.role === "SCANNER" || data.role === "SELLER" || data.isActive === false);

    if (removesAdminPrivileges) {
      const activeAdminCount = await db.user.count({
        where: { role: "ADMIN", isActive: true }
      });

      if (activeAdminCount <= 1) {
        throw new Error("Debe existir al menos un admin activo");
      }
    }

    const updateData: {
      role?: "ADMIN" | "SELLER" | "SCANNER";
      isActive?: boolean;
      displayName?: string | null;
      passwordHash?: string;
    } = {};

    if (data.role !== undefined) updateData.role = data.role;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.password) updateData.passwordHash = await hashPassword(data.password);

    const user = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (data.isActive === false) {
      await db.session.deleteMany({ where: { userId: id } });
    }

    return NextResponse.json({ user });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo actualizar usuario"
      },
      { status: 400 }
    );
  }
}
