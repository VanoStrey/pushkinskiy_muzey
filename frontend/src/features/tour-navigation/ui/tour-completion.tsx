import type { RouteGenerateResponse } from "@/entities/route";
import { ArtworkImage } from "@/entities/route";

interface TourCompletionProps {
  route: RouteGenerateResponse;
  userAnswers: Record<number, number>;
  onRestart: () => void;
  onReviewStop: (index: number) => void;
}

export function TourCompletion({
  route,
  userAnswers,
  onRestart,
  onReviewStop,
}: TourCompletionProps) {
  let correctCount = 0;
  route.stops.forEach((stop, idx) => {
    if (userAnswers[idx] === stop.challenge.correct_option) {
      correctCount += 1;
    }
  });

  return (
    <div className="max-w-2xl mx-auto space-y-8 py-6 text-center">
      {/* Header */}
      <div className="bg-white border border-[#E3DDD4] rounded-2xl p-6 sm:p-8 shadow-xs">
        <div className="w-16 h-16 rounded-full bg-[#FAF5F0] border-2 border-[#9E2A2B] text-[#9E2A2B] flex items-center justify-center mx-auto text-2xl mb-4">
          🏛️
        </div>

        <span className="text-xs uppercase tracking-widest text-[#9E2A2B] font-semibold">
          Маршрут завершён
        </span>
        <h2 className="font-serif text-3xl sm:text-4xl font-bold text-[#1A1918] mt-1">
          {route.title}
        </h2>
        <p className="text-sm text-[#5C5954] mt-2 max-w-md mx-auto">
          Вы прошли персональный маршрут по залам Пушкинского музея и открыли для себя {route.stops.length} шедевров мирового искусства.
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto mt-6 pt-6 border-t border-[#E8E3DC]">
          <div className="p-3 bg-[#FAF7F2] rounded-lg">
            <div className="text-2xl font-serif font-bold text-[#1A1918]">
              {route.stops.length}
            </div>
            <div className="text-[11px] text-[#7A756D] uppercase">
              Шедевров изучено
            </div>
          </div>
          <div className="p-3 bg-[#FAF7F2] rounded-lg">
            <div className="text-2xl font-serif font-bold text-[#9E2A2B]">
              {correctCount} / {route.stops.length}
            </div>
            <div className="text-[11px] text-[#7A756D] uppercase">
              Загадок разгадано
            </div>
          </div>
        </div>
      </div>

      {/* Artworks gallery summary */}
      <div className="bg-white border border-[#E3DDD4] rounded-2xl p-6 shadow-xs text-left">
        <h3 className="font-serif text-xl font-bold text-[#1A1918] mb-4">
          Произведения в вашем маршруте
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {route.stops.map((stop, idx) => (
            <div
              key={stop.exhibit_id}
              onClick={() => onReviewStop(idx)}
              className="group border border-[#E8E3DC] hover:border-[#9E2A2B] rounded-lg p-2.5 transition-all cursor-pointer bg-[#FAFAFA] flex flex-col justify-between"
            >
              <div className="h-28 rounded overflow-hidden mb-2">
                <ArtworkImage
                  src={stop.image_url}
                  alt={stop.title}
                  artist={stop.artist}
                  showMagnifyButton={false}
                  className="w-full h-full"
                />
              </div>
              <div>
                <p className="font-serif text-xs font-bold text-[#1A1918] line-clamp-1 group-hover:text-[#9E2A2B]">
                  {stop.title}
                </p>
                <p className="text-[10px] text-[#7A756D] line-clamp-1">
                  {stop.artist}
                </p>
                <span className="text-[10px] text-[#9E2A2B] font-medium mt-1 inline-block">
                  Посмотреть снова →
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
        <button
          type="button"
          onClick={onRestart}
          className="w-full sm:w-auto bg-[#9E2A2B] hover:bg-[#7E1E20] text-white px-8 py-3.5 rounded-xl font-medium text-base transition-colors shadow-xs cursor-pointer"
        >
          Собрать новый маршрут
        </button>
      </div>
    </div>
  );
}
