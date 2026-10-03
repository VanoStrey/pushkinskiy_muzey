import { useState } from "react";
import type { Stop } from "@/entities/route";
import { ArtworkImage } from "@/entities/route";
import { StopChallenge } from "./stop-challenge";

interface StopViewerProps {
  stop: Stop;
  totalStops: number;
  onPrev: () => void;
  onNext: () => void;
  onBackToOverview: () => void;
  initialAnswer?: number;
  onSaveAnswer?: (stopIndex: number, optionIndex: number) => void;
  isLastStop: boolean;
}

export function StopViewer({
  stop,
  totalStops,
  onPrev,
  onNext,
  onBackToOverview,
  initialAnswer,
  onSaveAnswer,
  isLastStop,
}: StopViewerProps) {
  const [hasAnswered, setHasAnswered] = useState<boolean>(initialAnswer !== undefined);

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      {/* Top Navigation Bar & Progress */}
      <div className="flex items-center justify-between border-b border-[#E3DDD4] pb-3">
        <button
          type="button"
          onClick={onBackToOverview}
          className="text-xs font-medium text-[#726E67] hover:text-[#9E2A2B] flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>К списку остановок</span>
        </button>

        <div className="text-right">
          <span className="text-xs uppercase font-mono tracking-widest text-[#9E2A2B] font-bold">
            Остановка {stop.position} из {totalStops}
          </span>
          <div className="w-24 sm:w-32 bg-[#E8E3DC] h-1.5 rounded-full overflow-hidden mt-1">
            <div
              className="bg-[#9E2A2B] h-full transition-all duration-300"
              style={{ width: `${(stop.position / totalStops) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Hero Artwork Image */}
      <div className="rounded-xl overflow-hidden shadow-xs border border-[#E3DDD4] bg-white">
        <ArtworkImage
          src={stop.image_url}
          alt={stop.title}
          artist={stop.artist}
          className="w-full h-72 sm:h-96"
        />

        {/* Location bar */}
        {stop.location && (
          <div className="bg-[#FAF7F2] border-t border-[#E8E3DC] px-4 py-2.5 flex items-center justify-between text-xs text-[#5C5954]">
            <span className="flex items-center gap-1.5 font-medium">
              <svg className="w-4 h-4 text-[#9E2A2B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              {stop.location}
            </span>
            {stop.provenance_source && (
              <span className="text-[11px] text-[#8C867E] truncate max-w-[200px]" title={stop.provenance_source}>
                {stop.provenance_source}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Artwork Header */}
      <div>
        <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold text-[#1A1918] leading-tight">
          {stop.title}
        </h2>
        <p className="text-sm sm:text-base text-[#5C5954] mt-1 font-sans font-medium">
          {stop.artist} • <span className="text-[#8C867E]">{stop.date}</span>
        </p>
      </div>

      {/* Personalization Reason */}
      <div className="bg-[#FAF5F0] border-l-3 border-[#9E2A2B] rounded-r-xl p-4 sm:p-5 shadow-2xs">
        <div className="flex items-center gap-2 mb-1.5 text-xs font-semibold text-[#9E2A2B] uppercase tracking-wider">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>Почему это в вашем маршруте</span>
        </div>
        <p className="text-sm text-[#383531] leading-relaxed">
          {stop.personalization_reason}
        </p>
      </div>

      {/* Museum Description */}
      <div className="bg-white border border-[#E3DDD4] rounded-xl p-5 sm:p-6 shadow-xs space-y-3">
        <h3 className="font-serif text-lg font-bold text-[#1A1918]">
          Об экспонате
        </h3>
        <p className="text-sm sm:text-base text-[#474440] leading-relaxed">
          {stop.description}
        </p>
      </div>

      {/* Look Closer Observation */}
      <div className="bg-[#F6F4F0] border border-[#E3DDD4] rounded-xl p-5 shadow-xs">
        <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-[#7E5700] uppercase tracking-wider">
          <svg className="w-4 h-4 text-[#C69214]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <span>Взгляните ближе</span>
        </div>
        <p className="text-sm text-[#383531] leading-relaxed italic">
          "{stop.look_closer}"
        </p>
      </div>

      {/* Interactive Challenge */}
      <StopChallenge
        challenge={stop.challenge}
        initialSelectedOption={initialAnswer}
        onAnswer={(optionIndex) => {
          setHasAnswered(true);
          onSaveAnswer?.(stop.position - 1, optionIndex);
        }}
      />

      {/* Navigation Footer */}
      <div className="pt-4 border-t border-[#E3DDD4] flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onPrev}
          disabled={stop.position === 1}
          className="px-4 py-3 rounded-lg border border-[#D5CDC2] text-[#474440] hover:bg-[#F4EFEB] disabled:opacity-30 disabled:pointer-events-none text-sm font-medium transition-colors flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Назад</span>
        </button>

        <button
          type="button"
          onClick={onNext}
          className="flex-1 max-w-xs bg-[#9E2A2B] hover:bg-[#7E1E20] text-white py-3 px-5 rounded-lg text-sm sm:text-base font-medium shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>{isLastStop ? "Завершить маршрут" : "Следующий шедевр"}</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      {!hasAnswered && (
        <p className="text-center text-[11px] text-[#8C867E]">
          Рекомендуем ответить на загадку перед переходом к следующему залу
        </p>
      )}
    </div>
  );
}
