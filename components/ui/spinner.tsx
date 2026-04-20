type SpinnerSize = "sm" | "md" | "lg";
type SpinnerTone = "neutral" | "accent";

interface SpinnerProps {
  size?: SpinnerSize;
  tone?: SpinnerTone;
  label?: string;
}

const sizePx: Record<SpinnerSize, number> = {
  sm: 16,
  md: 24,
  lg: 48,
};

export function Spinner({ size = "md", tone = "accent", label = "Cargando" }: SpinnerProps) {
  const px = sizePx[size];
  const r = (px - 4) / 2; // radius leaves 2px stroke clearance on each side
  const cx = px / 2;
  const cy = px / 2;
  const circumference = 2 * Math.PI * r;
  // Arc covering ~25% of the circle
  const arcLength = circumference * 0.25;
  const trackStroke = "var(--clr-forest-600)";
  const arcStroke = tone === "neutral" ? "var(--clr-forest-600)" : "var(--clr-coral-500)";

  return (
    <svg
      width={px}
      height={px}
      viewBox={`0 0 ${px} ${px}`}
      fill="none"
      aria-label={label}
      role="img"
      className="animate-spin"
      style={{ display: "block" }}
    >
      {/* Track — full circle at 50% opacity */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        strokeWidth={2}
        stroke={trackStroke}
        strokeOpacity={0.5}
      />
      {/* Arc — ~25% of circumference */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        strokeWidth={2}
        stroke={arcStroke}
        strokeDasharray={`${arcLength} ${circumference - arcLength}`}
        strokeLinecap="round"
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      />
    </svg>
  );
}
