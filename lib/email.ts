import nodemailer from "nodemailer";
import { generateTicketPdf } from "@/lib/pdf";
import { buildEmailTemplateVariables, renderEmailTemplate } from "@/lib/email-template";
import { resolveEmailTemplateConfig, resolveSmtpConfig } from "@/lib/platform-config";
import { getPaidOrderWithTickets } from "@/lib/tickets";
import { normalizeTicketTemplate } from "@/lib/ticket-template";

function explainSmtpError(error: unknown, context: { host: string; port: number; secure: boolean }) {
  const raw = error instanceof Error ? error.message : "Error SMTP desconocido";
  const lower = raw.toLowerCase();

  if (lower.includes("greeting never received")) {
    return `SMTP no envio saludo inicial. Revisa host/puerto/secure (${context.host}:${context.port}, secure=${context.secure}).`;
  }

  if (lower.includes("self signed certificate") || lower.includes("certificate")) {
    return `Error de certificado TLS en SMTP (${context.host}:${context.port}). Revisa SSL/TLS del proveedor.`;
  }

  if (lower.includes("authentication") || lower.includes("auth")) {
    return "Credenciales SMTP invalidas (usuario/password).";
  }

  if (lower.includes("enotfound") || lower.includes("eai_again")) {
    return `No se puede resolver el host SMTP (${context.host}).`;
  }

  if (lower.includes("etimedout") || lower.includes("timeout")) {
    return `Timeout al conectar SMTP (${context.host}:${context.port}).`;
  }

  return raw;
}

async function createTransporter() {
  const smtp = await resolveSmtpConfig();
  const { host, port, user, pass, from } = smtp;

  if (!host || !user || !pass || !from) {
    throw new Error("SMTP no configurado correctamente");
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: smtp.secure,
      auth: { user, pass },
      connectionTimeout: 12_000,
      greetingTimeout: 12_000,
      socketTimeout: 20_000
    });

    await transporter.verify();

    return {
      transporter,
      from
    };
  } catch (error) {
    throw new Error(explainSmtpError(error, { host, port, secure: smtp.secure }));
  }
}

export async function sendOrderTicketsEmail(orderId: string) {
  const order = await getPaidOrderWithTickets(orderId);
  if (!order || order.tickets.length === 0) {
    return;
  }

  const { transporter, from } = await createTransporter();
  const emailTemplate = await resolveEmailTemplateConfig();
  const template = normalizeTicketTemplate(order.event.templateJson);
  const variables = buildEmailTemplateVariables({
    buyerName: order.buyerName,
    buyerEmail: order.buyerEmail,
    eventName: order.event.name,
    startsAt: order.event.startsAt,
    venue: order.event.venue,
    orderId: order.id,
    quantity: order.quantity,
    ticketCount: order.tickets.length,
    totalCents: order.totalCents,
    supportEmail: from
  });
  const rendered = renderEmailTemplate(emailTemplate, variables);

  const attachments = await Promise.all(
    order.tickets.map(async (ticket) => {
      const pdf = await generateTicketPdf({
        eventName: ticket.event.name,
        venue: ticket.event.venue,
        startsAt: ticket.event.startsAt,
        ticketType: ticket.ticketType.name,
        attendeeName: ticket.attendeeName,
        attendeeEmail: ticket.attendeeEmail,
        code: ticket.code,
        qrPayload: ticket.qrPayload,
        orderCode: order.id,
        quantity: order.quantity,
        purchaseDate: order.createdAt,
        template
      });

      return {
        filename: `entrada-${ticket.code}.pdf`,
        content: pdf,
        contentType: "application/pdf"
      };
    })
  );

  await transporter.sendMail({
    messageId: `<tickets-${order.id}@aiderbrand.local>`,
    from,
    to: order.buyerEmail,
    subject: rendered.subject,
    html: rendered.html,
    attachments
  });
}
