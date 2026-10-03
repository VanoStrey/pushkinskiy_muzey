import type { Stop } from "../model/types";
import { ArtworkImage } from "./artwork-image";

interface StopCardProps {
  stop: Stop;
  onClick?: () => void;
  isCompleted?: boolean;
}

export function StopCard({ stop, onClick, isCompleted = false }: StopCardProps) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`Остановка ${stop.position}: ${stop.title}, ${stop.artist}. ${
        isCompleted ? "Пройдена." : "Нажмите для перехода к экспонату."
      }`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={`group relative text-left bg-white border rounded-xl p-3.5 sm:p-4 transition-all shadow-xs hover:shadow-sm cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#9E2A2B] ${
        isCompleted
          ? "border-[#D6E5D8] bg-[#FBFDFB]"
          : "border-[#E3DDD4] hover:border-[#9E2A2B]/40"
      }`}
    >
      <div className="flex gap-3.5 sm:gap-4 items-start">
        {/* Step number badge */}
        <div className="shrink-0 flex flex-col items-center">
          <span
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
              isCompleted
                ? "bg-[#2E7D32] text-white"
                : "bg-[#1A1918] text-white group-hover:bg-[#9E2A2B] transition-colors"
            }`}
          >
            {isCompleted ? "✓" : stop.position}
          </span>
          <span className="text-[10px] text-[#8C867E] mt-1 font-mono uppercase tracking-wider">
            шаг
          </span>
        </div>

        {/* Thumbnail */}
        <div className="w-20 h-24 sm:w-22 sm:h-26 shrink-0 rounded-lg overflow-hidden border border-[#E8E3DC]">
          <ArtworkImage
            src={stop.image_url}
            alt={stop.title}
            artist={stop.artist}
            showMagnifyButton={false}
            compact={true}
            className="w-full h-full"
          />
        </div>

        {/* Text information */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-serif text-base sm:text-lg font-bold text-[#1A1918] group-hover:text-[#9E2A2B] transition-colors leading-snug line-clamp-1">
              {stop.title}
            </h4>
            {isCompleted && (
              <span className="shrink-0 text-[10px] bg-[#EEF7ED] text-[#2E7D32] font-semibold px-2 py-0.5 rounded-full border border-[#C8E6C9]">
                Пройдено
              </span>
            )}
          </div>

          <p className="text-xs text-[#5C5954] mt-0.5 font-sans font-medium line-clamp-1">
            {stop.artist}, {stop.date}
          </p>

          {stop.location && (
            <p className="text-[11px] text-[#8C867E] mt-1 flex items-center gap-1 line-clamp-1">
              <svg
                className="w-3 h-3 text-[#9E2A2B] shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
              </svg>
              <span>{stop.location}</span>
            </p>
          )}

          <div className="mt-2 bg-[#FAF7F2] border-l-2 border-[#9E2A2B] px-2.5 py-1.5 rounded-r text-[11px] text-[#474440] leading-relaxed line-clamp-2">
            <span className="font-medium text-[#1A1918]">В вашем маршруте: </span>
            {stop.personalization_reason}
          </div>
        </div>
      </div>
    </div>
  );
}
