import { useState } from "react";
import type { BreakInfo, Stop } from "@/entities/route";
import { ExhibitPresentationCard } from "@/entities/route";
import { StopChallenge } from "./stop-challenge";

interface StopViewerProps {
  stop: Stop;
  totalStops: number;
  onPrev: () => void;
  onNext: () => void;
  onBackToOverview: () => void;
  initialAnswer?: number | null;
  onSaveAnswer?: (stopIndex: number, optionIndex: number | null) => void;
  isLastStop: boolean;
  onOpenMap?: () => void;
  nextStop?: Stop;
  hasBreakAfterCurrent?: boolean;
  breakInfo?: BreakInfo | null;
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
  onOpenMap,
  nextStop,
  hasBreakAfterCurrent = false,
  breakInfo,
}: StopViewerProps) {
  const [answeredLocally, setAnsweredLocally] = useState<boolean>(false);
  const [prevStopPosition, setPrevStopPosition] = useState<number>(stop.position);

  // Reset local answer flag if stop position changes
  if (stop.position !== prevStopPosition) {
    setPrevStopPosition(stop.position);
    setAnsweredLocally(false);
  }

  const hasAnswered = initialAnswer !== undefined || answeredLocally;

  // Inter-floor transition indicator between consecutive stops
  const isFloorTransition = Boolean(
    nextStop?.floor_number &&
      stop.floor_number &&
      nextStop.floor_number !== stop.floor_number
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      {/* Top Navigation Bar & Progress */}
      <div className="flex items-center justify-between border-b border-[#E5E1D8] pb-3 gap-3">
        <button
          type="button"
          onClick={onBackToOverview}
          aria-label="Вернуться к полному плану маршрута"
          className="text-xs sm:text-sm font-semibold text-[#262626] hover:text-[#899770] flex items-center gap-1.5 transition-colors cursor-pointer py-1.5 px-2 -ml-2 hover:bg-[#F7F5F0]"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>План маршрута</span>
        </button>

        <div className="text-right">
          <span className="text-xs uppercase font-mono tracking-widest text-[#899770] font-bold">
            Остановка {stop.position} из {totalStops}
          </span>
          <div
            role="progressbar"
            aria-valuenow={stop.position}
            aria-valuemin={1}
            aria-valuemax={totalStops}
            aria-label={`Прогресс маршрута: ${stop.position} из ${totalStops}`}
            className="w-24 sm:w-36 bg-[#E5E1D8] h-2 overflow-hidden mt-1"
          >
            <div
              className="bg-[#899770] h-full transition-all duration-300"
              style={{ width: `${(stop.position / totalStops) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Dedicated Exhibit Presentation React Template */}
      <ExhibitPresentationCard
        stop={stop}
        totalStops={totalStops}
        onOpenMap={onOpenMap}
      />

      {/* Interactive Challenge / Observation (both questions and observations) */}
      {stop.challenge && (
        <StopChallenge
          key={`${stop.exhibit_id}-${stop.position}`}
          challenge={stop.challenge}
          initialSelectedOption={initialAnswer}
          onAnswer={(optionIndex) => {
            setAnsweredLocally(true);
            onSaveAnswer?.(stop.position - 1, optionIndex);
          }}
        />
      )}

      {/* Break upcoming notice if break is scheduled right after this stop */}
      {hasBreakAfterCurrent && (
        <div className="bg-[#FAF5F0] border-2 border-dashed border-[#C69214] p-4 text-xs text-[#8D4B00] space-y-1.5 shadow-2xs">
          <div className="font-bold text-sm text-[#8D4B00] flex items-center gap-2">
            <span className="text-base" aria-hidden="true">☕</span>
            <span>Следующий этап: пауза на отдых (~{breakInfo?.duration_minutes || 15} мин)</span>
          </div>
          <p className="text-[#5C5954] leading-relaxed">
            {breakInfo?.location || "Итальянский дворик (Зал 15)"}. Рекомендуем отдохнуть на диванах перед переходом к следующим шедеврам.
          </p>
        </div>
      )}

      {/* Inter-floor transition guidance */}
      {isFloorTransition && nextStop && (
        <div className="bg-[#F4F6F2] border-l-4 border-[#899770] p-4 text-xs text-[#262626] space-y-1 shadow-2xs">
          <div className="font-bold text-sm text-[#1A1918] flex items-center gap-2">
            <span aria-hidden="true">🪜</span>
            <span>Переход на {nextStop.floor_number}-й этаж музея</span>
          </div>
          <p className="text-[#5C5954] leading-relaxed">
            Следующий шедевр («{nextStop.title}») расположен в {nextStop.hall_number ? `Зале ${nextStop.hall_number}` : "зале 2-го этажа"}. Поднимитесь по Парадной лестнице у залов 14 и 15.
          </p>
        </div>
      )}

      {/* Navigation Footer */}
      <div className="pt-4 border-t border-[#E5E1D8] flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onPrev}
          disabled={stop.position === 1}
          aria-label="Предыдущий экспонат"
          className="px-4 py-3 min-h-[48px] border border-[#E5E1D8] text-[#262626] hover:bg-[#F7F5F0] disabled:opacity-30 disabled:pointer-events-none text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Назад</span>
        </button>

        <button
          type="button"
          onClick={onNext}
          aria-label={isLastStop ? "Завершить маршрут и посмотреть итоги" : "Перейти к следующему шедевру"}
          className="flex-1 max-w-xs bg-[#899770] hover:bg-[#75835C] text-white py-3 px-5 min-h-[48px] text-sm sm:text-base font-semibold shadow-xs hover:shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#899770]"
        >
          <span>{isLastStop ? "Завершить маршрут" : "Следующий шедевр"}</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {!hasAnswered && Boolean(stop.challenge) && (
        <p className="text-center text-xs text-[#8C867E]">
          💡 Выполните задание перед переходом к следующей остановке
        </p>
      )}
    </div>
  );
}
