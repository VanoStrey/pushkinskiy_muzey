import { Frame, IconCheck, IconPlace } from "@/shared/ui";
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
      aria-label={`Остановка ${stop.position}: ${stop.title}, ${stop.artist || "автор не указан"}. ${
        isCompleted ? "Пройдена." : "Нажмите для перехода к экспонату."
      }`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={`group relative cursor-pointer rounded-[var(--radius-surface)] p-3.5 text-left transition-all duration-200 sm:p-4 ${
        isCompleted
          ? "bg-ground shadow-[var(--shadow-pressed)]"
          : "bg-surface shadow-[var(--shadow-raised)] active:shadow-[var(--shadow-pressed)]"
      }`}
    >
      <div className="flex items-start gap-3.5 sm:gap-4">
        {/* Step number */}
        <div className="flex shrink-0 flex-col items-center">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
              isCompleted
                ? "bg-accent text-white shadow-[var(--shadow-pressed-sm)]"
                : "bg-ground text-ink shadow-[var(--shadow-raised-sm)]"
            }`}
          >
            {isCompleted ? <IconCheck size={16} /> : stop.position}
          </span>
          <span className="wall-label mt-1.5">шаг</span>
        </div>

        {/* Reproduction keeps museum geometry: sharp, shadowed, never rounded */}
        <Frame className="h-24 w-20 shrink-0 sm:h-26 sm:w-22">
          <ArtworkImage
            src={stop.image_url}
            alt={stop.title}
            artist={stop.artist || "Автор не указан в данных музея"}
            showMagnifyButton={false}
            compact={true}
            className="h-full w-full"
          />
        </Frame>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 font-serif text-base font-bold leading-snug text-ink transition-colors group-hover:text-accent sm:text-lg">
              {stop.title}
            </h3>
            {isCompleted && <span className="wall-label shrink-0 text-accent">пройдено</span>}
          </div>

          <p className="mt-0.5 line-clamp-1 text-xs font-medium text-muted">
            {stop.artist || "Автор не указан в данных музея"},{" "}
            {stop.date || "Дата не указана в данных музея"}
          </p>

          {stop.location && (
            <p className="mt-1 line-clamp-1 flex items-center gap-1 text-[11px] text-faint">
              <IconPlace size={13} className="shrink-0 text-accent" />
              <span>{stop.location}</span>
            </p>
          )}

          {stop.personalization_reason && stop.personalization_reason.trim() !== "" && (
            <div className="mt-2.5 line-clamp-2 rounded-[var(--radius-control)] bg-ground px-2.5 py-2 text-[11px] leading-relaxed text-muted shadow-[var(--shadow-pressed-sm)]">
              <span className="font-bold text-accent-ink">В вашем маршруте: </span>
              {stop.personalization_reason}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
