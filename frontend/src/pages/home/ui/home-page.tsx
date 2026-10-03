import { useEffect, useRef, useState } from "react";
import type { RouteGenerateRequest, RouteGenerateResponse, TourStage } from "@/entities/route";
import { StopCard, clearTourState, loadTourState, saveTourState } from "@/entities/route";
import { RoutePreferencesForm, requestGenerateRoute } from "@/features/generate-route";
import { InteractiveMap, StopViewer, TourCompletion } from "@/features/tour-navigation";
import {
  IconArrowLeft,
  IconArtwork,
  IconBreak,
  IconCaution,
  IconCelebrate,
  IconCheck,
  IconClose,
  IconDuration,
  IconMuseum,
  IconObserve,
  IconPlan,
  IconSpark,
} from "@/shared/ui";
import { MuseumHeader } from "@/widgets/museum-header";

type ViewStage = "preferences" | "generating" | "overview" | "tour" | "completed";

const GENERATING_STEPS = [
  "Анализируем постоянную экспозицию на Волхонке...",
  "Подбираем шедевры постоянной экспозиции под выбранное время...",
  "Готовим персональные истории и задания по сведениям каталога...",
  "Сверяем залы и планируем комфортные паузы...",
];

export function HomePage() {
  // Synchronously restore initial state from localStorage to prevent flash of empty form or race conditions
  const [initialTourState] = useState(() => loadTourState());

  const [stage, setStage] = useState<ViewStage>(() => {
    if (initialTourState) {
      if (
        initialTourState.stage === "tour" ||
        initialTourState.stage === "overview" ||
        initialTourState.stage === "completed"
      ) {
        if (initialTourState.route && initialTourState.route.stops?.length > 0) {
          return initialTourState.stage;
        }
      }
    }
    return "preferences";
  });

  const [preferences, setPreferences] = useState<RouteGenerateRequest | null>(
    () => initialTourState?.preferences ?? null
  );

  const [route, setRoute] = useState<RouteGenerateResponse | null>(
    () => initialTourState?.route ?? null
  );

  const [currentStopIndex, setCurrentStopIndex] = useState<number>(() => {
    const stopsCount = initialTourState?.route?.stops?.length ?? 0;
    if (stopsCount > 0 && initialTourState?.currentStopIndex !== undefined) {
      return Math.max(0, Math.min(initialTourState.currentStopIndex, stopsCount - 1));
    }
    return 0;
  });

  const [userAnswers, setUserAnswers] = useState<Record<number, number | null>>(
    () => initialTourState?.userAnswers ?? {}
  );

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generatingStepIndex, setGeneratingStepIndex] = useState(0);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMapOpenMobile, setIsMapOpenMobile] = useState(false);
  const [dismissedBreakIndex, setDismissedBreakIndex] = useState<number | null>(
    () => initialTourState?.dismissedBreakIndex ?? null
  );

  const isRestoredRef = useRef(true);

  // Guards against race conditions and stale background responses
  const activeRequestIdRef = useRef<number>(0);

  // Cycling dynamic hints during route generation
  useEffect(() => {
    if (stage !== "generating") return;
    const interval = setInterval(() => {
      setGeneratingStepIndex((prev) => (prev + 1) % GENERATING_STEPS.length);
    }, 2400);
    return () => clearInterval(interval);
  }, [stage]);

  // Escape key handler for confirmation dialog
  useEffect(() => {
    if (!showResetConfirm) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowResetConfirm(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showResetConfirm]);

  // Automatically persist tour state to localStorage on progress updates
  useEffect(() => {
    if (!isRestoredRef.current) return;
    if (stage === "generating") return; // Never save temporary loading state

    // If on preferences stage with no route and no preferences, clean storage
    if (stage === "preferences" && !preferences && !route) {
      clearTourState();
      return;
    }

    saveTourState({
      stage: stage as TourStage,
      preferences,
      route,
      currentStopIndex,
      userAnswers,
      dismissedBreakIndex,
    });
  }, [stage, preferences, route, currentStopIndex, userAnswers, dismissedBreakIndex]);

  const handleGenerate = async (prefs: RouteGenerateRequest) => {
    // Prevent accidental parallel duplicate requests
    if (isGenerating) return;
    setIsGenerating(true);
    const currentRequestId = ++activeRequestIdRef.current;

    setPreferences(prefs);
    setErrorMessage(null);
    setGeneratingStepIndex(0);
    setStage("generating");

    try {
      const generatedRoute = await requestGenerateRoute(prefs);

      // Verify this request is still active and was not cancelled or superseded
      if (currentRequestId !== activeRequestIdRef.current) return;

      setRoute(generatedRoute);
      setCurrentStopIndex(0);
      setUserAnswers({});
      setStage("overview");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      if (currentRequestId !== activeRequestIdRef.current) return;

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
    } finally {
      if (currentRequestId === activeRequestIdRef.current) {
        setIsGenerating(false);
      }
    }
  };

  const handleCancelGenerating = () => {
    // Invalidate the running request so its late response is ignored
    activeRequestIdRef.current = 0;
    setIsGenerating(false);
    setStage("preferences");
  };

  const stops = Array.isArray(route?.stops) ? route.stops : [];

  const handleStartTour = (startIndex = 0) => {
    if (stops.length === 0) return;
    const safeIndex = Math.max(0, Math.min(startIndex, stops.length - 1));
    setCurrentStopIndex(safeIndex);
    setStage("tour");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSaveAnswer = (stopIndex: number, optionIndex: number | null) => {
    setUserAnswers((prev) => ({ ...prev, [stopIndex]: optionIndex }));
  };

  const handleNextStop = () => {
    if (stops.length === 0) return;
    if (currentStopIndex < stops.length - 1) {
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
    activeRequestIdRef.current = 0;
    setIsGenerating(false);
    setShowResetConfirm(false);
    clearTourState();
    setStage("preferences");
    setRoute(null);
    setCurrentStopIndex(0);
    setUserAnswers({});
    setErrorMessage(null);
    setPreferences(null);
    setDismissedBreakIndex(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Determine smart resume index for overview CTA
  const answeredStopsCount = Object.keys(userAnswers).length;
  const isTourInProgress = answeredStopsCount > 0 || currentStopIndex > 0;
  const allStopsAnswered = stops.length > 0 && answeredStopsCount >= stops.length;

  // Find next unanswered stop or fallback to current stop
  let nextRecommendedIndex = currentStopIndex;
  if (stops.length > 0) {
    const firstUnanswered = stops.findIndex((_, idx) => userAnswers[idx] === undefined);
    if (firstUnanswered !== -1) {
      nextRecommendedIndex = firstUnanswered;
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-ground text-ink">
      <MuseumHeader
        onReset={handleRequestRestart}
        showReset={stage !== "preferences" && stage !== "generating"}
      />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 sm:py-10">
        {/* Error notification banner with retry & dismiss */}
        {errorMessage && (
          <div
            role="alert"
            className="mb-6 p-4 bg-wrong/10 border border-wrong/40 text-wrong flex items-start justify-between gap-3 text-sm shadow-[var(--shadow-raised-sm)] animate-in fade-in"
          >
            <div className="flex items-start gap-3">
              <IconCaution size={22} className="shrink-0 text-gilt" />
              <div>
                <p className="font-semibold text-wrong">Ошибка при построении маршрута</p>
                <p className="text-xs text-wrong mt-0.5 leading-relaxed">{errorMessage}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={isGenerating || !preferences}
                onClick={() => preferences && handleGenerate(preferences)}
                className="px-3 py-1.5 bg-accent hover:bg-accent-hover disabled:bg-sunken text-white text-xs font-medium transition-colors cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-accent"
              >
                Повторить
              </button>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                aria-label="Скрыть сообщение об ошибке"
                className="p-1 text-wrong hover:bg-wrong/15 transition-colors cursor-pointer"
              >
                <IconClose size={16} />
              </button>
            </div>
          </div>
        )}

        {/* 1. PREFERENCES STAGE */}
        {stage === "preferences" && (
          <RoutePreferencesForm
            initialValues={preferences ?? undefined}
            onSubmit={handleGenerate}
            isLoading={isGenerating}
          />
        )}

        {/* 2. GENERATING / LOADING STAGE */}
        {stage === "generating" && (
          <div className="max-w-md mx-auto py-12 sm:py-16 text-center space-y-6">
            <div
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-accent/20 border-t-accent animate-spin mx-auto"
              role="status"
              aria-label="Генерация маршрута"
            />
            <div>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-ink">
                Составляем ваш маршрут...
              </h1>
              <p
                role="status"
                aria-live="polite"
                className="text-sm text-accent font-medium mt-2 min-h-[24px] transition-all"
              >
                {GENERATING_STEPS[generatingStepIndex]}
              </p>
            </div>

            <div className="bg-surface shadow-[var(--shadow-raised)] rounded-[var(--radius-surface)] p-5 text-xs text-muted text-left space-y-2 shadow-[var(--shadow-raised-sm)]">
              <div className="flex items-center gap-2 text-accent font-semibold">
                <IconSpark size={16} />
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
                onClick={handleCancelGenerating}
                className="text-xs text-muted hover:text-ink py-2 px-4 border border-ink/12 bg-surface transition-colors cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-accent"
              >
                <IconArrowLeft size={16} /> Вернуться к настройкам параметров
              </button>
            </div>
          </div>
        )}

        {/* 3. OVERVIEW STAGE */}
        {stage === "overview" && route && (
          <div className="space-y-8 max-w-2xl mx-auto">
            {/* Empty route state protection */}
            {stops.length === 0 ? (
              <div className="bg-surface shadow-[var(--shadow-raised)] rounded-[var(--radius-surface)] p-8 text-center space-y-4 shadow-[var(--shadow-raised-sm)]">
                <IconMuseum size={34} className="mx-auto text-muted" />
                <h2 className="font-serif text-2xl font-bold text-ink">
                  Маршрут не содержит остановок
                </h2>
                <p className="text-sm text-muted max-w-md mx-auto">
                  По выбранным критериям не удалось найти подходящие экспонаты в каталоге. Попробуйте изменить параметры или выбрать другие темы.
                </p>
                <button
                  type="button"
                  onClick={() => setStage("preferences")}
                  className="bg-accent text-white px-6 py-3 text-sm font-medium hover:bg-accent-hover transition-colors cursor-pointer"
                >
                  Изменить параметры
                </button>
              </div>
            ) : (
              <>
                {/* Header info */}
                <div className="bg-surface shadow-[var(--shadow-raised)] rounded-[var(--radius-surface)] p-6 sm:p-8 shadow-[var(--shadow-raised-sm)]">
                  {route.is_fallback ? (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-gilt-soft border border-ink/12 text-[11px] font-semibold text-ink mb-3">
                      <IconMuseum size={14} />
                      <span>Официальный каталог · нейтральный маршрут</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-ground border border-accent/30 text-[11px] font-semibold text-accent mb-3">
                      <IconSpark size={14} />
                      <span>Сформировано Yandex AI Studio</span>
                    </div>
                  )}

                  <h1 className="font-serif text-3xl sm:text-4xl font-bold text-ink leading-tight">
                    {route.title}
                  </h1>

                  <p className="text-muted text-sm sm:text-base mt-3 leading-relaxed">
                    {route.intro}
                  </p>

                  {/* Meta tags */}
                  <div className="flex flex-wrap items-center gap-2 mt-5 pt-5 border-t border-ink/12 text-xs text-muted">
                    <span className="bg-surface px-3 py-1.5 border border-ink/12 font-medium text-accent">
                      <IconDuration size={14} /> {route.duration_minutes >= 180 ? "3+ часа (полное погружение)" : `~${route.duration_minutes} минут`}
                    </span>
                    <span className="bg-surface px-3 py-1.5 border border-ink/12 font-medium">
                      <IconArtwork size={14} /> {stops.length} остановок
                    </span>
                    {route.has_break && (
                      <span className="bg-gilt-soft text-ink px-3 py-1.5 border border-gilt/40 font-medium">
                        <IconBreak size={14} /> Перерыв на отдых в зале 15
                      </span>
                    )}
                    <span className="bg-surface px-3 py-1.5 border border-ink/12 font-medium">
                      <IconObserve size={14} /> Задания-наблюдения без оценки
                    </span>
                    {answeredStopsCount > 0 && (
                      <span className="bg-correct/12 text-correct px-3 py-1.5 border border-correct/40 font-medium">
                        <IconCheck size={14} /> Пройдено: {answeredStopsCount} из {stops.length}
                      </span>
                    )}
                  </div>
                </div>

                {/* Interactive Museum Vector Plan */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="font-serif text-xl font-bold text-ink flex items-center gap-2">
                      <IconPlan size={20} /><span>Интерактивный план музея</span>
                    </h2>
                    <span className="text-xs text-muted">
                      {stops.length} остановок на схеме этажей
                    </span>
                  </div>
                  <InteractiveMap
                    stops={stops}
                    currentStopIndex={isTourInProgress ? nextRecommendedIndex : 0}
                    onSelectStop={(idx) => handleStartTour(idx)}
                    breakInfo={route.break_info}
                    hasBreak={route.has_break}
                    breakAfterStop={route.break_after_stop}
                  />
                </div>

                {/* Stops list timeline */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="font-serif text-xl font-bold text-ink">
                      План вашего обхода
                    </h2>
                    <span className="text-xs text-muted">
                      Нажмите на экспонат для перехода
                    </span>
                  </div>

                  <div className="space-y-3">
                    {stops.map((stop, idx) => (
                      <div key={stop.exhibit_id} className="space-y-3">
                        <StopCard
                          stop={stop}
                          onClick={() => handleStartTour(idx)}
                          isCompleted={userAnswers[idx] !== undefined}
                        />
                        {route.has_break && route.break_after_stop === idx + 1 && (
                          <div className="bg-gilt-soft border-2 border-dashed border-gilt p-4 sm:p-5 shadow-[var(--shadow-raised-sm)] space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2 text-ink font-bold text-sm">
                                <IconBreak size={18} className="text-gilt" />
                                <span>{route.break_info?.title || "Перерыв на отдых"} (~{route.break_info?.duration_minutes || 15} мин)</span>
                              </div>
                              <span className="text-[11px] font-semibold text-ink bg-gilt-soft px-2.5 py-1 border border-gilt/40">
                                {route.break_info?.location || "Итальянский дворик (Зал 15)"}
                              </span>
                            </div>
                            <p className="text-xs text-muted leading-relaxed">
                              {route.break_info?.note}
                            </p>
                          </div>
                        )}
                      </div>
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
                      className="w-full bg-correct hover:bg-correct text-white py-4 px-6 min-h-[52px] font-medium text-base sm:text-lg transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-correct"
                    >
                      <span>Все остановки пройдены! Посмотреть итоги</span>
                      <IconCelebrate size={18} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleStartTour(isTourInProgress ? nextRecommendedIndex : 0)}
                      className="w-full bg-accent hover:bg-accent-hover text-white py-4 px-6 min-h-[52px] font-medium text-base sm:text-lg transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-accent"
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
        {stage === "tour" && route && stops[currentStopIndex] && (
          <div className="space-y-4">
            {/* Break mid-tour alert if current stop is after break */}
            {route.has_break &&
              route.break_after_stop === currentStopIndex &&
              dismissedBreakIndex !== currentStopIndex && (
                <div className="max-w-2xl lg:max-w-none mx-auto bg-gilt-soft border border-gilt p-3.5 sm:p-4 text-xs text-ink flex flex-col sm:flex-row items-start justify-between gap-3 shadow-[var(--shadow-raised-sm)] animate-in fade-in">
                  <div className="flex items-start gap-3">
                    <IconBreak size={20} className="shrink-0 text-gilt" />
                    <div className="space-y-1">
                      <div className="font-bold text-sm text-ink">
                        Рекомендуемая пауза на отдых: Итальянский дворик (Зал 15)
                      </div>
                      <p className="text-muted leading-relaxed">
                        {route.break_info?.note ||
                          "Буфет в цоколе Главного здания временно закрыт на техобслуживание (по официальным данным музея). В залах 14 и 15 есть удобные диваны для отдыха под естественным освещением."}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => setIsMapOpenMobile(true)}
                      className="px-2.5 py-1.5 border border-gilt bg-surface text-ink font-semibold text-xs hover:bg-gilt-soft transition-colors cursor-pointer"
                    >
                      План зала 15
                    </button>
                    <button
                      type="button"
                      onClick={() => setDismissedBreakIndex(currentStopIndex)}
                      className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-white font-semibold text-xs transition-colors cursor-pointer"
                    >
                      Продолжить экскурсию
                    </button>
                  </div>
                </div>
              )}

            {/* Responsive tour layout: split on desktop, full-width on mobile */}
            <div className="lg:grid lg:grid-cols-12 lg:gap-8 items-start">
              <div className="lg:col-span-7">
                <StopViewer
                  stop={stops[currentStopIndex]}
                  totalStops={stops.length}
                  onPrev={handlePrevStop}
                  onNext={handleNextStop}
                  onBackToOverview={() => {
                    setStage("overview");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  initialAnswer={userAnswers[currentStopIndex]}
                  onSaveAnswer={handleSaveAnswer}
                  isLastStop={currentStopIndex === stops.length - 1}
                  onOpenMap={() => setIsMapOpenMobile(true)}
                  nextStop={stops[currentStopIndex + 1]}
                  hasBreakAfterCurrent={Boolean(
                    route.has_break && route.break_after_stop === currentStopIndex + 1
                  )}
                  breakInfo={route.break_info}
                />
              </div>

              {/* Desktop Sticky Vector Plan */}
              <div className="hidden lg:block lg:col-span-5 sticky top-20">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted font-medium px-1">
                    <span>План музея и положение в залах</span>
                    <span className="text-accent font-semibold">
                      {stops[currentStopIndex].hall_number ? `Зал ${stops[currentStopIndex].hall_number}` : "Главное здание"}
                    </span>
                  </div>
                  <InteractiveMap
                    stops={stops}
                    currentStopIndex={currentStopIndex}
                    onSelectStop={(idx) => setCurrentStopIndex(idx)}
                    breakInfo={route.break_info}
                    hasBreak={route.has_break}
                    breakAfterStop={route.break_after_stop}
                    compact={true}
                  />
                </div>
              </div>
            </div>

            {/* Mobile Map Drawer Modal */}
            {isMapOpenMobile && (
              <div
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
                role="dialog"
                aria-modal="true"
                aria-label="Интерактивный план музея"
              >
                <div className="bg-surface w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in">
                  <div className="p-3 sm:p-4 border-b border-ink/12 flex items-center justify-between bg-ground">
                    <div className="font-serif font-bold text-sm sm:text-base text-ink flex items-center gap-1.5">
                      <IconPlan size={18} /><span>План Главного здания (Волхонка 12)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsMapOpenMobile(false)}
                      className="text-xs text-muted hover:text-ink px-3 py-1.5 border border-ink/12 bg-surface cursor-pointer font-medium hover:border-accent"
                    >
                      Вернуться к экспонату
                    </button>
                  </div>
                  <div className="overflow-y-auto p-3">
                    <InteractiveMap
                      stops={stops}
                      currentStopIndex={currentStopIndex}
                      onSelectStop={(idx) => {
                        setCurrentStopIndex(idx);
                        setIsMapOpenMobile(false);
                      }}
                      breakInfo={route.break_info}
                      hasBreak={route.has_break}
                      breakAfterStop={route.break_after_stop}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
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
          onClick={() => setShowResetConfirm(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-surface max-w-sm w-full p-6 space-y-4 shadow-xl border border-ink/12"
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[var(--radius-control)] bg-ground text-gilt shadow-[var(--shadow-pressed-sm)]">
              <IconCaution size={24} />
            </div>
            <div className="text-center">
              <h2 id="confirm-modal-title" className="font-serif text-xl font-bold text-ink">
                Начать новый маршрут?
              </h2>
              <p className="text-xs text-muted mt-1.5 leading-relaxed">
                Вы находитесь в процессе прохождения. Если начать заново, текущий прогресс и отметки заданий будут сброшены.
              </p>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-3 px-4 border border-ink/15 text-xs font-semibold text-muted hover:bg-ground transition-colors cursor-pointer"
              >
                Продолжить тур
              </button>
              <button
                type="button"
                onClick={confirmRestart}
                className="flex-1 py-3 px-4 bg-accent hover:bg-accent-hover text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Да, начать заново
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Museum Footer */}
      <footer className="border-t border-ink/12 bg-ground py-6 text-center text-xs text-faint">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>Государственный музей изобразительных искусств имени А.С. Пушкина</span>
          <div className="flex items-center gap-4">
            <a
              href="/api/docs"
              className="text-muted hover:text-accent transition-colors"
            >
              API Документация
            </a>
            <a
              href="https://pushkinmuseum.art/open_data/index.php?lang=ru"
              target="_blank"
              rel="noreferrer"
              className="text-muted hover:text-accent transition-colors"
            >
              Открытые данные музея
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
