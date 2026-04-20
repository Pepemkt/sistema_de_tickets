type IllustrationVariant = "empty" | "error" | "not-found" | "success" | "search" | "waiting";

interface StateIllustrationProps {
  variant: IllustrationVariant;
  size?: number;
}

/* All colors via CSS vars — NO hex, NO Tailwind color classes on SVG fills */
const C = {
  forest400: "var(--clr-forest-400)",
  forest600: "var(--clr-forest-600)",
  coral400:  "var(--clr-coral-400)",
  arena300:  "var(--clr-arena-300)",
} as const;

function ErrorIllustration() {
  return (
    <>
      {/* Two offset rounded rectangles — their negative space evokes an "x" */}
      <rect x="55" y="65" width="90" height="55" rx="10" fill={C.forest400} opacity="0.85" transform="rotate(-22 100 100)" />
      <rect x="55" y="80" width="90" height="55" rx="10" fill={C.coral400} opacity="0.80" transform="rotate(22 100 100)" />
    </>
  );
}

function NotFoundIllustration() {
  return (
    <>
      {/* Arena circle — primary */}
      <circle cx="85" cy="100" r="52" fill={C.arena300} opacity="0.7" />
      {/* Coral circle — offset */}
      <circle cx="118" cy="88" r="36" fill={C.coral400} opacity="0.65" />
      {/* Forest diagonal line — compass needle lost */}
      <line x1="60" y1="150" x2="140" y2="55" stroke={C.forest600} strokeWidth="4" strokeLinecap="round" />
    </>
  );
}

function EmptyIllustration() {
  return (
    <>
      {/* Concentric circles — outer arena-300, inner forest-400 outline */}
      <circle cx="100" cy="100" r="62" fill="none" stroke={C.arena300} strokeWidth="14" opacity="0.7" />
      <circle cx="100" cy="100" r="32" fill="none" stroke={C.forest400} strokeWidth="4" opacity="0.6" />
      {/* Center dot */}
      <circle cx="100" cy="100" r="8" fill={C.forest400} opacity="0.5" />
    </>
  );
}

function SuccessIllustration() {
  return (
    <>
      {/* Forest-600 rounded square */}
      <rect x="45" y="45" width="110" height="110" rx="18" fill={C.forest600} opacity="0.85" />
      {/* Coral diagonal stroke as check */}
      <polyline
        points="66,105 90,128 134,72"
        fill="none"
        stroke={C.coral400}
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}

function SearchIllustration() {
  return (
    <>
      {/* Forest-600 circle outline */}
      <circle cx="90" cy="90" r="52" fill="none" stroke={C.forest600} strokeWidth="6" />
      {/* Arena-300 fill inside the circle */}
      <circle cx="90" cy="90" r="46" fill={C.arena300} opacity="0.4" />
      {/* Short diagonal handle */}
      <line x1="130" y1="130" x2="158" y2="158" stroke={C.forest600} strokeWidth="8" strokeLinecap="round" />
    </>
  );
}

function WaitingIllustration() {
  return (
    <>
      {/* Arena-300 large circle */}
      <circle cx="100" cy="100" r="62" fill={C.arena300} opacity="0.55" />
      {/* Coral-400 small dot offset */}
      <circle cx="138" cy="68" r="16" fill={C.coral400} opacity="0.85" />
    </>
  );
}

const variantMap: Record<IllustrationVariant, React.ReactNode> = {
  error:     <ErrorIllustration />,
  "not-found": <NotFoundIllustration />,
  empty:     <EmptyIllustration />,
  success:   <SuccessIllustration />,
  search:    <SearchIllustration />,
  waiting:   <WaitingIllustration />,
};

export function StateIllustration({ variant, size = 200 }: StateIllustrationProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {variantMap[variant]}
    </svg>
  );
}
