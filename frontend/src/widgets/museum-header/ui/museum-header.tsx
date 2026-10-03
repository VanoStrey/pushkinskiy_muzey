import { IconExternal, NeoButton } from "@/shared/ui";

interface MuseumHeaderProps {
  onReset?: () => void;
  showReset?: boolean;
}

export function MuseumHeader({ onReset, showReset = false }: MuseumHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-header-khaki-hover bg-header-khaki">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3">
        {/* Brand identity */}
        <div
          onClick={showReset ? onReset : undefined}
          role={showReset ? "button" : undefined}
          tabIndex={showReset ? 0 : undefined}
          aria-label={
            showReset
              ? "ГМИИ им. А.С. Пушкина — Начать новый маршрут"
              : "ГМИИ им. А.С. Пушкина"
          }
          onKeyDown={
            showReset
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onReset?.();
                  }
                }
              : undefined
          }
          className={`-ml-1 flex select-none items-center gap-2.5 rounded-[var(--radius-control)] p-1 transition-colors sm:gap-3 ${
            showReset ? "cursor-pointer hover:bg-black/5" : ""
          }`}
        >
          <img
            src="/images/logoPM-sign_text_26.svg"
            alt="ГМИИ им. А.С. Пушкина"
            className="h-8 w-auto shrink-0 object-contain sm:h-9"
          />
          <div className="ml-0.5 border-l border-black/20 pl-2.5 sm:pl-3">
            <div className="text-[10px] font-bold uppercase leading-tight tracking-wider text-museum-dark">
              Персональный AI-гид
            </div>
            <div className="font-serif text-xs font-bold leading-tight text-museum-black sm:text-sm">
              Главное здание
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2">
          {showReset && (
            <NeoButton
              variant="quiet"
              onClick={onReset}
              ariaLabel="Создать новый маршрут"
              className="font-semibold"
            >
              Новый маршрут
            </NeoButton>
          )}
          <a
            href="https://pushkinmuseum.art"
            target="_blank"
            rel="noreferrer"
            aria-label="Официальный сайт Пушкинского музея (откроется в новом окне)"
            className="hidden items-center gap-1 px-2 py-1.5 text-xs font-semibold text-museum-dark transition-colors hover:text-museum-black sm:inline-flex"
          >
            <span>Официальный сайт</span>
            <IconExternal size={13} />
          </a>
        </div>
      </div>
    </header>
  );
}
