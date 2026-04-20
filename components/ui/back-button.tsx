"use client";

interface BackButtonProps {
  label?: string;
}

export function BackButton({ label = "Volver atrás" }: BackButtonProps) {
  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={() => window.history.back()}
    >
      {label}
    </button>
  );
}
