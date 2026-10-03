import type { ReactNode } from "react";

interface FrameProps {
  children: ReactNode;
  className?: string;
}

/**
 * Reproductions stay strictly rectangular and carry a directional drop shadow
 * instead of a border — the museum's own way of presenting an object, and the
 * deliberate counterpoint to the soft controls around it.
 */
export function Frame({ children, className = "" }: FrameProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-[var(--radius-frame)] bg-sunken shadow-[var(--shadow-frame)] ${className}`}
    >
      {children}
    </div>
  );
}
