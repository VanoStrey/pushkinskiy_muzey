import type { RouteGenerateResponse } from "@/entities/route";
import { ArtworkImage } from "@/entities/route";
import { IconArrowRight, IconCheck, IconDot, IconMuseum } from "@/shared/ui";

interface TourCompletionProps {
  route: RouteGenerateResponse;
  userAnswers: Record<number, number | null>;
  onRestart: () => void;
  onReviewStop: (index: number) => void;
  onViewOverview?: () => void;
}

export function TourCompletion({
  route,
  userAnswers,
  onRestart,
  onReviewStop,
  onViewOverview,
}: TourCompletionProps) {
  let correctCount = 0;
  let answeredCount = 0;
  let questionCount = 0;

  route.stops.forEach((stop, idx) => {
    if (stop.challenge.type === "question") questionCount += 1;
    if (userAnswers[idx] !== undefined) {
      answeredCount += 1;
      if (stop.challenge && stop.challenge.type === "question" && userAnswers[idx] === stop.challenge.correct_option) {
        correctCount += 1;
      }
    }
  });

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-4 sm:py-6 text-center">
      {/* Header */}
      <div className="bg-surface border border-ink/12 p-6 sm:p-8 shadow-[var(--shadow-raised-sm)]">
        <div
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[var(--radius-control)] bg-ground text-accent shadow-[var(--shadow-pressed)]"
          aria-hidden="true"
        >
          <IconMuseum size={30} />
        </div>

        <span className="text-xs uppercase tracking-widest text-accent font-semibold">
          Маршрут успешно пройден
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-ink mt-1 leading-tight">
          {route.title}
        </h1>
        <p className="text-sm text-muted mt-2 max-w-md mx-auto leading-relaxed">
          Поздравляем! Вы завершили персональное путешествие по шедеврам Государственного музея им. А.С. Пушкина.
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto mt-6 pt-6 border-t border-ink/12">
          <div className="p-3 bg-surface rounded-[var(--radius-control)] shadow-[var(--shadow-raised-sm)]">
            <div className="text-2xl font-serif font-bold text-ink">
              {route.stops.length}
            </div>
            <div className="text-[11px] text-faint uppercase tracking-wider mt-0.5">
              Шедевров изучено
            </div>
          </div>
          <div className="p-3 bg-surface rounded-[var(--radius-control)] shadow-[var(--shadow-raised-sm)]">
            <div className="text-2xl font-serif font-bold text-accent">
              {questionCount ? `${correctCount} / ${questionCount}` : `${answeredCount} / ${route.stops.length}`}
            </div>
            <div className="text-[11px] text-faint uppercase tracking-wider mt-0.5">
              {questionCount ? "Загадок разгадано" : "Заданий выполнено"}
            </div>
          </div>
        </div>

        {answeredCount < route.stops.length && (
          <p className="text-xs text-faint mt-3">
            Вы отметили выполненными {answeredCount} из {route.stops.length} заданий.
          </p>
        )}
      </div>

      {/* Artworks gallery summary */}
      <div className="bg-surface border border-ink/12 p-5 sm:p-6 shadow-[var(--shadow-raised-sm)] text-left">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-xl font-bold text-ink">
            Произведения вашего маршрута
          </h2>
          <span className="text-xs text-muted">
            Нажмите на карточку, чтобы пересмотреть
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {route.stops.map((stop, idx) => {
            const hasAnswer = userAnswers[idx] !== undefined;
            const isObservation = stop.challenge?.type === "observation";
            const isCorrect =
              hasAnswer &&
              Boolean(
                stop.challenge &&
                  stop.challenge.type === "question" &&
                  userAnswers[idx] === stop.challenge.correct_option
              );
            const isDone = hasAnswer && (isObservation || isCorrect);

            return (
              <div
                key={stop.exhibit_id}
                role="button"
                tabIndex={0}
                onClick={() => onReviewStop(idx)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onReviewStop(idx);
                  }
                }}
                aria-label={`Экспонат ${stop.position}: ${stop.title}. Нажмите для повторного просмотра.`}
                className="group border border-ink/12 hover:border-accent p-2.5 transition-all cursor-pointer bg-ground hover:bg-surface flex flex-col justify-between shadow-[var(--shadow-raised-sm)] hover:shadow-[var(--shadow-raised-sm)] focus:outline-hidden focus:ring-2 focus:ring-accent"
              >
                <div>
                  <div className="h-28 overflow-hidden mb-2 relative">
                    <ArtworkImage
                      src={stop.image_url}
                      alt={stop.title}
                      artist={stop.artist || "Автор не указан в данных музея"}
                      showMagnifyButton={false}
                      compact={true}
                      className="w-full h-full"
                    />
                    {hasAnswer && (
                      <span
                        className={`absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center text-[10px] font-bold text-white shadow-[var(--shadow-raised-sm)] ${
                          isDone ? "bg-correct" : "bg-gilt"
                        }`}
                        title={
                          isObservation
                            ? "Задание выполнено"
                            : isCorrect
                            ? "Загадка разгадана верно"
                            : "Загадка пройдена"
                        }
                      >
                        {isDone ? <IconCheck size={13} /> : <IconDot size={13} />}
                      </span>
                    )}
                  </div>
                  <h3 className="font-serif text-xs font-bold text-ink line-clamp-2 group-hover:text-accent transition-colors">
                    {stop.title}
                  </h3>
                  <p className="text-[10px] text-faint line-clamp-1 mt-0.5">
                    {stop.artist}
                  </p>
                </div>
                <span className="text-[10px] text-accent font-medium mt-2 inline-flex items-center gap-1">
                  <span>Пересмотреть</span>
                  <IconArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <button
          type="button"
          onClick={onRestart}
          className="w-full sm:w-auto bg-accent hover:bg-accent-hover text-white px-8 py-3.5 font-medium text-base transition-colors shadow-[var(--shadow-raised-sm)] cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-accent"
        >
          Собрать новый маршрут
        </button>

        {onViewOverview && (
          <button
            type="button"
            onClick={onViewOverview}
            className="w-full sm:w-auto bg-surface border border-ink/15 text-muted hover:bg-ground px-6 py-3.5 font-medium text-base transition-colors cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-accent"
          >
            Вернуться к плану маршрута
          </button>
        )}
      </div>
    </div>
  );
}
