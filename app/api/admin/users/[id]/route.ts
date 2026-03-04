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
  role: z.enum(["ADMIN", "MANAGER", "SELLER", "SCANNER"]).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).max(100).optional(),
  displayName: z.string().max(60).nullable().optional(),
  managedEventIds: z.array(z.string().min(1)).optional()
});

export async function PATCH(request: Request, { params }: Params) {
  const auth = await checkApiRole(["ADMIN"]);
  if (auth.response) return auth.response;
  const actor = auth.viewer!;

  try {
    const { id } = await params;
    const data = patchSchema.parse(await request.json());

    if (data.role !== undefined) {
      throw new Error("El rol no se puede modificar desde edicion. Crea un usuario nuevo con el rol deseado.");
    }

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
      ((data.role !== undefined && data.role !== "ADMIN") || data.isActive === false);

    if (removesAdminPrivileges) {
      const activeAdminCount = await db.user.count({
        where: { role: "ADMIN", isActive: true }
      });

      if (activeAdminCount <= 1) {
        throw new Error("Debe existir al menos un admin activo");
      }
    }

    const updateData: {
      role?: "ADMIN" | "MANAGER" | "SELLER" | "SCANNER";
      isActive?: boolean;
      displayName?: string | null;
      passwordHash?: string;
    } = {};

    if (data.role !== undefined) updateData.role = data.role;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.password) updateData.passwordHash = await hashPassword(data.password);

    const nextRole = target.role;
    const managedEventIds = data.managedEventIds ? Array.from(new Set(data.managedEventIds)) : undefined;

    if (managedEventIds && managedEventIds.length > 0 && nextRole !== "MANAGER") {
      throw new Error("Solo los usuarios MANAGER pueden tener eventos asignados");
    }

    if (managedEventIds && managedEventIds.length > 0) {
      const existingEvents = await db.event.count({
        where: { id: { in: managedEventIds } }
      });

      if (existingEvents !== managedEventIds.length) {
        throw new Error("Hay eventos asignados que no existen");
      }
    }

    const user = await db.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
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

      if (nextRole !== "MANAGER") {
        await tx.eventManagerScope.deleteMany({ where: { userId: id } });
      } else if (managedEventIds !== undefined) {
        await tx.eventManagerScope.deleteMany({ where: { userId: id } });
        if (managedEventIds.length > 0) {
          await tx.eventManagerScope.createMany({
            data: managedEventIds.map((eventId) => ({
              userId: id,
              eventId
            })),
            skipDuplicates: true
          });
        }
      }

      return updatedUser;
    });

    if (data.isActive === false) {
      await db.session.deleteMany({ where: { userId: id } });
    }

    const managedRefs = await db.eventManagerScope.findMany({
      where: { userId: id },
      select: { eventId: true }
    });

    return NextResponse.json({
      user: {
        ...user,
        managedEventIds: managedRefs.map((item) => item.eventId)
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo actualizar usuario"
      },
      { status: 400 }
    );
  }
}
