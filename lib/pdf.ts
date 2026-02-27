import QRCode from "qrcode";
import {
  PDFDocument,
  clip,
  endPath,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  StandardFonts,
  type PDFFont,
  type PDFImage,
  type PDFPage
} from "pdf-lib";
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

type ImageBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ImageTransform = {
  zoom?: number;
  offsetX?: number;
  offsetY?: number;
  opacity?: number;
};

type DrawRowsOptions = {
  x: number;
  y: number;
  labelWidth: number;
  maxValueWidth: number;
  lineHeight: number;
  rowGap: number;
  labelSize: number;
  valueSize: number;
  maxLinesPerValue: number;
  font: PDFFont;
  fontBold: PDFFont;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

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

function truncateTextToWidth(text: string, font: PDFFont, size: number, maxWidth: number) {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  const ellipsis = "...";
  let result = text;
  while (result.length > 0 && font.widthOfTextAtSize(`${result}${ellipsis}`, size) > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}${ellipsis}`;
}

function wrapTextToWidth(text: string, font: PDFFont, size: number, maxWidth: number, maxLines: number) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [""];

  const words = cleaned.split(" ");
  const lines: string[] = [];
  let current = words[0] ?? "";

  for (let i = 1; i < words.length; i += 1) {
    const candidate = `${current} ${words[i]}`;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);

  if (lines.length <= maxLines) {
    return lines.map((line) => truncateTextToWidth(line, font, size, maxWidth));
  }

  const kept = lines.slice(0, maxLines - 1);
  const overflow = lines.slice(maxLines - 1).join(" ");
  kept.push(truncateTextToWidth(overflow, font, size, maxWidth));
  return kept;
}

function drawRoundedRect(page: PDFPage, box: ImageBox, radius: number, color: { r: number; g: number; b: number }, opacity = 1) {
  const r = Math.max(0, Math.min(radius, box.width / 2, box.height / 2));
  const fillColor = rgb(color.r, color.g, color.b);

  if (r === 0) {
    page.drawRectangle({
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
      color: fillColor,
      opacity
    });
    return;
  }

  page.drawRectangle({
    x: box.x + r,
    y: box.y,
    width: box.width - r * 2,
    height: box.height,
    color: fillColor,
    opacity
  });
  page.drawRectangle({
    x: box.x,
    y: box.y + r,
    width: box.width,
    height: box.height - r * 2,
    color: fillColor,
    opacity
  });

  page.drawEllipse({ x: box.x + r, y: box.y + r, xScale: r, yScale: r, color: fillColor, opacity });
  page.drawEllipse({ x: box.x + box.width - r, y: box.y + r, xScale: r, yScale: r, color: fillColor, opacity });
  page.drawEllipse({ x: box.x + r, y: box.y + box.height - r, xScale: r, yScale: r, color: fillColor, opacity });
  page.drawEllipse({
    x: box.x + box.width - r,
    y: box.y + box.height - r,
    xScale: r,
    yScale: r,
    color: fillColor,
    opacity
  });
}

function drawImageCover(page: PDFPage, image: PDFImage, box: ImageBox, transform: ImageTransform = {}) {
  const zoom = clamp(transform.zoom ?? 1, 1, 3);
  const offsetX = clamp(transform.offsetX ?? 0, -100, 100);
  const offsetY = clamp(transform.offsetY ?? 0, -100, 100);
  const opacity = transform.opacity === undefined ? 1 : clamp(transform.opacity, 0, 1);

  const baseScale = Math.max(box.width / image.width, box.height / image.height);
  const scaledWidth = image.width * baseScale * zoom;
  const scaledHeight = image.height * baseScale * zoom;

  const xPercent = (offsetX + 100) / 2;
  const yPercent = (100 - offsetY) / 2;
  const drawX = box.x + (box.width - scaledWidth) * (xPercent / 100);
  const drawY = box.y + (box.height - scaledHeight) * (yPercent / 100);

  page.pushOperators(pushGraphicsState(), rectangle(box.x, box.y, box.width, box.height), clip(), endPath());
  page.drawImage(image, {
    x: drawX,
    y: drawY,
    width: scaledWidth,
    height: scaledHeight,
    opacity
  });
  page.pushOperators(popGraphicsState());
}

function drawBackgroundLayer(page: PDFPage, width: number, height: number, template: TicketTemplate, backgroundImage: PDFImage | null) {
  if (backgroundImage) {
    drawImageCover(
      page,
      backgroundImage,
      { x: 0, y: 0, width, height },
      {
        zoom: template.backgroundImageZoom,
        offsetX: template.backgroundImageOffsetX,
        offsetY: template.backgroundImageOffsetY
      }
    );
  }

  const bg = hexToRgb(template.backgroundColor);
  const overlayOpacity = backgroundImage ? clamp(template.backgroundOverlayOpacity ?? 0.82, 0, 1) : 1;
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: rgb(bg.r, bg.g, bg.b),
    opacity: overlayOpacity
  });
}

function drawRows(page: PDFPage, rows: Row[], options: DrawRowsOptions) {
  let y = options.y;

  for (const [label, value] of rows) {
    const valueLines = wrapTextToWidth(value, options.font, options.valueSize, options.maxValueWidth, options.maxLinesPerValue);

    page.drawText(label.toUpperCase(), {
      x: options.x,
      y,
      size: options.labelSize,
      font: options.fontBold,
      color: rgb(0.34, 0.44, 0.62)
    });

    for (let i = 0; i < valueLines.length; i += 1) {
      page.drawText(valueLines[i], {
        x: options.x + options.labelWidth,
        y: y - i * options.lineHeight,
        size: options.valueSize,
        font: options.font,
        color: rgb(0.12, 0.17, 0.28)
      });
    }

    y -= Math.max(1, valueLines.length) * options.lineHeight + options.rowGap;
  }
}

function drawWrappedText(
  page: PDFPage,
  text: string,
  options: {
    x: number;
    y: number;
    maxWidth: number;
    maxLines: number;
    lineHeight: number;
    size: number;
    font: PDFFont;
    color: { r: number; g: number; b: number };
  }
) {
  const lines = wrapTextToWidth(text, options.font, options.size, options.maxWidth, options.maxLines);
  for (let i = 0; i < lines.length; i += 1) {
    page.drawText(lines[i], {
      x: options.x,
      y: options.y - i * options.lineHeight,
      size: options.size,
      font: options.font,
      color: rgb(options.color.r, options.color.g, options.color.b)
    });
  }
}

function drawQrLabel(page: PDFPage, label: string, centerX: number, y: number, fontBold: PDFFont, accentColor: { r: number; g: number; b: number }) {
  const size = 10;
  const textWidth = fontBold.widthOfTextAtSize(label, size);
  page.drawText(label, {
    x: centerX - textWidth / 2,
    y,
    size,
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
  template: TicketTemplate;
  rows: Row[];
  input: TicketPdfInput;
};

function drawHorizontalLayout(payload: LayoutInput) {
  const { page, width, height, font, fontBold, qrImage, logoImage, template, rows, input } = payload;
  const accentColor = hexToRgb(template.accentColor);

  const card = { x: 28, y: 20, width: width - 56, height: height - 40 };
  const header = { x: card.x + 14, y: card.y + card.height - 102, width: card.width - 28, height: 86 };
  const detail = { x: card.x + 18, y: card.y + 72, width: card.width - 290, height: 220 };
  const qrWrap = { x: card.x + card.width - 250, y: card.y + 72, width: 220, height: 250 };
  const footer = { x: card.x + 18, y: card.y + 18, width: card.width - 36, height: 44 };
  const logoBox = { x: header.x + header.width - 70, y: header.y + 15, width: 56, height: 56 };

  drawRoundedRect(page, card, 18, { r: 1, g: 1, b: 1 }, 1);
  drawRoundedRect(page, header, 12, accentColor);
  drawRoundedRect(page, detail, 12, { r: 0.96, g: 0.97, b: 1 });
  drawRoundedRect(page, qrWrap, 12, { r: 0.96, g: 0.97, b: 1 });
  drawRoundedRect(page, footer, 10, { r: 0.95, g: 0.97, b: 1 });

  page.drawText("ENTRADA OFICIAL", {
    x: header.x + 18,
    y: header.y + 58,
    size: 10,
    font,
    color: rgb(0.9, 0.94, 1)
  });
  page.drawText(truncateTextToWidth(template.headerText.toUpperCase(), fontBold, 23, header.width - 100), {
    x: header.x + 18,
    y: header.y + 30,
    size: 23,
    font: fontBold,
    color: rgb(1, 1, 1)
  });

  if (logoImage) {
    drawImageCover(page, logoImage, logoBox, {
      zoom: template.logoImageZoom,
      offsetX: template.logoImageOffsetX,
      offsetY: template.logoImageOffsetY
    });
  }

  page.drawText(truncateTextToWidth(input.eventName.toUpperCase(), fontBold, 22, detail.width - 24), {
    x: detail.x + 12,
    y: detail.y + detail.height - 35,
    size: 22,
    font: fontBold,
    color: rgb(0.1, 0.14, 0.24)
  });

  drawRows(page, rows, {
    x: detail.x + 12,
    y: detail.y + detail.height - 68,
    labelWidth: 86,
    maxValueWidth: detail.width - 104,
    lineHeight: 15,
    rowGap: 7,
    labelSize: 9,
    valueSize: 12,
    maxLinesPerValue: 2,
    font,
    fontBold
  });

  const qrSize = 174;
  const qrX = qrWrap.x + (qrWrap.width - qrSize) / 2;
  const qrY = qrWrap.y + 52;
  const qrCenterX = qrX + qrSize / 2;
  page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });
  drawQrLabel(page, "VALIDACION QR", qrCenterX, qrWrap.y + 28, fontBold, accentColor);

  drawWrappedText(page, template.footerText, {
    x: footer.x + 12,
    y: footer.y + 24,
    maxWidth: footer.width - 24,
    maxLines: 2,
    lineHeight: 12,
    size: 10.5,
    font,
    color: { r: 0.27, g: 0.34, b: 0.48 }
  });
}

function drawVerticalLayout(payload: LayoutInput) {
  const { page, width, height, font, fontBold, qrImage, logoImage, template, rows, input } = payload;
  const accentColor = hexToRgb(template.accentColor);

  // Proporciones replicadas del arte de referencia (488x820) escaladas al tamaño actual.
  // Igual que en VERTICAL_COMPACT: bloque superior (header) y flujo descendente.
  const sx = width / 488;
  const sy = height / 820;

  const card = { x: 20 * sx, y: 10 * sy, width: 448 * sx, height: 780 * sy };
  const headerTopInset = 24 * sy;
  const header = {
    x: 44 * sx,
    y: card.y + card.height - headerTopInset - 91 * sy,
    width: 400 * sx,
    height: 91 * sy
  };
  const gap = 10 * sy;
  const detail = { x: 44 * sx, y: 0, width: 400 * sx, height: 321 * sy };
  detail.y = header.y - gap - detail.height;

  const qrWrap = { x: 44 * sx, y: 0, width: 400 * sx, height: 227.18 * sy };
  qrWrap.y = detail.y - gap - qrWrap.height;

  const footer = { x: 43 * sx, y: 0, width: 400 * sx, height: 48.25 * sy };
  footer.y = qrWrap.y - gap - footer.height;
  const logoBox = {
    x: header.x + header.width - 76 * sx,
    y: header.y + 20 * sy,
    width: 56 * sx,
    height: 49 * sy
  };

  drawRoundedRect(page, card, 32 * sx, { r: 1, g: 1, b: 1 }, 1);
  drawRoundedRect(page, header, 16 * sx, accentColor);
  drawRoundedRect(page, detail, 16 * sx, { r: 0.96, g: 0.97, b: 1 }, 0.92);
  drawRoundedRect(page, qrWrap, 16 * sx, { r: 0.96, g: 0.97, b: 1 }, 0.95);
  drawRoundedRect(page, footer, 16 * sx, { r: 0.95, g: 0.97, b: 1 }, 0.8);

  page.drawText("ENTRADA OFICIAL", {
    x: header.x + 20 * sx,
    y: header.y + header.height - 30 * sy,
    size: 10 * sx,
    font,
    color: rgb(0.9, 0.94, 1)
  });
  page.drawText(truncateTextToWidth(template.headerText.toUpperCase(), fontBold, 14 * sx, header.width - 90 * sx), {
    x: header.x + 20 * sx,
    y: header.y + 25 * sy,
    size: 14 * sx,
    font: fontBold,
    color: rgb(1, 1, 1)
  });

  if (logoImage) {
    drawImageCover(page, logoImage, logoBox, {
      zoom: template.logoImageZoom,
      offsetX: template.logoImageOffsetX,
      offsetY: template.logoImageOffsetY
    });
  }

  page.drawText(truncateTextToWidth(input.eventName.toUpperCase(), fontBold, 17, detail.width - 24), {
    x: detail.x + 24 * sx,
    y: detail.y + detail.height - 48 * sy,
    size: 24 * sx,
    font: fontBold,
    color: rgb(0.1, 0.14, 0.24)
  });

  page.drawRectangle({
    x: detail.x + 24 * sx,
    y: detail.y + detail.height - 63 * sy,
    width: detail.width - 48 * sx,
    height: 1 * sy,
    color: rgb(0.88, 0.91, 0.95)
  });

  drawRows(page, rows, {
    x: detail.x + 24 * sx,
    y: detail.y + detail.height - 100 * sy,
    labelWidth: 118 * sx,
    maxValueWidth: detail.width - 160 * sx,
    lineHeight: 18 * sy,
    rowGap: 8 * sy,
    labelSize: 9.5 * sx,
    valueSize: 12.8 * sx,
    maxLinesPerValue: 2,
    font,
    fontBold
  });

  const qrSize = 159 * sx;
  const qrX = qrWrap.x + (qrWrap.width - qrSize) / 2;
  const qrY = qrWrap.y + 24.5 * sy;
  const qrCenterX = qrX + qrSize / 2;
  page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });
  drawQrLabel(page, "VALIDACION QR", qrCenterX, qrWrap.y + 24 * sy, fontBold, { r: 0.58, g: 0.64, b: 0.72 });

  drawWrappedText(page, template.footerText, {
    x: footer.x + 14 * sx,
    y: footer.y + 16 * sy,
    maxWidth: footer.width - 28 * sx,
    maxLines: 1,
    lineHeight: 12 * sy,
    size: 10.5 * sx,
    font,
    color: { r: 0.27, g: 0.34, b: 0.48 }
  });
}

function drawVerticalCompactLayout(payload: LayoutInput) {
  const { page, width, height, font, fontBold, qrImage, logoImage, template, rows, input } = payload;
  const accentColor = hexToRgb(template.accentColor);

  const card = { x: 18, y: 18, width: width - 36, height: height - 36 };
  const header = { x: card.x + 12, y: card.y + card.height - 88, width: card.width - 24, height: 74 };
  const gap = 10;
  const detail = { x: card.x + 12, y: 0, width: card.width - 24, height: 182 };
  detail.y = header.y - gap - detail.height;

  const qrWrap = { x: card.x + 12, y: 0, width: card.width - 24, height: 214 };
  qrWrap.y = detail.y - gap - qrWrap.height;

  const footer = { x: card.x + 12, y: 0, width: card.width - 24, height: 42 };
  footer.y = qrWrap.y - gap - footer.height;
  const logoBox = { x: header.x + header.width - 56, y: header.y + 16, width: 40, height: 40 };

  drawRoundedRect(page, card, 16, { r: 1, g: 1, b: 1 }, 1);
  drawRoundedRect(page, header, 11, accentColor);
  drawRoundedRect(page, detail, 10, { r: 0.96, g: 0.97, b: 1 });
  drawRoundedRect(page, qrWrap, 10, { r: 0.96, g: 0.97, b: 1 });
  drawRoundedRect(page, footer, 9, { r: 0.95, g: 0.97, b: 1 });

  page.drawText("ENTRADA OFICIAL", {
    x: header.x + 12,
    y: header.y + 50,
    size: 8.5,
    font,
    color: rgb(0.9, 0.94, 1)
  });
  page.drawText(truncateTextToWidth(template.headerText.toUpperCase(), fontBold, 15.5, header.width - 76), {
    x: header.x + 12,
    y: header.y + 25,
    size: 15.5,
    font: fontBold,
    color: rgb(1, 1, 1)
  });

  if (logoImage) {
    drawImageCover(page, logoImage, logoBox, {
      zoom: template.logoImageZoom,
      offsetX: template.logoImageOffsetX,
      offsetY: template.logoImageOffsetY
    });
  }

  page.drawText(truncateTextToWidth(input.eventName.toUpperCase(), fontBold, 13.6, detail.width - 22), {
    x: detail.x + 10,
    y: detail.y + detail.height - 28,
    size: 13.6,
    font: fontBold,
    color: rgb(0.1, 0.14, 0.24)
  });

  drawRows(page, rows.slice(0, 7), {
    x: detail.x + 10,
    y: detail.y + detail.height - 54,
    labelWidth: 66,
    maxValueWidth: detail.width - 84,
    lineHeight: 12,
    rowGap: 5.5,
    labelSize: 7.5,
    valueSize: 9.6,
    maxLinesPerValue: 2,
    font,
    fontBold
  });

  const qrSize = 124;
  const qrX = qrWrap.x + (qrWrap.width - qrSize) / 2;
  const qrY = qrWrap.y + 56;
  const qrCenterX = qrX + qrSize / 2;
  page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });
  drawQrLabel(page, "VALIDACION QR", qrCenterX, qrWrap.y + 18, fontBold, accentColor);

  drawWrappedText(page, template.footerText, {
    x: footer.x + 10,
    y: footer.y + 24,
    maxWidth: footer.width - 20,
    maxLines: 2,
    lineHeight: 11,
    size: 9.2,
    font,
    color: { r: 0.27, g: 0.34, b: 0.48 }
  });
}

export async function generateTicketPdf(input: TicketPdfInput) {
  const template = {
    ...defaultTicketTemplate,
    ...(input.template ?? {})
  };

  const dimensions: [number, number] =
    template.layout === "VERTICAL"
      ? [430, 760]
      : template.layout === "VERTICAL_COMPACT"
        ? [390, 620]
        : [842, 420];

  const doc = await PDFDocument.create();
  const page = doc.addPage(dimensions);
  const { width, height } = page.getSize();

  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const backgroundImage = await maybeEmbedImage(doc, template.backgroundImageDataUrl);
  const logoImage = await maybeEmbedImage(doc, template.logoImageDataUrl);
  drawBackgroundLayer(page, width, height, template, backgroundImage);

  const eventDate = new Intl.DateTimeFormat("es-AR", {
    dateStyle: "full",
    timeStyle: "short"
  }).format(input.startsAt);

  const rows: Row[] = [
    ["Titular", input.attendeeName],
    ["Tipo", input.ticketType],
    ["Fecha", eventDate],
    ["Lugar", input.venue ?? "Por confirmar"],
    ["Orden", input.orderCode],
    ["Codigo", input.code]
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
