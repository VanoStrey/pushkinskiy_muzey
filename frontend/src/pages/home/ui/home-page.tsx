import { useState } from "react";
import type { RouteGenerateRequest, RouteGenerateResponse } from "@/entities/route";
import { StopCard } from "@/entities/route";
import { RoutePreferencesForm, requestGenerateRoute } from "@/features/generate-route";
import { StopViewer, TourCompletion } from "@/features/tour-navigation";
import { MuseumHeader } from "@/widgets/museum-header";

type ViewStage = "preferences" | "generating" | "overview" | "tour" | "completed";

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
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGenerate = async (prefs: RouteGenerateRequest) => {
    setPreferences(prefs);
    setErrorMessage(null);
    setStage("generating");

    try {
      const generatedRoute = await requestGenerateRoute(prefs);
      setRoute(generatedRoute);
      setCurrentStopIndex(0);
      setUserAnswers({});
      setStage("overview");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Не удалось связаться с сервером маршрутизации.";
      setErrorMessage(msg);
      setStage("preferences");
    }
  };

  const handleStartTour = (startIndex = 0) => {
    setCurrentStopIndex(startIndex);
    setStage("tour");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSaveAnswer = (stopIndex: number, optionIndex: number) => {
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

  const handleRestart = () => {
    setStage("preferences");
    setRoute(null);
    setCurrentStopIndex(0);
    setUserAnswers({});
    setErrorMessage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-[#1A1918]">
      <MuseumHeader
        onReset={handleRestart}
        showReset={stage !== "preferences" && stage !== "generating"}
      />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 sm:py-10">
        {/* Error notification banner */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-[#FDF2F2] border border-[#F5C6CB] text-[#721C24] flex items-start justify-between gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              <div>
                <p className="font-semibold">Ошибка при генерации маршрута</p>
                <p className="text-xs text-[#842029] mt-0.5">{errorMessage}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleGenerate(preferences)}
              className="px-3 py-1.5 bg-[#9E2A2B] text-white rounded text-xs font-medium hover:bg-[#7E1E20] transition-colors shrink-0"
            >
              Повторить
            </button>
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
          <div className="max-w-md mx-auto py-16 text-center space-y-6">
            <div className="w-20 h-20 rounded-full border-4 border-[#9E2A2B]/20 border-t-[#9E2A2B] animate-spin mx-auto" />
            <div>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#1A1918]">
                Составляем ваш маршрут...
              </h2>
              <p className="text-sm text-[#726E67] mt-2">
                Yandex AI Studio анализирует залы и подбирает идеальную последовательность шедевров.
              </p>
            </div>
            <div className="bg-white border border-[#E3DDD4] p-4 rounded-xl text-xs text-[#5C5954] text-left space-y-1.5 shadow-2xs">
              <div className="flex items-center gap-2 text-[#9E2A2B] font-semibold">
                <span>✦</span>
                <span>Искусственный интеллект музея</span>
              </div>
              <p>Отбираем произведения из проверенного фонда Пушкинского музея на Волхонке.</p>
              <p>Готовим адаптированные истории и персональные загадки.</p>
            </div>
          </div>
        )}

        {/* 3. OVERVIEW STAGE */}
        {stage === "overview" && route && (
          <div className="space-y-8 max-w-2xl mx-auto">
            {/* Header info */}
            <div className="bg-white border border-[#E3DDD4] rounded-2xl p-6 sm:p-8 shadow-xs">
              {route.is_fallback ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF5F0] border border-[#E8E3DC] text-[11px] font-semibold text-[#8D4B00] mb-3">
                  <span>🏛️</span>
                  <span>Проверенный кураторский фонд</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#9E2A2B]/8 border border-[#9E2A2B]/20 text-[11px] font-semibold text-[#9E2A2B] mb-3">
                  <span>✨</span>
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
                  🧩 С интерактивными загадками
                </span>
              </div>
            </div>

            {/* Stops list timeline */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-serif text-xl font-bold text-[#1A1918]">
                  План вашего обхода
                </h3>
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

            {/* Main Start CTA */}
            <div className="pt-2 sticky bottom-4 z-30">
              <button
                type="button"
                onClick={() => handleStartTour(0)}
                className="w-full bg-[#9E2A2B] hover:bg-[#7E1E20] text-white py-4 px-6 rounded-xl font-medium text-lg transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Начать маршрут с 1-го шедевра</span>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* 4. TOUR STOP STAGE */}
        {stage === "tour" && route && (
          <StopViewer
            stop={route.stops[currentStopIndex]}
            totalStops={route.stops.length}
            onPrev={handlePrevStop}
            onNext={handleNextStop}
            onBackToOverview={() => setStage("overview")}
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
            onRestart={handleRestart}
            onReviewStop={(idx) => {
              setCurrentStopIndex(idx);
              setStage("tour");
            }}
          />
        )}
      </main>

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
