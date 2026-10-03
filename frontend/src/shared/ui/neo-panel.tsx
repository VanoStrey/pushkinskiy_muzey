import type { ReactNode } from "react";

interface NeoPanelProps {
  children: ReactNode;
  /** "sunken" reads as a recess in the page rather than a raised card. */
  depth?: "raised" | "sunken" | "flat";
  as?: "div" | "section" | "aside";
  className?: string;
  ariaLabelledby?: string;
  role?: string;
}

const DEPTHS: Record<string, string> = {
  raised: "bg-surface shadow-[var(--shadow-raised)]",
  sunken: "bg-sunken shadow-[var(--shadow-pressed)]",
  flat: "bg-surface",
};

export function NeoPanel({
  children,
  depth = "raised",
  as: Tag = "div",
  className = "",
  ariaLabelledby,
  role,
}: NeoPanelProps) {
  return (
    <Tag
      role={role}
      aria-labelledby={ariaLabelledby}
      className={`rounded-[var(--radius-surface)] p-5 sm:p-6 ${DEPTHS[depth]} ${className}`}
    >
      {children}
    </Tag>
  );
}
