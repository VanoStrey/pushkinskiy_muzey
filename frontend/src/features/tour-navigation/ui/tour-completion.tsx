import type { RouteGenerateResponse } from "@/entities/route";
import { ArtworkImage } from "@/entities/route";

interface TourCompletionProps {
  route: RouteGenerateResponse;
  userAnswers: Record<number, number>;
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

  route.stops.forEach((stop, idx) => {
    if (userAnswers[idx] !== undefined) {
      answeredCount += 1;
      if (userAnswers[idx] === stop.challenge.correct_option) {
        correctCount += 1;
      }
    }
  });

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-4 sm:py-6 text-center">
      {/* Header */}
      <div className="bg-white border border-[#E3DDD4] rounded-2xl p-6 sm:p-8 shadow-xs">
        <div
          className="w-16 h-16 rounded-full bg-[#FAF5F0] border-2 border-[#9E2A2B] text-[#9E2A2B] flex items-center justify-center mx-auto text-2xl mb-4"
          aria-hidden="true"
        >
          🏛️
        </div>

        <span className="text-xs uppercase tracking-widest text-[#9E2A2B] font-semibold">
          Маршрут успешно пройден
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#1A1918] mt-1 leading-tight">
          {route.title}
        </h1>
        <p className="text-sm text-[#5C5954] mt-2 max-w-md mx-auto leading-relaxed">
          Поздравляем! Вы завершили персональное путешествие по шедеврам Государственного музея им. А.С. Пушкина.
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto mt-6 pt-6 border-t border-[#E8E3DC]">
          <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#EBE5DE]">
            <div className="text-2xl font-serif font-bold text-[#1A1918]">
              {route.stops.length}
            </div>
            <div className="text-[11px] text-[#7A756D] uppercase tracking-wider mt-0.5">
              Шедевров изучено
            </div>
          </div>
          <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#EBE5DE]">
            <div className="text-2xl font-serif font-bold text-[#9E2A2B]">
              {correctCount} / {route.stops.length}
            </div>
            <div className="text-[11px] text-[#7A756D] uppercase tracking-wider mt-0.5">
              Загадок разгадано
            </div>
          </div>
        </div>

        {answeredCount < route.stops.length && (
          <p className="text-xs text-[#8C867E] mt-3">
            Вы ответили на {answeredCount} из {route.stops.length} заданий.
          </p>
        )}
      </div>

      {/* Artworks gallery summary */}
      <div className="bg-white border border-[#E3DDD4] rounded-2xl p-5 sm:p-6 shadow-xs text-left">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-xl font-bold text-[#1A1918]">
            Произведения вашего маршрута
          </h2>
          <span className="text-xs text-[#726E67]">
            Нажмите на карточку, чтобы пересмотреть
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {route.stops.map((stop, idx) => {
            const hasAnswer = userAnswers[idx] !== undefined;
            const isCorrect = hasAnswer && userAnswers[idx] === stop.challenge.correct_option;

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
                className="group border border-[#E8E3DC] hover:border-[#9E2A2B] rounded-xl p-2.5 transition-all cursor-pointer bg-[#FAFAFA] hover:bg-white flex flex-col justify-between shadow-2xs hover:shadow-xs focus:outline-hidden focus:ring-2 focus:ring-[#9E2A2B]"
              >
                <div>
                  <div className="h-28 rounded-lg overflow-hidden mb-2 relative">
                    <ArtworkImage
                      src={stop.image_url}
                      alt={stop.title}
                      artist={stop.artist}
                      showMagnifyButton={false}
                      compact={true}
                      className="w-full h-full"
                    />
                    {hasAnswer && (
                      <span
                        className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-xs ${
                          isCorrect ? "bg-[#2E7D32]" : "bg-[#8D4B00]"
                        }`}
                        title={isCorrect ? "Загадка разгадана верно" : "Загадка пройдена"}
                      >
                        {isCorrect ? "✓" : "•"}
                      </span>
                    )}
                  </div>
                  <p className="font-serif text-xs font-bold text-[#1A1918] line-clamp-1 group-hover:text-[#9E2A2B] transition-colors">
                    {stop.title}
                  </p>
                  <p className="text-[10px] text-[#7A756D] line-clamp-1 mt-0.5">
                    {stop.artist}
                  </p>
                </div>
                <span className="text-[10px] text-[#9E2A2B] font-medium mt-2 inline-flex items-center gap-1">
                  <span>Пересмотреть</span>
                  <span className="group-hover:translate-x-0.5 transition-transform">→</span>
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
          className="w-full sm:w-auto bg-[#9E2A2B] hover:bg-[#7E1E20] text-white px-8 py-3.5 rounded-xl font-medium text-base transition-colors shadow-xs cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#9E2A2B]"
        >
          Собрать новый маршрут
        </button>

        {onViewOverview && (
          <button
            type="button"
            onClick={onViewOverview}
            className="w-full sm:w-auto bg-white border border-[#D5CDC2] text-[#474440] hover:bg-[#F4EFEB] px-6 py-3.5 rounded-xl font-medium text-base transition-colors cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#9E2A2B]"
          >
            Вернуться к плану маршрута
          </button>
        )}
      </div>
    </div>
  );
}
