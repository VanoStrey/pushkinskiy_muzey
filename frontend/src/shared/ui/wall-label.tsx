interface WallLabelItem {
  term: string;
  value: string | null | undefined;
}

interface WallLabelProps {
  items: WallLabelItem[];
  className?: string;
}

/** Object caption set the way a museum sets one: termed, spaced, hairline-ruled. */
export function WallLabel({ items, className = "" }: WallLabelProps) {
  const present = items.filter((item) => item.value);
  if (present.length === 0) return null;

  return (
    <dl className={`space-y-1.5 ${className}`}>
      {present.map((item) => (
        <div
          key={item.term}
          className="grid grid-cols-[minmax(0,8rem)_1fr] gap-x-4 gap-y-0.5 border-t border-ink/10 pt-1.5 first:border-t-0 first:pt-0"
        >
          <dt className="wall-label pt-0.5">{item.term}</dt>
          <dd className="min-w-0 text-xs leading-relaxed text-muted">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
