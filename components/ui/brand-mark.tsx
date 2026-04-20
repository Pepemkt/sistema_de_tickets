const BRAND_NAME = "Aiderbrand Tickets";

type BrandMarkSize = "sm" | "md" | "lg";

interface BrandMarkProps {
  size?: BrandMarkSize;
}

const sizeClass: Record<BrandMarkSize, string> = {
  sm: "text-title-m",
  md: "text-title-l",
  lg: "text-display-m",
};

export function BrandMark({ size = "md" }: BrandMarkProps) {
  return (
    <span
      role="img"
      aria-label={BRAND_NAME}
      className={`font-display text-primary ${sizeClass[size]}`}
      style={{ fontVariationSettings: '"opsz" 56, "SOFT" 40, "wght" 650' }}
    >
      {BRAND_NAME}
    </span>
  );
}
