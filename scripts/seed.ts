import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";
import { defaultTicketTemplate } from "../lib/ticket-template";

const prisma = new PrismaClient();

async function main() {
  const adminUser = process.env.SEED_ADMIN_USERNAME ?? "admin";
  const adminPass = process.env.SEED_ADMIN_PASSWORD ?? "admin1234";
  const sellerUser = process.env.SEED_SELLER_USERNAME ?? "seller";
  const sellerPass = process.env.SEED_SELLER_PASSWORD ?? "seller1234";
  const scannerUser = process.env.SEED_SCANNER_USERNAME ?? "scanner";
  const scannerPass = process.env.SEED_SCANNER_PASSWORD ?? "scanner1234";

  await prisma.user.upsert({
    where: { username: adminUser.toLowerCase() },
    create: {
      username: adminUser.toLowerCase(),
      displayName: "Administrador",
      passwordHash: await hashPassword(adminPass),
      role: "ADMIN"
    },
    update: {
      passwordHash: await hashPassword(adminPass),
      role: "ADMIN"
    }
  });

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
  console.log(`Admin: ${adminUser} / ${adminPass}`);
  console.log(`Seller: ${sellerUser} / ${sellerPass}`);
  console.log(`Scanner: ${scannerUser} / ${scannerPass}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
