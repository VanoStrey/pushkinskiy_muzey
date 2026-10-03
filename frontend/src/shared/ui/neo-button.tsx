import type { ReactNode } from "react";

interface NeoButtonProps {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "ghost" | "quiet";
  disabled?: boolean;
  busy?: boolean;
  full?: boolean;
  className?: string;
  ariaLabel?: string;
}

const LOOKS: Record<string, string> = {
  primary:
    "bg-accent text-white px-6 py-3.5 min-h-[52px] shadow-[var(--shadow-raised)] hover:bg-accent-hover active:shadow-[var(--shadow-pressed)]",
  ghost:
    "bg-ground text-ink px-5 py-3 shadow-[var(--shadow-raised)] active:shadow-[var(--shadow-pressed)]",
  quiet:
    "bg-ground text-muted px-3.5 py-2 text-xs shadow-[var(--shadow-raised-sm)] active:shadow-[var(--shadow-pressed-sm)]",
};

export function NeoButton({
  children,
  onClick,
  type = "button",
  variant = "primary",
  disabled = false,
  busy = false,
  full = false,
  className = "",
  ariaLabel,
}: NeoButtonProps) {
  const blocked = disabled || busy;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={blocked}
      aria-label={ariaLabel}
      aria-busy={busy}
      className={`relative inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-medium transition-all duration-200 disabled:opacity-55 ${LOOKS[variant]} ${full ? "w-full" : ""} ${blocked ? "cursor-default" : "cursor-pointer"} ${className}`}
    >
      {busy && (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
