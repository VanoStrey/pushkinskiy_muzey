/**
 * Icon set drawn from the museum's own mark.
 *
 * The Pushkin Museum's logotype is a neoclassical colonnade: columns that flare
 * at the capital and the base, carrying a lintel. Every glyph here is built from
 * that vocabulary — upright members with flared ends, horizontal lintels and
 * plinths, strict rectangles — instead of being pulled from a generic library.
 * All of them inherit `currentColor`, so they follow the palette tokens and the
 * surrounding text size rather than being painted by the operating system the
 * way emoji are.
 */

interface IconProps {
  size?: number;
  className?: string;
}

const base = (size: number, className: string) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor" as const,
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
  className,
});

/** A single column of the colonnade, flared at capital and base. */
function Column({ x, top, bottom }: { x: number; top: number; bottom: number }) {
  return (
    <>
      <path d={`M${x - 2.1} ${top}h4.2`} />
      <path d={`M${x - 1.1} ${top}v${bottom - top}`} />
      <path d={`M${x + 1.1} ${top}v${bottom - top}`} />
      <path d={`M${x - 2.1} ${bottom}h4.2`} />
    </>
  );
}

/* ---------------------------------------------------------------- audience */

/** One visitor: a single column. */
export function IconSolo({ size = 20, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <Column x={12} top={5} bottom={18} />
      <path d="M6 21h12" />
    </svg>
  );
}

/** A couple: two columns carrying one shared lintel. */
export function IconCouple({ size = 20, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M4.5 5h15" />
      <Column x={8.5} top={8} bottom={18} />
      <Column x={15.5} top={8} bottom={18} />
      <path d="M4 21h16" />
    </svg>
  );
}

/** Friends: three equal columns. */
export function IconFriends({ size = 20, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <Column x={5.5} top={6} bottom={18} />
      <Column x={12} top={6} bottom={18} />
      <Column x={18.5} top={6} bottom={18} />
      <path d="M2.5 21h19" />
    </svg>
  );
}

/** A family: two tall columns and a short one. */
export function IconFamily({ size = 20, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <Column x={5.5} top={5} bottom={18} />
      <Column x={12} top={5} bottom={18} />
      <Column x={18.5} top={11} bottom={18} />
      <path d="M2.5 21h19" />
    </svg>
  );
}

/* ------------------------------------------------------------------ museum */

/** The colonnade itself: the building. */
export function IconMuseum({ size = 20, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M3 8 12 3l9 5" />
      <path d="M4.5 8h15" />
      <path d="M7 11v7M12 11v7M17 11v7" />
      <path d="M3.5 18h17" />
      <path d="M2.5 21h19" />
    </svg>
  );
}

/** A floor plan: halls as cells, the current one filled. */
export function IconPlan({ size = 20, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M3 4h18v16H3z" />
      <path d="M3 12h18M11 4v16" />
      <path d="M14 15h4v2h-4z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Stairs drawn as an architectural section. */
export function IconStairs({ size = 20, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M3 20h4v-4h4v-4h4V8h5" />
      <path d="M20 4v4" />
    </svg>
  );
}

/** A cup built as an inverted capital standing on a plinth line. */
export function IconBreak({ size = 20, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M5 7h12v4a6 6 0 0 1-12 0z" />
      <path d="M17 8h2.5a2 2 0 0 1 0 4H17" />
      <path d="M4 20h14" />
    </svg>
  );
}

/** A framed canvas: the object. */
export function IconArtwork({ size = 20, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 4h16v16H4z" />
      <path d="M7 7h10v10H7z" />
      <path d="m7 15 3.5-4L13 14l2-2 2 2.5" />
    </svg>
  );
}

/** Observation: an almond eye with a square pupil. */
export function IconObserve({ size = 20, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <path d="M10 10h4v4h-4z" />
    </svg>
  );
}

/** Look closer: a lens crossing the corner of a frame. */
export function IconLookCloser({ size = 20, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 4h11v11H4z" />
      <circle cx="15" cy="15" r="4.5" />
      <path d="m18.4 18.4 2.6 2.6" />
    </svg>
  );
}

/* ------------------------------------------------------------------- meta */

/** Duration: a clock with a single hand. */
export function IconDuration({ size = 20, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5h4" />
    </svg>
  );
}

/** Generated by the model: a four-pointed star with concave rays. */
export function IconSpark({ size = 20, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 3c0 4.5 1.5 6 6 6-4.5 0-6 1.5-6 6 0-4.5-1.5-6-6-6 4.5 0 6-1.5 6-6Z" />
      <path d="M18.5 15.5c0 2 .7 2.7 2.7 2.7-2 0-2.7.7-2.7 2.7 0-2-.7-2.7-2.7-2.7 2 0 2.7-.7 2.7-2.7Z" />
    </svg>
  );
}

/** A hint: a lamp on a stem over a plinth. */
export function IconHint({ size = 20, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 3a6 6 0 0 1 3.5 10.9V16h-7v-2.1A6 6 0 0 1 12 3Z" />
      <path d="M9.5 19h5M10.5 21.5h3" />
    </svg>
  );
}

/** Caution: a triangle with an upright member inside. */
export function IconCaution({ size = 20, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 3.5 21.5 20H2.5z" />
      <path d="M12 10v4.5" />
      <path d="M12 17.2v.3" />
    </svg>
  );
}

/** Completion: rays from a point. */
export function IconCelebrate({ size = 20, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
      <path d="m5.5 5.5 2 2M16.5 16.5l2 2M18.5 5.5l-2 2M7.5 16.5l-2 2" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** Without a break: a straight-segment bolt. */
export function IconDirect({ size = 20, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M13.5 2.5 5 13.5h5.5L10 21.5 19 10.5h-5.5z" />
    </svg>
  );
}

/** Centre the map: concentric squares with a crosshair. */
export function IconTarget({ size = 20, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M5 5h14v14H5z" />
      <path d="M9.5 9.5h5v5h-5z" />
      <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5" />
    </svg>
  );
}

/** Location: a plinth marker. */
export function IconPlace({ size = 20, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 3.5 17 9l-5 5.5L7 9z" />
      <path d="M6 20.5h12" />
    </svg>
  );
}

/* --------------------------------------------------------------- controls */

export function IconCheck({ size = 20, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  );
}

export function IconClose({ size = 20, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function IconArrowRight({ size = 20, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 12h15" />
      <path d="m13.5 6.5 5.5 5.5-5.5 5.5" />
    </svg>
  );
}

export function IconArrowLeft({ size = 20, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M20 12H5" />
      <path d="M10.5 6.5 5 12l5.5 5.5" />
    </svg>
  );
}

export function IconExternal({ size = 20, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M9 5H5v14h14v-4" />
      <path d="M14 4h6v6" />
      <path d="M20 4 11.5 12.5" />
    </svg>
  );
}

/** A step bullet, used where a stop is still ahead. */
export function IconDot({ size = 20, className = "" }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
    </svg>
  );
}
