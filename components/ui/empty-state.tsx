import type { ReactNode } from "react";
import { StateIllustration } from "./state-illustration";

export interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface EmptyStateProps {
  illustration?: ReactNode;       // defaults to <StateIllustration variant="empty" />
  title: string;                  // required
  description?: string;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  // tone: visually inert — reserved for future theming
  tone?: "neutral" | "success" | "info";
}

function ActionButton({ action, variant }: { action: EmptyStateAction; variant: "primary" | "secondary" }) {
  const className = variant === "primary" ? "btn-primary" : "btn-secondary";

  if (action.href) {
    return (
      <a href={action.href} className={className}>
        {action.label}
      </a>
    );
  }

  if (action.onClick) {
    return (
      <button type="button" className={className} onClick={action.onClick}>
        {action.label}
      </button>
    );
  }

  return null;
}

export function EmptyState({
  illustration,
  title,
  description,
  action,
  secondaryAction,
}: EmptyStateProps) {
  const hasMultipleActions = Boolean(action) && Boolean(secondaryAction);

  return (
    <div className="flex flex-col items-center text-center max-w-sm mx-auto py-section gap-4">
      <div aria-hidden="true">
        {illustration !== undefined ? illustration : <StateIllustration variant="empty" />}
      </div>

      <h2 className="font-display text-title-m text-primary">{title}</h2>

      {description && (
        <p className="text-body text-secondary">{description}</p>
      )}

      {(action || secondaryAction) && (
        <div
          className={
            hasMultipleActions
              ? "flex flex-row gap-3 justify-center"
              : "flex justify-center"
          }
        >
          {action && <ActionButton action={action} variant="primary" />}
          {secondaryAction && <ActionButton action={secondaryAction} variant="secondary" />}
        </div>
      )}
    </div>
  );
}
