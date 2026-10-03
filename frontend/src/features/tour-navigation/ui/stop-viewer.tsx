import { useState } from "react";
import type { Stop } from "@/entities/route";
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
}: StopViewerProps) {
  const [answeredLocally, setAnsweredLocally] = useState<boolean>(false);
  const [prevStopPosition, setPrevStopPosition] = useState<number>(stop.position);

  // Reset local answer flag if stop position changes
  if (stop.position !== prevStopPosition) {
    setPrevStopPosition(stop.position);
    setAnsweredLocally(false);
  }

  const hasAnswered = initialAnswer !== undefined || answeredLocally;

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

      {/* Interactive Challenge Options (if quiz type) */}
      {stop.challenge && Array.isArray(stop.challenge.options) && stop.challenge.options.length > 0 && (
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

      {!hasAnswered && Boolean(stop.challenge && Array.isArray(stop.challenge.options) && stop.challenge.options.length > 0) && (
        <p className="text-center text-xs text-[#8C867E]">
          💡 Отметьте выполненным задание перед переходом к следующей остановке
        </p>
      )}
    </div>
  );
}
