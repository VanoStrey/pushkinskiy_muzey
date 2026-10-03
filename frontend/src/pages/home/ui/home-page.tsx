import { useEffect, useState } from "react";
import type { RouteGenerateRequest, RouteGenerateResponse } from "@/entities/route";
import { StopCard } from "@/entities/route";
import { RoutePreferencesForm, requestGenerateRoute } from "@/features/generate-route";
import { StopViewer, TourCompletion } from "@/features/tour-navigation";
import { MuseumHeader } from "@/widgets/museum-header";

type ViewStage = "preferences" | "generating" | "overview" | "tour" | "completed";

const GENERATING_STEPS = [
  "Анализируем постоянную экспозицию на Волхонке...",
  "Подбираем шедевры под ваши интересы...",
  "Готовим задания-наблюдения по сведениям каталога...",
  "Сверяем остановки со связями зданий и залов...",
];

export function HomePage() {
  const [stage, setStage] = useState<ViewStage>("preferences");
  const [preferences, setPreferences] = useState<RouteGenerateRequest>({
    interests: ["импрессионизм", "загадки"],
    duration_minutes: 60,
    group_type: "friends",
    difficulty: "beginner",
    style: "quest",
  });
  const [route, setRoute] = useState<RouteGenerateResponse | null>(null);
  const [currentStopIndex, setCurrentStopIndex] = useState<number>(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, number | null>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generatingStepIndex, setGeneratingStepIndex] = useState(0);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Cycling dynamic hints during route generation
  useEffect(() => {
    if (stage !== "generating") return;
    const interval = setInterval(() => {
      setGeneratingStepIndex((prev) => (prev + 1) % GENERATING_STEPS.length);
    }, 2400);
    return () => clearInterval(interval);
  }, [stage]);

  const handleGenerate = async (prefs: RouteGenerateRequest) => {
    setPreferences(prefs);
    setErrorMessage(null);
    setGeneratingStepIndex(0);
    setStage("generating");

    try {
      const generatedRoute = await requestGenerateRoute(prefs);
      setRoute(generatedRoute);
      setCurrentStopIndex(0);
      setUserAnswers({});
      setStage("overview");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      let msg = "Не удалось построить маршрут. Пожалуйста, попробуйте еще раз.";
      if (err instanceof Error) {
        if (err.message.includes("Network error") || err.message.includes("Failed to fetch")) {
          msg = "Не удалось связаться с сервером музея. Проверьте интернет-соединение или повторите попытку.";
        } else {
          msg = err.message;
        }
      }
      setErrorMessage(msg);
      setStage("preferences");
    }
  };

  const handleStartTour = (startIndex = 0) => {
    if (!route || route.stops.length === 0) return;
    const safeIndex = Math.max(0, Math.min(startIndex, route.stops.length - 1));
    setCurrentStopIndex(safeIndex);
    setStage("tour");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSaveAnswer = (stopIndex: number, optionIndex: number | null) => {
    setUserAnswers((prev) => ({ ...prev, [stopIndex]: optionIndex }));
  };

  const handleNextStop = () => {
    if (!route) return;
    if (currentStopIndex < route.stops.length - 1) {
      setCurrentStopIndex((prev) => prev + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setStage("completed");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePrevStop = () => {
    if (currentStopIndex > 0) {
      setCurrentStopIndex((prev) => prev - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Safe restart with confirmation if user is mid-tour
  const handleRequestRestart = () => {
    const isMidTour =
      stage === "tour" ||
      (stage === "overview" && (currentStopIndex > 0 || Object.keys(userAnswers).length > 0));

    if (isMidTour) {
      setShowResetConfirm(true);
    } else {
      confirmRestart();
    }
  };

  const confirmRestart = () => {
    setShowResetConfirm(false);
    setStage("preferences");
    setRoute(null);
    setCurrentStopIndex(0);
    setUserAnswers({});
    setErrorMessage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Determine smart resume index for overview CTA
  const answeredStopsCount = route ? Object.keys(userAnswers).length : 0;
  const isTourInProgress = answeredStopsCount > 0 || currentStopIndex > 0;
  const allStopsAnswered = route && route.stops.length > 0 && answeredStopsCount === route.stops.length;

  // Find next unanswered stop or current stop
  let nextRecommendedIndex = currentStopIndex;
  if (route && route.stops.length > 0) {
    const firstUnanswered = route.stops.findIndex((_, idx) => userAnswers[idx] === undefined);
    if (firstUnanswered !== -1) {
      nextRecommendedIndex = firstUnanswered;
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-[#1A1918]">
      <MuseumHeader
        onReset={handleRequestRestart}
        showReset={stage !== "preferences" && stage !== "generating"}
      />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 sm:py-10">
        {/* Error notification banner with retry & dismiss */}
        {errorMessage && (
          <div
            role="alert"
            className="mb-6 p-4 rounded-2xl bg-[#FDF2F2] border border-[#F5C6CB] text-[#721C24] flex items-start justify-between gap-3 text-sm shadow-xs animate-in fade-in"
          >
            <div className="flex items-start gap-3">
              <span className="text-xl shrink-0" aria-hidden="true">⚠️</span>
              <div>
                <p className="font-semibold text-[#842029]">Ошибка при построении маршрута</p>
                <p className="text-xs text-[#842029] mt-0.5 leading-relaxed">{errorMessage}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleGenerate(preferences)}
                className="px-3 py-1.5 bg-[#9E2A2B] hover:bg-[#7E1E20] text-white rounded-lg text-xs font-medium transition-colors cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#9E2A2B]"
              >
                Повторить
              </button>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                aria-label="Скрыть сообщение об ошибке"
                className="p-1 text-[#842029] hover:bg-[#F8D7DA] rounded-lg transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* 1. PREFERENCES STAGE */}
        {stage === "preferences" && (
          <RoutePreferencesForm
            initialValues={preferences}
            onSubmit={handleGenerate}
            isLoading={false}
          />
        )}

        {/* 2. GENERATING / LOADING STAGE */}
        {stage === "generating" && (
          <div className="max-w-md mx-auto py-12 sm:py-16 text-center space-y-6">
            <div
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-[#9E2A2B]/20 border-t-[#9E2A2B] animate-spin mx-auto"
              role="status"
              aria-label="Генерация маршрута"
            />
            <div>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#1A1918]">
                Составляем ваш маршрут...
              </h1>
              <p
                role="status"
                aria-live="polite"
                className="text-sm text-[#9E2A2B] font-medium mt-2 min-h-[24px] transition-all"
              >
                {GENERATING_STEPS[generatingStepIndex]}
              </p>
            </div>

            <div className="bg-white border border-[#E3DDD4] p-5 rounded-2xl text-xs text-[#5C5954] text-left space-y-2 shadow-2xs">
              <div className="flex items-center gap-2 text-[#9E2A2B] font-semibold">
                <span aria-hidden="true">✦</span>
                <span>Искусственный интеллект музея</span>
              </div>
              <p className="leading-relaxed">
                Отбираем произведения из проверенного постоянного фонда Пушкинского музея на Волхонке.
              </p>
              <p className="leading-relaxed">
                Подготавливаем персональные пояснения и задания-наблюдения без выдуманных ответов.
              </p>
            </div>

            {/* Cancel action */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setStage("preferences")}
                className="text-xs text-[#726E67] hover:text-[#1A1918] py-2 px-4 rounded-lg border border-[#E3DDD4] bg-white transition-colors cursor-pointer"
              >
                ← Вернуться к настройкам параметров
              </button>
            </div>
          </div>
        )}

        {/* 3. OVERVIEW STAGE */}
        {stage === "overview" && route && (
          <div className="space-y-8 max-w-2xl mx-auto">
            {/* Empty route state protection */}
            {route.stops.length === 0 ? (
              <div className="bg-white border border-[#E3DDD4] rounded-2xl p-8 text-center space-y-4 shadow-xs">
                <span className="text-3xl" aria-hidden="true">🏛️</span>
                <h2 className="font-serif text-2xl font-bold text-[#1A1918]">
                  Маршрут не содержит остановок
                </h2>
                <p className="text-sm text-[#5C5954] max-w-md mx-auto">
                  По выбранным критериям не удалось найти подходящие экспонаты в каталоге. Попробуйте изменить параметры или выбрать другие темы.
                </p>
                <button
                  type="button"
                  onClick={() => setStage("preferences")}
                  className="bg-[#9E2A2B] text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-[#7E1E20] transition-colors cursor-pointer"
                >
                  Изменить параметры
                </button>
              </div>
            ) : (
              <>
                {/* Header info */}
                <div className="bg-white border border-[#E3DDD4] rounded-2xl p-6 sm:p-8 shadow-xs">
                  {route.is_fallback ? (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF5F0] border border-[#E8E3DC] text-[11px] font-semibold text-[#8D4B00] mb-3">
                      <span aria-hidden="true">🏛️</span>
                      <span>Официальный каталог · нейтральный маршрут</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#9E2A2B]/8 border border-[#9E2A2B]/20 text-[11px] font-semibold text-[#9E2A2B] mb-3">
                      <span aria-hidden="true">✨</span>
                      <span>Сформировано Yandex AI Studio</span>
                    </div>
                  )}

                  <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#1A1918] leading-tight">
                    {route.title}
                  </h1>

                  <p className="text-[#5C5954] text-sm sm:text-base mt-3 leading-relaxed">
                    {route.intro}
                  </p>

                  {/* Meta tags */}
                  <div className="flex flex-wrap items-center gap-2 mt-5 pt-5 border-t border-[#E8E3DC] text-xs text-[#5C5954]">
                    <span className="bg-[#FAF7F2] px-3 py-1.5 rounded-lg border border-[#E3DDD4] font-medium">
                      ⏱️ ~{route.duration_minutes} минут
                    </span>
                    <span className="bg-[#FAF7F2] px-3 py-1.5 rounded-lg border border-[#E3DDD4] font-medium">
                      🖼️ {route.stops.length} остановок
                    </span>
                    <span className="bg-[#FAF7F2] px-3 py-1.5 rounded-lg border border-[#E3DDD4] font-medium">
                      👁️ Задания-наблюдения без оценки
                    </span>
                    {answeredStopsCount > 0 && (
                      <span className="bg-[#EEF7ED] text-[#2E7D32] px-3 py-1.5 rounded-lg border border-[#C8E6C9] font-medium">
                        ✓ Пройдено: {answeredStopsCount} из {route.stops.length}
                      </span>
                    )}
                  </div>
                </div>

                {/* Stops list timeline */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="font-serif text-xl font-bold text-[#1A1918]">
                      План вашего обхода
                    </h2>
                    <span className="text-xs text-[#726E67]">
                      Нажмите на экспонат для перехода
                    </span>
                  </div>

                  <div className="space-y-3">
                    {route.stops.map((stop, idx) => (
                      <StopCard
                        key={stop.exhibit_id}
                        stop={stop}
                        onClick={() => handleStartTour(idx)}
                        isCompleted={userAnswers[idx] !== undefined}
                      />
                    ))}
                  </div>
                </div>

                {/* Main Dynamic CTA */}
                <div className="pt-2 sticky bottom-4 z-30">
                  {allStopsAnswered ? (
                    <button
                      type="button"
                      onClick={() => {
                        setStage("completed");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="w-full bg-[#2E7D32] hover:bg-[#1B5E20] text-white py-4 px-6 min-h-[52px] rounded-xl font-medium text-base sm:text-lg transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#2E7D32]"
                    >
                      <span>Все остановки пройдены! Посмотреть итоги</span>
                      <span aria-hidden="true">🎉</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleStartTour(isTourInProgress ? nextRecommendedIndex : 0)}
                      className="w-full bg-[#9E2A2B] hover:bg-[#7E1E20] text-white py-4 px-6 min-h-[52px] rounded-xl font-medium text-base sm:text-lg transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#9E2A2B]"
                    >
                      <span>
                        {isTourInProgress
                          ? `Продолжить маршрут (Остановка ${nextRecommendedIndex + 1})`
                          : "Начать маршрут с 1-го шедевра"}
                      </span>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* 4. TOUR STOP STAGE */}
        {stage === "tour" && route && route.stops[currentStopIndex] && (
          <StopViewer
            stop={route.stops[currentStopIndex]}
            totalStops={route.stops.length}
            onPrev={handlePrevStop}
            onNext={handleNextStop}
            onBackToOverview={() => {
              setStage("overview");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            initialAnswer={userAnswers[currentStopIndex]}
            onSaveAnswer={handleSaveAnswer}
            isLastStop={currentStopIndex === route.stops.length - 1}
          />
        )}

        {/* 5. COMPLETED STAGE */}
        {stage === "completed" && route && (
          <TourCompletion
            route={route}
            userAnswers={userAnswers}
            onRestart={handleRequestRestart}
            onReviewStop={(idx) => {
              setCurrentStopIndex(idx);
              setStage("tour");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            onViewOverview={() => {
              setStage("overview");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        )}
      </main>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-[#E3DDD4]">
            <div className="w-12 h-12 rounded-full bg-[#FDF2F2] text-[#9E2A2B] flex items-center justify-center text-xl mx-auto">
              ⚠️
            </div>
            <div className="text-center">
              <h2 id="confirm-modal-title" className="font-serif text-xl font-bold text-[#1A1918]">
                Начать новый маршрут?
              </h2>
              <p className="text-xs text-[#5C5954] mt-1.5 leading-relaxed">
                Вы находитесь в процессе прохождения. Если начать заново, текущий прогресс и отметки заданий будут сброшены.
              </p>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-3 px-4 rounded-xl border border-[#D5CDC2] text-xs font-semibold text-[#474440] hover:bg-[#F4EFEB] transition-colors cursor-pointer"
              >
                Продолжить тур
              </button>
              <button
                type="button"
                onClick={confirmRestart}
                className="flex-1 py-3 px-4 rounded-xl bg-[#9E2A2B] hover:bg-[#7E1E20] text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Да, начать заново
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Museum Footer */}
      <footer className="border-t border-[#E8E3DC] bg-[#FAF8F5] py-6 text-center text-xs text-[#8C867E]">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>Государственный музей изобразительных искусств имени А.С. Пушкина</span>
          <div className="flex items-center gap-4">
            <a
              href="/api/docs"
              className="text-[#5C5954] hover:text-[#9E2A2B] transition-colors"
            >
              API Документация
            </a>
            <a
              href="https://pushkinmuseum.art/open_data/index.php?lang=ru"
              target="_blank"
              rel="noreferrer"
              className="text-[#5C5954] hover:text-[#9E2A2B] transition-colors"
            >
              Открытые данные музея
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
