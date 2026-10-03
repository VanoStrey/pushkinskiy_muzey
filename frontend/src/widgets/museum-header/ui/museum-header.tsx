interface MuseumHeaderProps {
  onReset?: () => void;
  showReset?: boolean;
}

export function MuseumHeader({ onReset, showReset = false }: MuseumHeaderProps) {
  return (
    <header className="border-b border-[#E8E3DC] bg-[#FAF8F5]/95 backdrop-blur-md sticky top-0 z-40">
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
          className={`flex items-center gap-2.5 sm:gap-3 select-none rounded-lg p-1 -ml-1 transition-colors ${
            showReset
              ? "cursor-pointer hover:bg-black/5 focus:outline-hidden focus:ring-2 focus:ring-[#9E2A2B]"
              : ""
          }`}
        >
          <div
            className="w-8 h-8 rounded-lg bg-[#1A1918] text-[#FAF8F5] flex items-center justify-center font-serif text-lg font-bold tracking-tighter shrink-0"
            aria-hidden="true"
          >
            П
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[#726E67] font-semibold leading-tight">
              ГМИИ им. А.С. Пушкина
            </div>
            <div className="font-serif text-sm sm:text-base font-bold text-[#1A1918] leading-tight">
              Персональный AI-гид
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
              className="text-xs text-[#5C5954] hover:text-[#9E2A2B] px-3 py-2 min-h-[38px] rounded-lg border border-[#E3DDD4] bg-white transition-colors cursor-pointer font-medium hover:border-[#9E2A2B] focus:outline-hidden focus:ring-2 focus:ring-[#9E2A2B]"
            >
              Новый маршрут
            </button>
          )}
          <a
            href="https://pushkinmuseum.art"
            target="_blank"
            rel="noreferrer"
            aria-label="Официальный сайт Пушкинского музея (откроется в новом окне)"
            className="hidden sm:inline-flex text-xs text-[#726E67] hover:text-[#1A1918] px-2 py-1.5 transition-colors items-center gap-1"
          >
            <span>Официальный сайт</span>
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </header>
  );
}
