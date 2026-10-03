import type { ReactNode } from "react";

interface NeoTileProps {
  /** Selected tiles are pressed into the surface instead of merely recoloured. */
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  /** "checkbox" for multi-select groups, "radio" for single choice. */
  role?: "checkbox" | "radio" | "button";
  label: string;
  hint?: string;
  icon?: string;
  /** Keeps the pressed look but drops the pointer affordance (answered quiz). */
  locked?: boolean;
  tone?: "neutral" | "correct" | "wrong";
  children?: ReactNode;
  className?: string;
}

const TONE_TEXT: Record<string, string> = {
  neutral: "text-ink",
  correct: "text-correct",
  wrong: "text-wrong",
};

/**
 * The tactile core of the redesign: an option you can feel. Unpicked options sit
 * proud of the surface, the picked one is pressed in — so state is physical
 * rather than a colour the visitor has to decode.
 */
export function NeoTile({
  selected = false,
  disabled = false,
  onClick,
  role = "button",
  label,
  hint,
  icon,
  locked = false,
  tone = "neutral",
  children,
  className = "",
}: NeoTileProps) {
  const ariaProps =
    role === "button"
      ? { "aria-pressed": selected }
      : { "aria-checked": selected, role };

  const depth = selected
    ? "shadow-[var(--shadow-pressed)] bg-accent/15 ring-2 ring-accent/45"
    : "shadow-[var(--shadow-raised)] hover:shadow-[var(--shadow-raised-sm)]";
  const pointer =
    locked || disabled
      ? "cursor-default"
      : "cursor-pointer active:shadow-[var(--shadow-pressed)]";

  return (
    <button
      type="button"
      {...ariaProps}
      disabled={disabled}
      onClick={onClick}
      className={`group relative w-full rounded-[var(--radius-control)] bg-ground px-4 py-3 text-left transition-all duration-200 ${depth} ${pointer} ${disabled ? "opacity-55" : ""} ${className}`}
    >
      <span className="flex items-start gap-2.5">
        {icon && (
          <span aria-hidden="true" className="text-lg leading-none">
            {icon}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span
            className={`block text-sm font-semibold ${selected ? "text-accent-ink" : TONE_TEXT[tone]}`}
          >
            {label}
          </span>
          {hint && <span className="mt-0.5 block text-[11px] text-faint">{hint}</span>}
          {children}
        </span>
        {/* No checkbox glyph: being pressed into the surface is the selected state. */}
        {selected && (
          <span aria-hidden="true" className="mt-0.5 shrink-0 text-sm text-accent">
            ✓
          </span>
        )}
      </span>
    </button>
  );
}
