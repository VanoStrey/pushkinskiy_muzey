interface MuseumHeaderProps {
  onReset?: () => void;
  showReset?: boolean;
}

export function MuseumHeader({ onReset, showReset = false }: MuseumHeaderProps) {
  return (
    <header className="border-b border-[#E8E3DC] bg-[#FAF8F5]/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Brand identity */}
        <div
          onClick={showReset ? onReset : undefined}
          className={`flex items-center gap-3 select-none ${showReset ? "cursor-pointer" : ""}`}
        >
          <div className="w-8 h-8 rounded bg-[#1A1918] text-[#FAF8F5] flex items-center justify-center font-serif text-lg font-bold tracking-tighter">
            П
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[#726E67] font-semibold">
              ГМИИ им. А.С. Пушкина
            </div>
            <div className="font-serif text-sm sm:text-base font-bold text-[#1A1918] leading-none">
              Персональный AI-гид
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {showReset && (
            <button
              type="button"
              onClick={onReset}
              className="text-xs text-[#5C5954] hover:text-[#9E2A2B] px-3 py-1.5 rounded-lg border border-[#E3DDD4] bg-white transition-colors cursor-pointer"
            >
              Новый маршрут
            </button>
          )}
          <a
            href="https://pushkinmuseum.art"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex text-xs text-[#726E67] hover:text-[#1A1918] px-2 py-1 transition-colors"
          >
            Официальный сайт ↗
          </a>
        </div>
      </div>
    </header>
  );
}
