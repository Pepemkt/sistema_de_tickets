import QRCode from "qrcode";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { defaultTicketTemplate, type TicketTemplate } from "@/lib/ticket-template";

type TicketPdfInput = {
  eventName: string;
  venue?: string | null;
  startsAt: Date;
  ticketType: string;
  attendeeName: string;
  attendeeEmail: string;
  code: string;
  qrPayload: string;
  orderCode: string;
  quantity: number;
  purchaseDate: Date;
  template?: TicketTemplate | null;
};

type Row = [string, string];

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const value = clean.length === 3 ? clean.split("").map((char) => `${char}${char}`).join("") : clean;
  const num = Number.parseInt(value, 16);
  return {
    r: ((num >> 16) & 255) / 255,
    g: ((num >> 8) & 255) / 255,
    b: (num & 255) / 255
  };
}

function parseImageDataUrl(dataUrl: string | null | undefined) {
  if (!dataUrl) return null;

  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
  if (!match) return null;

  return {
    mime: match[1],
    data: Buffer.from(match[2], "base64")
  };
}

async function maybeEmbedImage(doc: PDFDocument, dataUrl: string | null | undefined): Promise<PDFImage | null> {
  const parsed = parseImageDataUrl(dataUrl);
  if (!parsed) return null;
  return parsed.mime === "png" ? doc.embedPng(parsed.data) : doc.embedJpg(parsed.data);
}

function drawBackgroundLayer(page: PDFPage, width: number, height: number, template: TicketTemplate) {
  const bg = hexToRgb(template.backgroundColor);
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: rgb(bg.r, bg.g, bg.b)
  });
}

function drawRows(page: PDFPage, rows: Row[], options: { x: number; y: number; labelWidth: number; lineGap: number; font: PDFFont; fontBold: PDFFont }) {
  let y = options.y;
  for (const [label, value] of rows) {
    page.drawText(label.toUpperCase(), {
      x: options.x,
      y,
      size: 9,
      font: options.fontBold,
      color: rgb(0.37, 0.45, 0.6)
    });
    page.drawText(value, {
      x: options.x + options.labelWidth,
      y,
      size: 12,
      font: options.font,
      color: rgb(0.1, 0.15, 0.24)
    });
    y -= options.lineGap;
  }
}

function drawQrLabel(page: PDFPage, label: string, x: number, y: number, fontBold: PDFFont, accentColor: { r: number; g: number; b: number }) {
  page.drawText(label, {
    x,
    y,
    size: 10,
    font: fontBold,
    color: rgb(accentColor.r, accentColor.g, accentColor.b)
  });
}

type LayoutInput = {
  page: PDFPage;
  width: number;
  height: number;
  font: PDFFont;
  fontBold: PDFFont;
  qrImage: PDFImage;
  logoImage: PDFImage | null;
  backgroundImage: PDFImage | null;
  template: TicketTemplate;
  rows: Row[];
  input: TicketPdfInput;
};

function drawHorizontalLayout(payload: LayoutInput) {
  const { page, width, height, font, fontBold, qrImage, logoImage, backgroundImage, template, rows, input } = payload;
  const accentColor = hexToRgb(template.accentColor);

  if (backgroundImage) {
    page.drawImage(backgroundImage, {
      x: 0,
      y: 0,
      width,
      height,
      opacity: 0.2
    });
  }

  page.drawRectangle({
    x: 28,
    y: 20,
    width: width - 56,
    height: height - 40,
    color: rgb(1, 1, 1),
    opacity: 0.92
  });

  page.drawRectangle({
    x: 28,
    y: height - 106,
    width: width - 56,
    height: 86,
    color: rgb(accentColor.r, accentColor.g, accentColor.b)
  });

  page.drawText(template.headerText, {
    x: 52,
    y: height - 66,
    size: 24,
    font: fontBold,
    color: rgb(1, 1, 1)
  });

  page.drawText("Entrada Digital", {
    x: 52,
    y: height - 88,
    size: 11,
    font,
    color: rgb(0.9, 0.94, 1)
  });

  if (logoImage) {
    page.drawImage(logoImage, {
      x: width - 170,
      y: height - 95,
      width: 120,
      height: 58
    });
  }

  page.drawText(input.eventName, {
    x: 52,
    y: height - 132,
    size: 22,
    font: fontBold,
    color: rgb(0.08, 0.12, 0.2)
  });

  drawRows(page, rows, {
    x: 52,
    y: height - 166,
    labelWidth: 80,
    lineGap: 26,
    font,
    fontBold
  });

  page.drawRectangle({
    x: width - 300,
    y: 96,
    width: 230,
    height: 230,
    color: rgb(0.96, 0.98, 1)
  });
  page.drawImage(qrImage, {
    x: width - 286,
    y: 110,
    width: 202,
    height: 202
  });
  drawQrLabel(page, "VALIDACION QR", width - 254, 82, fontBold, accentColor);

  page.drawRectangle({
    x: 28,
    y: 20,
    width: width - 56,
    height: 36,
    color: rgb(0.95, 0.97, 1)
  });
  page.drawText(template.footerText, {
    x: 52,
    y: 33,
    size: 11,
    font,
    color: rgb(0.27, 0.34, 0.48)
  });
}

function drawVerticalLayout(payload: LayoutInput) {
  const { page, width, height, font, fontBold, qrImage, logoImage, backgroundImage, template, rows, input } = payload;
  const accentColor = hexToRgb(template.accentColor);

  if (backgroundImage) {
    page.drawImage(backgroundImage, {
      x: 0,
      y: 0,
      width,
      height,
      opacity: 0.18
    });
  }

  const cardX = 22;
  const cardY = 22;
  const cardW = width - 44;
  const cardH = height - 44;

  page.drawRectangle({
    x: cardX,
    y: cardY,
    width: cardW,
    height: cardH,
    color: rgb(1, 1, 1),
    opacity: 0.94
  });

  page.drawRectangle({
    x: cardX,
    y: cardY + cardH - 96,
    width: cardW,
    height: 96,
    color: rgb(accentColor.r, accentColor.g, accentColor.b)
  });

  page.drawText(template.headerText, {
    x: cardX + 20,
    y: cardY + cardH - 54,
    size: 22,
    font: fontBold,
    color: rgb(1, 1, 1)
  });
  page.drawText("Entrada Digital", {
    x: cardX + 20,
    y: cardY + cardH - 74,
    size: 10,
    font,
    color: rgb(0.88, 0.94, 1)
  });

  if (logoImage) {
    page.drawImage(logoImage, {
      x: cardX + cardW - 120,
      y: cardY + cardH - 84,
      width: 94,
      height: 42
    });
  }

  page.drawText(input.eventName, {
    x: cardX + 20,
    y: cardY + cardH - 132,
    size: 20,
    font: fontBold,
    color: rgb(0.08, 0.12, 0.2)
  });

  const detailBoxY = cardY + 292;
  page.drawRectangle({
    x: cardX + 16,
    y: detailBoxY,
    width: cardW - 32,
    height: 226,
    color: rgb(0.97, 0.98, 1)
  });

  drawRows(page, rows, {
    x: cardX + 30,
    y: detailBoxY + 196,
    labelWidth: 78,
    lineGap: 22,
    font,
    fontBold
  });

  const qrSize = 224;
  const qrX = cardX + (cardW - qrSize) / 2;
  const qrY = cardY + 68;

  page.drawRectangle({
    x: qrX - 10,
    y: qrY - 10,
    width: qrSize + 20,
    height: qrSize + 30,
    color: rgb(0.96, 0.98, 1)
  });
  page.drawImage(qrImage, {
    x: qrX,
    y: qrY,
    width: qrSize,
    height: qrSize
  });
  drawQrLabel(page, "VALIDACION QR", qrX + 44, qrY - 20, fontBold, accentColor);

  page.drawText(template.footerText, {
    x: cardX + 20,
    y: cardY + 28,
    size: 10.5,
    font,
    color: rgb(0.27, 0.34, 0.48)
  });
}

function drawVerticalCompactLayout(payload: LayoutInput) {
  const { page, width, height, font, fontBold, qrImage, logoImage, backgroundImage, template, rows, input } = payload;
  const accentColor = hexToRgb(template.accentColor);

  if (backgroundImage) {
    page.drawImage(backgroundImage, {
      x: 0,
      y: 0,
      width,
      height,
      opacity: 0.16
    });
  }

  const cardX = 18;
  const cardY = 18;
  const cardW = width - 36;
  const cardH = height - 36;

  page.drawRectangle({
    x: cardX,
    y: cardY,
    width: cardW,
    height: cardH,
    color: rgb(1, 1, 1),
    opacity: 0.94
  });

  page.drawRectangle({
    x: cardX,
    y: cardY + cardH - 82,
    width: cardW,
    height: 82,
    color: rgb(accentColor.r, accentColor.g, accentColor.b)
  });

  page.drawText(template.headerText, {
    x: cardX + 16,
    y: cardY + cardH - 49,
    size: 17,
    font: fontBold,
    color: rgb(1, 1, 1)
  });

  if (logoImage) {
    page.drawImage(logoImage, {
      x: cardX + cardW - 98,
      y: cardY + cardH - 72,
      width: 76,
      height: 34
    });
  }

  page.drawText(input.eventName, {
    x: cardX + 16,
    y: cardY + cardH - 110,
    size: 16,
    font: fontBold,
    color: rgb(0.08, 0.12, 0.2)
  });

  const detailBoxY = cardY + 250;
  page.drawRectangle({
    x: cardX + 12,
    y: detailBoxY,
    width: cardW - 24,
    height: 188,
    color: rgb(0.97, 0.98, 1)
  });

  drawRows(page, rows.slice(0, 7), {
    x: cardX + 22,
    y: detailBoxY + 160,
    labelWidth: 68,
    lineGap: 20,
    font,
    fontBold
  });

  const qrSize = 178;
  const qrX = cardX + (cardW - qrSize) / 2;
  const qrY = cardY + 56;

  page.drawRectangle({
    x: qrX - 10,
    y: qrY - 10,
    width: qrSize + 20,
    height: qrSize + 28,
    color: rgb(0.96, 0.98, 1)
  });
  page.drawImage(qrImage, {
    x: qrX,
    y: qrY,
    width: qrSize,
    height: qrSize
  });
  drawQrLabel(page, "VALIDACION QR", qrX + 30, qrY - 18, fontBold, accentColor);

  page.drawText(template.footerText, {
    x: cardX + 16,
    y: cardY + 26,
    size: 9.8,
    font,
    color: rgb(0.27, 0.34, 0.48)
  });
}

export async function generateTicketPdf(input: TicketPdfInput) {
  const template = {
    ...defaultTicketTemplate,
    ...(input.template ?? {})
  };

  const dimensions =
    template.layout === "VERTICAL"
      ? [430, 760]
      : template.layout === "VERTICAL_COMPACT"
        ? [390, 620]
        : [842, 420];

  const doc = await PDFDocument.create();
  const page = doc.addPage(dimensions);
  const { width, height } = page.getSize();

  drawBackgroundLayer(page, width, height, template);

  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const backgroundImage = await maybeEmbedImage(doc, template.backgroundImageDataUrl);
  const logoImage = await maybeEmbedImage(doc, template.logoImageDataUrl);

  const eventDate = new Intl.DateTimeFormat("es-AR", {
    dateStyle: "full",
    timeStyle: "short"
  }).format(input.startsAt);

  const purchaseDate = new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(input.purchaseDate);

  const rows: Row[] = [
    ["Titular", input.attendeeName],
    ["Email", input.attendeeEmail],
    ["Tipo", input.ticketType],
    ["Fecha", eventDate],
    ["Lugar", input.venue ?? "Por confirmar"],
    ["Orden", input.orderCode],
    ["Cantidad", String(input.quantity)],
    ["Codigo", input.code],
    ["Emitido", purchaseDate]
  ];

  const qrDataUrl = await QRCode.toDataURL(input.qrPayload, {
    width: 520,
    margin: 1
  });
  const qrPng = Buffer.from(qrDataUrl.replace(/^data:image\/png;base64,/, ""), "base64");
  const qrImage = await doc.embedPng(qrPng);

  const payload: LayoutInput = {
    page,
    width,
    height,
    font,
    fontBold,
    qrImage,
    logoImage,
    backgroundImage,
    template,
    rows,
    input
  };

  if (template.layout === "VERTICAL") {
    drawVerticalLayout(payload);
  } else if (template.layout === "VERTICAL_COMPACT") {
    drawVerticalCompactLayout(payload);
  } else {
    drawHorizontalLayout(payload);
  }

  return Buffer.from(await doc.save());
}

