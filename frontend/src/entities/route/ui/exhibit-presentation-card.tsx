import type { Stop } from "../model/types";
import { ArtworkImage } from "./artwork-image";

interface ExhibitPresentationCardProps {
  stop: Stop;
  totalStops?: number;
  onOpenMap?: () => void;
  compact?: boolean;
}

/**
 * Dedicated React presentation template for museum exhibits.
 * Accents:
 * - Название объекта (title)
 * - Почему выбран (personalization_reason) — highlighted with brand accent #899770
 * - Описание (description)
 * - Зал, этаж, автор, дата, проверенный источник
 */
export function ExhibitPresentationCard({
  stop,
  totalStops,
  onOpenMap,
  compact = false,
}: ExhibitPresentationCardProps) {
  return (
    <article className="bg-[#FFFFFF] border border-[#E5E1D8] shadow-xs overflow-hidden text-[#262626] transition-all">
      {/* 1. Header spatial status bar */}
      <div className="bg-[#F7F5F0] border-b border-[#E5E1D8] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[#000000] bg-[#FFFFFF] px-2.5 py-0.5 border border-[#E5E1D8] shadow-2xs">
            {totalStops ? `Остановка ${stop.position} из ${totalStops}` : `Остановка ${stop.position}`}
          </span>
          {stop.location && (
            <span className="text-[#262626] font-medium flex items-center gap-1">
              <svg className="w-3.5 h-3.5 text-[#899770] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              <span>{stop.location}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onOpenMap && (
            <button
              type="button"
              onClick={onOpenMap}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-[#FFFFFF] bg-[#899770] hover:bg-[#75835C] px-2.5 py-1 transition-colors cursor-pointer shadow-2xs"
              aria-label="Показать этот зал на схеме музея"
            >
              <span aria-hidden="true">🗺️</span>
              <span>План этажа</span>
            </button>
          )}
          {stop.provenance_source && (
            <span className="text-[11px] text-[#7A756D] font-mono truncate max-w-[140px] sm:max-w-[200px]" title={stop.provenance_source}>
              {stop.provenance_source}
            </span>
          )}
        </div>
      </div>

      {/* 2. Visual artwork frame */}
      <div className="relative bg-[#F7F5F0]">
        <ArtworkImage
          key={stop.image_url || stop.exhibit_id}
          src={stop.image_url}
          alt={stop.title}
          artist={stop.artist || "Автор не указан в данных музея"}
          className={`w-full ${compact ? "h-56 sm:h-64" : "h-72 sm:h-96"}`}
        />
      </div>

      {/* 3. Core content body */}
      <div className="p-5 sm:p-6 space-y-5">
        {/* Title and author block */}
        <div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#000000] leading-tight">
            {stop.title}
          </h1>
          <p className="text-sm sm:text-base text-[#262626] mt-1.5 font-medium">
            <span>{stop.artist || "Автор не указан в данных музея"}</span>
            {stop.date && (
              <>
                <span className="mx-2 text-[#ADA589]">•</span>
                <span className="text-[#666666]">{stop.date}</span>
              </>
            )}
          </p>
        </div>

        {/* 4. Highlight block: «ПОЧЕМУ ВЫБРАН» (accent color #899770) */}
        {stop.personalization_reason && stop.personalization_reason.trim() !== "" && (
          <div className="bg-[#F4F6F2] border-l-4 border-[#899770] p-4 sm:p-4.5 shadow-2xs">
            <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#5A6844] mb-1.5">
              <span className="w-2 h-2 bg-[#899770] inline-block" />
              <span>Почему выбран для вашего маршрута</span>
            </div>
            <p className="text-sm text-[#262626] font-medium leading-relaxed">
              {stop.personalization_reason}
            </p>
          </div>
        )}

        {/* 5. Description block */}
        <div className="bg-[#FAF9F7] border border-[#E5E1D8] p-4 sm:p-5 space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#7A756D]">
            Описание произведения
          </h2>
          <p className="text-sm sm:text-base text-[#262626] leading-relaxed">
            {stop.description}
          </p>
          {stop.source_url && (
            <div className="pt-2">
              <a
                href={stop.source_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#899770] hover:text-[#75835C] underline underline-offset-2"
              >
                <span>Официальная карточка в каталоге ГМИИ им. А.С. Пушкина</span>
                <span aria-hidden="true">↗</span>
              </a>
            </div>
          )}
        </div>

        {/* 6. Look closer curator tip */}
        {stop.look_closer && stop.look_closer.trim() !== "" && (
          <div className="bg-[#FAF9F7] border border-[#E5E1D8] p-4 sm:p-5 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#7A756D]">
              <span className="text-sm" aria-hidden="true">🔍</span>
              <span>Взгляните ближе: совет куратора</span>
            </div>
            <p className="text-sm text-[#262626] leading-relaxed">
              {stop.look_closer}
            </p>
          </div>
        )}
      </div>
    </article>
  );
}
