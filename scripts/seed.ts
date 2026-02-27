import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";
import { defaultTicketTemplate } from "../lib/ticket-template";

const prisma = new PrismaClient();

async function main() {
  const superAdminUser = process.env.SEED_SUPERADMIN_USERNAME ?? process.env.SEED_ADMIN_USERNAME ?? "admin";
  const superAdminPass = process.env.SEED_SUPERADMIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD;
  const createDemoUsers = process.env.SEED_CREATE_DEMO_USERS === "true";
  const createDemoEvent =
    (process.env.SEED_CREATE_DEMO_EVENT ?? (process.env.NODE_ENV === "production" ? "false" : "true")) === "true";
  const sellerUser = process.env.SEED_SELLER_USERNAME ?? "seller";
  const sellerPass = process.env.SEED_SELLER_PASSWORD;
  const scannerUser = process.env.SEED_SCANNER_USERNAME ?? "scanner";
  const scannerPass = process.env.SEED_SCANNER_PASSWORD;

  if (!superAdminPass) {
    throw new Error("Falta SEED_SUPERADMIN_PASSWORD (o SEED_ADMIN_PASSWORD) para crear el superusuario inicial.");
  }

  await prisma.user.upsert({
    where: { username: superAdminUser.toLowerCase() },
    create: {
      username: superAdminUser.toLowerCase(),
      displayName: "Super Administrador",
      passwordHash: await hashPassword(superAdminPass),
      role: "ADMIN"
    },
    update: {
      passwordHash: await hashPassword(superAdminPass),
      role: "ADMIN"
    }
  });

  if (createDemoUsers) {
    if (!sellerPass || !scannerPass) {
      throw new Error("SEED_CREATE_DEMO_USERS=true requiere SEED_SELLER_PASSWORD y SEED_SCANNER_PASSWORD.");
    }
    await prisma.user.upsert({
      where: { username: sellerUser.toLowerCase() },
      create: {
        username: sellerUser.toLowerCase(),
        displayName: "Ventas",
        passwordHash: await hashPassword(sellerPass),
        role: "SELLER"
      },
      update: {
        passwordHash: await hashPassword(sellerPass),
        role: "SELLER"
      }
    });

    await prisma.user.upsert({
      where: { username: scannerUser.toLowerCase() },
      create: {
        username: scannerUser.toLowerCase(),
        displayName: "Check-in",
        passwordHash: await hashPassword(scannerPass),
        role: "SCANNER"
      },
      update: {
        passwordHash: await hashPassword(scannerPass),
        role: "SCANNER"
      }
    });
  }

  if (createDemoEvent) {
    const existingEvents = await prisma.event.count();
    if (existingEvents === 0) {
      const event = await prisma.event.create({
        data: {
          slug: `demo-${Date.now()}`,
          name: "Conferencia Tech 2026",
          description: "Demo inicial para sistema de venta de entradas.",
          venue: "Cordoba",
          startsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
          templateJson: defaultTicketTemplate,
          ticketTypes: {
            create: [
              {
                name: "General",
                priceCents: 25000,
                stock: 300
              },
              {
                name: "VIP",
                priceCents: 60000,
                stock: 100
              }
            ]
          }
        },
        include: {
          ticketTypes: true
        }
      });

      console.log(`Evento demo creado: ${event.id}`);
    } else {
      console.log(`Evento demo no creado: ya existen ${existingEvents} evento(s).`);
    }
  } else {
    console.log("Evento demo desactivado por configuracion (SEED_CREATE_DEMO_EVENT=false).");
  }
  console.log(`Super Admin: ${superAdminUser} / ${superAdminPass}`);
  if (createDemoUsers) {
    console.log(`Seller: ${sellerUser} / ${sellerPass}`);
    console.log(`Scanner: ${scannerUser} / ${scannerPass}`);
  } else {
    console.log("Usuarios SELLER/SCANNER no creados por seed (crearlos desde /admin/users).");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
