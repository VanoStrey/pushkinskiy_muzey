import { useState } from "react";
import type { BreakInfo, Stop } from "@/entities/route";
import { ExhibitPresentationCard } from "@/entities/route";
import { IconBreak, IconHint, IconStairs } from "@/shared/ui";
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
      <div className="flex items-center justify-between border-b border-ink/12 pb-3 gap-3">
        <button
          type="button"
          onClick={onBackToOverview}
          aria-label="Вернуться к полному плану маршрута"
          className="text-xs sm:text-sm font-semibold text-ink hover:text-accent flex items-center gap-1.5 transition-colors cursor-pointer py-1.5 px-2 -ml-2 hover:bg-ground"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span>План маршрута</span>
        </button>

        <div className="text-right">
          <span className="text-xs uppercase font-mono tracking-widest text-accent font-bold">
            Остановка {stop.position} из {totalStops}
          </span>
          <div
            role="progressbar"
            aria-valuenow={stop.position}
            aria-valuemin={1}
            aria-valuemax={totalStops}
            aria-label={`Прогресс маршрута: ${stop.position} из ${totalStops}`}
            className="w-24 sm:w-36 bg-sunken h-2 rounded-[var(--radius-pill)] shadow-[var(--shadow-pressed-sm)] overflow-hidden mt-1"
          >
            <div
              className="bg-accent h-full transition-all duration-300"
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
        <div className="bg-gilt-soft border-2 border-dashed border-gilt p-4 text-xs text-ink space-y-1.5 shadow-[var(--shadow-raised-sm)]">
          <div className="font-bold text-sm text-ink flex items-center gap-2">
            <IconBreak size={18} className="shrink-0 text-gilt" />
            <span>Следующий этап: пауза на отдых (~{breakInfo?.duration_minutes || 15} мин)</span>
          </div>
          <p className="text-muted leading-relaxed">
            {breakInfo?.location || "Итальянский дворик (Зал 15)"}. Рекомендуем отдохнуть на диванах перед переходом к следующим шедеврам.
          </p>
        </div>
      )}

      {/* Inter-floor transition guidance */}
      {isFloorTransition && nextStop && (
        <div className="bg-ground border-l-4 border-accent p-4 text-xs text-ink space-y-1 shadow-[var(--shadow-raised-sm)]">
          <div className="font-bold text-sm text-ink flex items-center gap-2">
            <IconStairs size={15} className="shrink-0" />
            <span>Переход на {nextStop.floor_number}-й этаж музея</span>
          </div>
          <p className="text-muted leading-relaxed">
            Следующий шедевр («{nextStop.title}») расположен в {nextStop.hall_number ? `Зале ${nextStop.hall_number}` : "зале 2-го этажа"}. Поднимитесь по Парадной лестнице у залов 14 и 15.
          </p>
        </div>
      )}

      {/* Navigation Footer */}
      <div className="pt-4 border-t border-ink/12 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onPrev}
          disabled={stop.position === 1}
          aria-label="Предыдущий экспонат"
          className="px-4 py-3 min-h-[48px] border border-ink/12 text-ink hover:bg-ground disabled:opacity-30 disabled:pointer-events-none text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
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
          className="flex-1 max-w-xs bg-accent hover:bg-accent-hover text-white py-3 px-5 min-h-[48px] text-sm sm:text-base font-semibold shadow-[var(--shadow-raised-sm)] hover:shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-accent"
        >
          <span>{isLastStop ? "Завершить маршрут" : "Следующий шедевр"}</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {!hasAnswered && Boolean(stop.challenge) && (
        <p className="text-center text-xs text-faint">
          <IconHint size={13} className="mr-1 inline-block align-text-bottom" />Выполните задание перед переходом к следующей остановке
        </p>
      )}
    </div>
  );
}
