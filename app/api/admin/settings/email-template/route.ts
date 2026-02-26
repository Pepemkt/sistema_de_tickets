import { NextResponse } from "next/server";
import { checkApiRole } from "@/lib/api-auth";
import { defaultEmailTemplate, EMAIL_TEMPLATE_TOKENS } from "@/lib/email-template";
import {
  buildEmailTemplateFromBuilder,
  defaultEmailTemplateBuilder,
  normalizeEmailTemplateBuilder
} from "@/lib/email-template-builder";
import { getPlatformConfig, upsertEmailTemplateConfig } from "@/lib/platform-config";

export const runtime = "nodejs";

function resolveBuilderFromConfig(config: Awaited<ReturnType<typeof getPlatformConfig>>) {
  const builder = normalizeEmailTemplateBuilder(config?.emailTemplateBuilder);
  const raw = config?.emailTemplateBuilder;
  const isLegacyUnlayer =
    raw && typeof raw === "object" && "provider" in raw && (raw as { provider?: unknown }).provider === "unlayer";

  if ((isLegacyUnlayer || !config?.emailTemplateBuilder) && config?.emailTemplateSubject) {
    return {
      ...builder,
      subjectTemplate: config.emailTemplateSubject
    };
  }

  return builder;
}

export async function GET() {
  const auth = await checkApiRole(["ADMIN"]);
  if (auth.response) return auth.response;

  const config = await getPlatformConfig();
  const builder = resolveBuilderFromConfig(config);
  const built = buildEmailTemplateFromBuilder(builder);

  return NextResponse.json({
    builder,
    subject: built.subject,
    html: built.html,
    tokens: EMAIL_TEMPLATE_TOKENS,
    updatedAt: config?.updatedAt ?? null
  });
}

export async function PUT(request: Request) {
  const auth = await checkApiRole(["ADMIN"]);
  if (auth.response) return auth.response;

  try {
    const payload = await request.json();
    const builder = normalizeEmailTemplateBuilder(payload?.builder ?? payload);
    const built = buildEmailTemplateFromBuilder(builder);

    const config = await upsertEmailTemplateConfig({
      emailTemplateBuilder: builder,
      emailTemplateSubject: built.subject || defaultEmailTemplate.subject,
      emailTemplateHtml: built.html || defaultEmailTemplate.html
    });

    return NextResponse.json({
      ok: true,
      builder,
      subject: config.emailTemplateSubject ?? defaultEmailTemplate.subject,
      html: config.emailTemplateHtml ?? defaultEmailTemplate.html,
      tokens: EMAIL_TEMPLATE_TOKENS,
      updatedAt: config.updatedAt
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo guardar la plantilla de email"
      },
      { status: 400 }
    );
  }
}
