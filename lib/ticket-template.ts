import { z } from "zod";

export const ticketLayoutSchema = z.enum(["HORIZONTAL", "VERTICAL", "VERTICAL_COMPACT"]);
export type TicketLayout = z.infer<typeof ticketLayoutSchema>;

export const ticketTemplateSchema = z.object({
  layout: ticketLayoutSchema.default("HORIZONTAL"),
  backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  headerText: z.string().min(2).max(80),
  footerText: z.string().min(2).max(140),
  backgroundImageDataUrl: z.string().max(2_000_000).nullable().optional(),
  logoImageDataUrl: z.string().max(500_000).nullable().optional()
});

export type TicketTemplate = z.infer<typeof ticketTemplateSchema>;

export const defaultTicketTemplate: TicketTemplate = {
  layout: "HORIZONTAL",
  backgroundColor: "#f8fafc",
  accentColor: "#2563eb",
  headerText: "Aiderbrand Pass",
  footerText: "Presenta este QR en el acceso para validar tu ingreso.",
  backgroundImageDataUrl: null,
  logoImageDataUrl: null
};

export function normalizeTicketTemplate(template: unknown): TicketTemplate {
  const parsed = ticketTemplateSchema.safeParse(template);
  if (!parsed.success) {
    return defaultTicketTemplate;
  }

  return {
    ...defaultTicketTemplate,
    ...parsed.data,
    layout: parsed.data.layout ?? defaultTicketTemplate.layout,
    backgroundImageDataUrl: parsed.data.backgroundImageDataUrl ?? null,
    logoImageDataUrl: parsed.data.logoImageDataUrl ?? null
  };
}

export const ticketTemplatePresets: Array<{
  id: TicketLayout;
  name: string;
  description: string;
  template: Pick<TicketTemplate, "layout" | "backgroundColor" | "accentColor" | "headerText" | "footerText">;
}> = [
  {
    id: "HORIZONTAL",
    name: "Horizontal clasico",
    description: "Formato apaisado tradicional para imprimir o desktop.",
    template: {
      layout: "HORIZONTAL",
      backgroundColor: "#f8fafc",
      accentColor: "#2563eb",
      headerText: "Aiderbrand Pass",
      footerText: "Presenta este QR en el acceso para validar tu ingreso."
    }
  },
  {
    id: "VERTICAL",
    name: "Vertical mobile",
    description: "Formato vertical grande, ideal para mostrar QR desde celular.",
    template: {
      layout: "VERTICAL",
      backgroundColor: "#f8fafc",
      accentColor: "#1d4ed8",
      headerText: "Ticket Mobile",
      footerText: "Sube el brillo al maximo y presenta este QR en el ingreso."
    }
  },
  {
    id: "VERTICAL_COMPACT",
    name: "Vertical compacto",
    description: "Formato vertical corto para wallets o pantallas chicas.",
    template: {
      layout: "VERTICAL_COMPACT",
      backgroundColor: "#f1f5f9",
      accentColor: "#0f172a",
      headerText: "Access Pass",
      footerText: "QR unico e intransferible. Presentar DNI junto al ticket."
    }
  }
];
