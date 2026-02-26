import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

type BrandingConfig = {
  sidebarLogoUrl: string | null;
};

const BRANDING_PATH = path.join(process.cwd(), "config", "branding.json");
const DEFAULT_BRANDING: BrandingConfig = {
  sidebarLogoUrl: process.env.NEXT_PUBLIC_BRAND_LOGO_URL || null
};

function isValidLogoUrl(value: string) {
  if (value.startsWith("data:image/")) return true;

  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function normalizeBrandingLogo(input: unknown) {
  if (typeof input !== "string") {
    return null;
  }

  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length > 1_000_000) {
    throw new Error("El logo supera el tamaño permitido");
  }

  if (!isValidLogoUrl(trimmed)) {
    throw new Error("Logo invalido: usa URL http(s) o data:image");
  }

  return trimmed;
}

export async function readBrandingConfig(): Promise<BrandingConfig> {
  try {
    const content = await readFile(BRANDING_PATH, "utf8");
    const parsed = JSON.parse(content) as Partial<BrandingConfig>;
    return {
      sidebarLogoUrl: normalizeBrandingLogo(parsed.sidebarLogoUrl)
    };
  } catch {
    return DEFAULT_BRANDING;
  }
}

export async function writeBrandingConfig(input: BrandingConfig) {
  await mkdir(path.dirname(BRANDING_PATH), { recursive: true });
  await writeFile(BRANDING_PATH, JSON.stringify(input, null, 2), "utf8");
  return input;
}

