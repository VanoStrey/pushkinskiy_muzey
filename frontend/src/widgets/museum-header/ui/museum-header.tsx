interface MuseumHeaderProps {
  onReset?: () => void;
  showReset?: boolean;
}

export function MuseumHeader({ onReset, showReset = false }: MuseumHeaderProps) {
  return (
    <header className="border-b border-[#9E9576] bg-[#ADA589] sticky top-0 z-40 shadow-xs">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
        {/* Brand identity */}
        <div
          onClick={showReset ? onReset : undefined}
          role={showReset ? "button" : undefined}
          tabIndex={showReset ? 0 : undefined}
          aria-label={showReset ? "ГМИИ им. А.С. Пушкина — Начать новый маршрут" : "ГМИИ им. А.С. Пушкина"}
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
          className={`flex items-center gap-2.5 sm:gap-3 select-none p-1 -ml-1 transition-colors ${
            showReset
              ? "cursor-pointer hover:bg-black/5 focus:outline-hidden focus:ring-2 focus:ring-[#000000]"
              : ""
          }`}
        >
          <img
            src="/images/logoPM-sign_text_26.svg"
            alt="ГМИИ им. А.С. Пушкина"
            className="h-8 sm:h-9 w-auto object-contain shrink-0"
          />
          <div className="border-l border-[#8E866C] pl-2.5 sm:pl-3 ml-0.5">
            <div className="text-[10px] uppercase tracking-wider text-[#262626] font-bold leading-tight">
              Персональный AI-гид
            </div>
            <div className="font-serif text-xs sm:text-sm font-bold text-[#000000] leading-tight">
              Главное здание
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {showReset && (
            <button
              type="button"
              onClick={onReset}
              aria-label="Создать новый маршрут"
              className="text-xs text-[#262626] hover:text-[#000000] px-3 py-2 min-h-[38px] border border-[#8E866C] bg-white transition-colors cursor-pointer font-semibold hover:border-[#000000] focus:outline-hidden focus:ring-2 focus:ring-[#000000]"
            >
              Новый маршрут
            </button>
          )}
          <a
            href="https://pushkinmuseum.art"
            target="_blank"
            rel="noreferrer"
            aria-label="Официальный сайт Пушкинского музея (откроется в новом окне)"
            className="hidden sm:inline-flex text-xs font-semibold text-[#262626] hover:text-[#000000] px-2 py-1.5 transition-colors items-center gap-1"
          >
            <span>Официальный сайт</span>
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </header>
  );
}
