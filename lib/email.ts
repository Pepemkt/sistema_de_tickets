import nodemailer from "nodemailer";
import { generateTicketPdf } from "@/lib/pdf";
import { buildEmailTemplateVariables, renderEmailTemplate } from "@/lib/email-template";
import { resolveEmailTemplateConfig, resolveSmtpConfig } from "@/lib/platform-config";
import { getPaidOrderWithTickets } from "@/lib/tickets";
import { normalizeTicketTemplate } from "@/lib/ticket-template";
import { db } from "@/lib/db";

type PaidOrderWithTickets = NonNullable<Awaited<ReturnType<typeof getPaidOrderWithTickets>>>;
type PaidOrderTicket = PaidOrderWithTickets["tickets"][number];

function explainSmtpError(error: unknown, context: { host: string; port: number; secure: boolean }) {
  const raw = error instanceof Error ? error.message : "Error SMTP desconocido";
  const lower = raw.toLowerCase();

  if (lower.includes("greeting never received")) {
    return `SMTP no envio saludo inicial. Revisa host/puerto/secure (${context.host}:${context.port}, secure=${context.secure}).`;
  }

  if (lower.includes("self signed certificate") || lower.includes("certificate")) {
    return `Error de certificado TLS en SMTP (${context.host}:${context.port}). Revisa SSL/TLS del proveedor.`;
  }

  if (lower.includes("wrong version number")) {
    return `Handshake TLS invalido en SMTP (${context.host}:${context.port}, secure=${context.secure}). Revisa combinacion puerto/SSL (465->secure=true, 587->secure=false).`;
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatEventDate(value: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "full",
    timeStyle: "short"
  }).format(new Date(value));
}

async function buildTicketAttachment(order: PaidOrderWithTickets, ticket: PaidOrderTicket) {
  const template = normalizeTicketTemplate(order.event.templateJson);
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
}

function buildInvitationEmail(input: {
  attendeeName: string;
  eventName: string;
  startsAt: Date;
  venue: string | null;
  orderId: string;
  supportEmail: string;
}) {
  const eventDate = formatEventDate(input.startsAt);
  const safeName = escapeHtml(input.attendeeName);
  const safeEvent = escapeHtml(input.eventName);
  const safeVenue = escapeHtml(input.venue || "A confirmar");
  const safeOrder = escapeHtml(input.orderId);
  const safeSupport = escapeHtml(input.supportEmail);

  return {
    subject: `Tu invitacion para ${input.eventName}`,
    html: `
<div style="background:#f8fafc;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
    <tr>
      <td style="background:linear-gradient(135deg,#0f172a,#7c3aed);padding:28px 24px;color:#ffffff;">
        <p style="margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.85;">Invitacion confirmada</p>
        <h1 style="margin:8px 0 0;font-size:24px;line-height:1.2;">Tu entrada ya esta lista</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:24px;">
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#1e293b;">Hola ${safeName},</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1e293b;">
          Te enviamos tu ticket de invitacion para <strong>${safeEvent}</strong>. Encontraras el PDF adjunto con el QR listo para validacion en acceso.
        </p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 18px;background:#faf5ff;border:1px solid #e9d5ff;border-radius:12px;">
          <tr><td style="padding:14px 16px 4px;font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#6b21a8;">Detalle</td></tr>
          <tr><td style="padding:6px 16px;font-size:14px;color:#0f172a;"><strong>Evento:</strong> ${safeEvent}</td></tr>
          <tr><td style="padding:6px 16px;font-size:14px;color:#0f172a;"><strong>Fecha:</strong> ${escapeHtml(eventDate)}</td></tr>
          <tr><td style="padding:6px 16px;font-size:14px;color:#0f172a;"><strong>Lugar:</strong> ${safeVenue}</td></tr>
          <tr><td style="padding:6px 16px 14px;font-size:14px;color:#0f172a;"><strong>Referencia:</strong> ${safeOrder}</td></tr>
        </table>
        <p style="margin:0;font-size:13px;line-height:1.55;color:#475569;">Si necesitas ayuda, responde a este email o escribinos a ${safeSupport}.</p>
      </td>
    </tr>
  </table>
</div>`.trim()
  };
}

export async function sendOrderTicketsEmail(orderId: string, options?: { trigger?: string }) {
  const order = await getPaidOrderWithTickets(orderId);
  if (!order || order.tickets.length === 0) {
    return;
  }

  const trigger = options?.trigger?.trim() || "SYSTEM";

  try {
    const { transporter, from } = await createTransporter();
    const emailTemplate = await resolveEmailTemplateConfig();
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
      order.tickets.map((ticket) => buildTicketAttachment(order, ticket))
    );

    const info = await transporter.sendMail({
      messageId: `<tickets-${order.id}@aiderbrand.local>`,
      from,
      to: order.buyerEmail,
      subject: rendered.subject,
      html: rendered.html,
      attachments
    });

    await db.emailDeliveryLog.create({
      data: {
        orderId: order.id,
        eventId: order.eventId,
        recipientEmail: order.buyerEmail,
        status: "SENT",
        trigger,
        providerMessageId: typeof info.messageId === "string" ? info.messageId : null
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo enviar email";
    try {
      await db.emailDeliveryLog.create({
        data: {
          orderId: order.id,
          eventId: order.eventId,
          recipientEmail: order.buyerEmail,
          status: "FAILED",
          trigger,
          errorMessage: message
        }
      });
    } catch {
      // Ignore logging errors to preserve original failure context.
    }

    throw error;
  }
}

export async function sendInvitationTicketEmails(orderId: string, options?: { trigger?: string }) {
  const order = await getPaidOrderWithTickets(orderId);
  if (!order || order.tickets.length === 0) {
    return [];
  }

  const trigger = options?.trigger?.trim() || "INVITATION";

  let transporter: Awaited<ReturnType<typeof createTransporter>>["transporter"] | null = null;
  let from = "";

  try {
    const transport = await createTransporter();
    transporter = transport.transporter;
    from = transport.from;
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo enviar email";
    await Promise.all(
      order.tickets.map((ticket) =>
        db.emailDeliveryLog.create({
          data: {
            orderId: order.id,
            eventId: order.eventId,
            recipientEmail: ticket.attendeeEmail,
            status: "FAILED",
            trigger,
            errorMessage: message
          }
        }).catch(() => undefined)
      )
    );

    return order.tickets.map((ticket) => ({
      ticketId: ticket.id,
      attendeeName: ticket.attendeeName,
      recipientEmail: ticket.attendeeEmail,
      status: "FAILED" as const,
      errorMessage: message
    }));
  }

  const results: Array<{
    ticketId: string;
    attendeeName: string;
    recipientEmail: string;
    status: "SENT" | "FAILED";
    errorMessage: string | null;
  }> = [];

  for (const ticket of order.tickets) {
    try {
      const attachment = await buildTicketAttachment(order, ticket);
      const rendered = buildInvitationEmail({
        attendeeName: ticket.attendeeName,
        eventName: ticket.event.name,
        startsAt: ticket.event.startsAt,
        venue: ticket.event.venue,
        orderId: order.id,
        supportEmail: from
      });

      const info = await transporter.sendMail({
        messageId: `<invitation-${ticket.id}@aiderbrand.local>`,
        from,
        to: ticket.attendeeEmail,
        subject: rendered.subject,
        html: rendered.html,
        attachments: [attachment]
      });

      await db.emailDeliveryLog.create({
        data: {
          orderId: order.id,
          eventId: order.eventId,
          recipientEmail: ticket.attendeeEmail,
          status: "SENT",
          trigger,
          providerMessageId: typeof info.messageId === "string" ? info.messageId : null
        }
      });

      results.push({
        ticketId: ticket.id,
        attendeeName: ticket.attendeeName,
        recipientEmail: ticket.attendeeEmail,
        status: "SENT",
        errorMessage: null
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo enviar email";

      try {
        await db.emailDeliveryLog.create({
          data: {
            orderId: order.id,
            eventId: order.eventId,
            recipientEmail: ticket.attendeeEmail,
            status: "FAILED",
            trigger,
            errorMessage: message
          }
        });
      } catch {
        // Ignore logging errors to preserve original failure context.
      }

      results.push({
        ticketId: ticket.id,
        attendeeName: ticket.attendeeName,
        recipientEmail: ticket.attendeeEmail,
        status: "FAILED",
        errorMessage: message
      });
    }
  }

  return results;
}
