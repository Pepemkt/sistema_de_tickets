import type { ReactElement } from "react";

export interface SummaryBoxProps {
  label: string;
  value: string;
  className?: string;
}

export function SummaryBox({ label, value, className }: SummaryBoxProps): ReactElement {
  return (
    <div className={`rounded-sm border border-soft bg-sunken p-3${className ? ` ${className}` : ""}`}>
      <p className="text-overline text-primary">{label}</p>
      <p className="mt-1 text-body-l font-semibold text-primary">{value}</p>
    </div>
  );
}
