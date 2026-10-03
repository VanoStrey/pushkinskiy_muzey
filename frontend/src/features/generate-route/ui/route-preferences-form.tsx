import { useState } from "react";
import type {
  DifficultyLevel,
  GroupType,
  RouteGenerateRequest,
  TourStyle,
} from "@/entities/route";

interface RoutePreferencesFormProps {
  initialValues?: RouteGenerateRequest;
  onSubmit: (values: RouteGenerateRequest) => void;
  isLoading?: boolean;
}

const AVAILABLE_INTERESTS: { id: string; label: string; hint: string }[] = [
  { id: "импрессионизм", label: "Импрессионизм", hint: "Моне, Дега, вибрация света" },
  { id: "постимпрессионизм", label: "Постимпрессионизм", hint: "Ван Гог, Гоген, Сезанн" },
  { id: "загадки", label: "Тайны и символы", hint: "Скрытые детали и аллегории" },
  { id: "древний мир", label: "Древний Египет", hint: "Мумии, саркофаги, резьба" },
  { id: "возрождение", label: "Ренессанс", hint: "Микеланджело, Кранах" },
  { id: "человек", label: "Человек и эмоции", hint: "Пикассо, драмы Рембрандта" },
  { id: "скульптура", label: "Скульптура и пластика", hint: "От античности до бронзы" },
  { id: "шедевры", label: "Главные шедевры", hint: "Золотой фонд музея" },
];

const DURATION_OPTIONS = [
  { minutes: 60, label: "1 час", stopsHint: "5 шедевров (экспресс)" },
  { minutes: 90, label: "1.5 часа", stopsHint: "5–6 шедевров" },
  { minutes: 120, label: "2 часа", stopsHint: "6 шедевров (углубленный)" },
  { minutes: 180, label: "3+ часа", stopsHint: "6 шедевров (полное погружение)" },
];

const GROUP_OPTIONS: { id: GroupType; label: string; icon: string }[] = [
  { id: "solo", label: "Один / одна", icon: "👤" },
  { id: "friends", label: "С друзьями", icon: "👥" },
  { id: "family", label: "С семьей", icon: "👨‍👩‍👧" },
  { id: "couple", label: "Пара", icon: "✨" },
];

const DIFFICULTY_OPTIONS: { id: DifficultyLevel; label: string; desc: string }[] = [
  { id: "beginner", label: "Впервые", desc: "Простые и яркие акценты" },
  { id: "amateur", label: "Любитель", desc: "Контекст и интересные факты" },
  { id: "expert", label: "Знаток", desc: "Тонкости композиции и истории" },
];

const STYLE_OPTIONS: { id: TourStyle; label: string; desc: string }[] = [
  { id: "quest", label: "Квест наблюдений", desc: "Интерактивный поиск деталей без викторины" },
  { id: "story", label: "Связная история", desc: "Единый драматургический сюжет визита" },
  { id: "meditative", label: "Вдумчивое созерцание", desc: "Спокойный диалог с искусством" },
];

const MAX_INTERESTS = 4;
const MIN_INTERESTS = 1;

export function RoutePreferencesForm({
  initialValues,
  onSubmit,
  isLoading = false,
}: RoutePreferencesFormProps) {
  const [selectedInterests, setSelectedInterests] = useState<string[]>(
    initialValues?.interests && initialValues.interests.length > 0
      ? initialValues.interests.slice(0, MAX_INTERESTS)
      : ["импрессионизм", "загадки"]
  );
  const [duration, setDuration] = useState<number>(initialValues?.duration_minutes ?? 180);
  const [groupType, setGroupType] = useState<GroupType>(initialValues?.group_type ?? "friends");
  const [difficulty, setDifficulty] = useState<DifficultyLevel>(initialValues?.difficulty ?? "amateur");
  const [style, setStyle] = useState<TourStyle>(initialValues?.style ?? "quest");
  const [includeBreak, setIncludeBreak] = useState<boolean>(initialValues?.include_break ?? true);
  const [visitorComment, setVisitorComment] = useState<string>(initialValues?.visitor_comment ?? "");
  const [interestsNotice, setInterestsNotice] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const isPending = isLoading || isSubmitting;
  const [prevInitialValues, setPrevInitialValues] = useState(initialValues);

  if (initialValues !== prevInitialValues) {
    setPrevInitialValues(initialValues);
    setIsSubmitting(false);
  }

  const toggleInterest = (id: string) => {
    if (selectedInterests.includes(id)) {
      if (selectedInterests.length > MIN_INTERESTS) {
        setSelectedInterests(selectedInterests.filter((item) => item !== id));
        setInterestsNotice(null);
      } else {
        setInterestsNotice("Выберите хотя бы одну тему для построения маршрута.");
      }
    } else {
      if (selectedInterests.length < MAX_INTERESTS) {
        setSelectedInterests([...selectedInterests, id]);
        setInterestsNotice(null);
      } else {
        setInterestsNotice(`Выбрано максимум ${MAX_INTERESTS} темы для гармоничного маршрута. Снимите одну, чтобы выбрать другую.`);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isPending) return;
    if (selectedInterests.length === 0) {
      setInterestsNotice("Пожалуйста, выберите хотя бы одну тему интереса.");
      return;
    }
    setIsSubmitting(true);
    onSubmit({
      interests: selectedInterests,
      duration_minutes: duration,
      group_type: groupType,
      difficulty,
      style,
      include_break: includeBreak,
      visitor_comment: visitorComment.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8 max-w-2xl mx-auto">
      {/* Editorial Intro Banner */}
      <div className="text-center pt-1 pb-2 sm:pb-4">
        <span className="inline-block text-[11px] uppercase tracking-widest text-[#899770] font-semibold bg-[#F4F6F2] border border-[#DCE4D4] px-3 py-1 mb-3">
          Государственный музей им. А.С. Пушкина
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#1A1918] tracking-tight leading-tight">
          Маршрут, который понимает ваши интересы
        </h1>
        <p className="mt-3 text-[#5C5954] text-sm sm:text-base leading-relaxed max-w-lg mx-auto">
          Персональный AI-гид для основательного визита (3+ часа): глубокое погружение в историю шедевров по проверенному каталогу музея, скрытые смыслы полотен и атмосферу залов.
        </p>
      </div>

      {/* 1. What interests you? */}
      <section
        className="bg-white border border-[#E5E1D8] p-5 sm:p-6 shadow-xs"
        role="group"
        aria-labelledby="interests-heading"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-1 mb-3">
          <h2 id="interests-heading" className="font-serif text-xl font-bold text-[#000000]">
            1. Что вам интересно?
          </h2>
          <span className="text-xs text-[#7A756D]">
            Выбрано {selectedInterests.length} из {MAX_INTERESTS}
          </span>
        </div>

        {interestsNotice && (
          <div
            role="alert"
            className="mb-3 px-3 py-2 bg-[#FFF9F2] border border-[#FFE0B2] text-[#8D4B00] text-xs flex items-center gap-1.5 animate-in fade-in"
          >
            <span>ℹ️</span>
            <span>{interestsNotice}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {AVAILABLE_INTERESTS.map((item) => {
            const isSelected = selectedInterests.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                role="checkbox"
                aria-checked={isSelected}
                onClick={() => toggleInterest(item.id)}
                className={`text-left p-3.5 border transition-all flex flex-col justify-between min-h-[56px] cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-[#899770] ${
                  isSelected
                    ? "bg-[#F4F6F2] border-[#899770] shadow-xs text-[#000000]"
                    : "bg-[#FAFAFA] border-[#E5E1D8] hover:border-[#899770]/60 hover:bg-[#FDFBF7] text-[#262626]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-semibold ${isSelected ? "text-[#5A6844]" : "text-[#000000]"}`}>
                    {item.label}
                  </span>
                  <span
                    className={`w-4 h-4 border flex items-center justify-center text-[10px] shrink-0 ${
                      isSelected ? "border-[#899770] bg-[#899770] text-white" : "border-[#C4BCB1]"
                    }`}
                    aria-hidden="true"
                  >
                    {isSelected ? "✓" : ""}
                  </span>
                </div>
                <span className="text-[11px] text-[#7A756D] mt-1">
                  {item.hint}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. Custom Visitor Comment */}
      <section className="bg-white border border-[#E5E1D8] p-5 sm:p-6 shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="visitor-comment-input" className="font-serif text-xl font-bold text-[#000000]">
            2. Краткий комментарий о своих интересах
          </label>
          <span className="text-[11px] font-semibold text-[#899770] bg-[#F4F6F2] px-2.5 py-0.5 border border-[#DCE4D4]">
            По желанию
          </span>
        </div>
        <p className="text-xs text-[#7A756D] leading-relaxed">
          Напишите своими словами, что вам особенно интересно (эпохи, сюжеты, персонажи или детали), и AI-гид подберёт залы и произведения с фокусом на ваш запрос:
        </p>
        <textarea
          id="visitor-comment-input"
          value={visitorComment}
          onChange={(e) => setVisitorComment(e.target.value)}
          placeholder="Например: хочу увидеть древнеегипетские саркофаги и загадочные портреты, меня привлекают необычные детали и золотые украшения..."
          maxLength={500}
          rows={3}
          className="w-full mt-2 p-3.5 text-sm text-[#262626] bg-[#FAF9F7] border border-[#E5E1D8] focus:outline-hidden focus:ring-2 focus:ring-[#899770] focus:border-[#899770] transition-all resize-none placeholder:text-[#A8A29A]"
        />
        <div className="flex justify-end text-[11px] text-[#A8A29A]">
          <span>{visitorComment.length} / 500 символов</span>
        </div>
      </section>

      {/* 3. Duration */}
      <section
        className="bg-white border border-[#E5E1D8] p-5 sm:p-6 shadow-xs"
        role="radiogroup"
        aria-labelledby="duration-heading"
      >
        <h2 id="duration-heading" className="font-serif text-xl font-bold text-[#000000] mb-1">
          3. Сколько у вас времени?
        </h2>
        <p className="text-xs text-[#7A756D] mb-3">
          Для визита на 3+ часа маршрут включает глубокое знакомство с коллекцией, контекстные загадки и комфортные паузы.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {DURATION_OPTIONS.map((opt) => (
            <button
              key={opt.minutes}
              type="button"
              role="radio"
              aria-checked={duration === opt.minutes}
              onClick={() => setDuration(opt.minutes)}
              className={`p-3.5 border text-center transition-all cursor-pointer min-h-[56px] focus:outline-hidden focus:ring-2 focus:ring-[#899770] ${
                duration === opt.minutes
                  ? "bg-[#F4F6F2] border-[#899770] text-[#5A6844] font-semibold ring-1 ring-[#899770]"
                  : "bg-[#FAFAFA] border-[#E5E1D8] hover:border-[#899770]/60 hover:bg-[#FDFBF7] text-[#262626]"
              }`}
            >
              <div className="text-base font-bold">{opt.label}</div>
              <div className="text-[11px] text-[#7A756D] mt-0.5">{opt.stopsHint}</div>
            </button>
          ))}
        </div>
      </section>

      {/* 4. Who came? Group Type */}
      <section
        className="bg-white border border-[#E5E1D8] p-5 sm:p-6 shadow-xs"
        role="radiogroup"
        aria-labelledby="group-heading"
      >
        <h2 id="group-heading" className="font-serif text-xl font-bold text-[#000000] mb-3">
          4. Кто сегодня в музее?
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {GROUP_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={groupType === opt.id}
              onClick={() => setGroupType(opt.id)}
              className={`p-3.5 border text-center transition-all flex flex-col items-center justify-center cursor-pointer min-h-[64px] focus:outline-hidden focus:ring-2 focus:ring-[#899770] ${
                groupType === opt.id
                  ? "bg-[#F4F6F2] border-[#899770] text-[#5A6844] font-semibold ring-1 ring-[#899770]"
                  : "bg-[#FAFAFA] border-[#E5E1D8] hover:border-[#899770]/60 hover:bg-[#FDFBF7] text-[#262626]"
              }`}
            >
              <span className="text-xl mb-1" aria-hidden="true">{opt.icon}</span>
              <span className="text-xs font-medium">{opt.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 5. Format & 6. Difficulty */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Style */}
        <section
          className="bg-white border border-[#E5E1D8] p-5 shadow-xs"
          role="radiogroup"
          aria-labelledby="style-heading"
        >
          <h2 id="style-heading" className="font-serif text-lg font-bold text-[#000000] mb-3">
            5. Формат подачи
          </h2>
          <div className="space-y-2">
            {STYLE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={style === opt.id}
                onClick={() => setStyle(opt.id)}
                className={`w-full text-left p-3 border text-xs transition-all cursor-pointer min-h-[48px] focus:outline-hidden focus:ring-2 focus:ring-[#899770] ${
                  style === opt.id
                    ? "bg-[#F4F6F2] border-[#899770] text-[#000000]"
                    : "bg-[#FAFAFA] border-[#E5E1D8] hover:border-[#899770]/60 hover:bg-[#FDFBF7] text-[#262626]"
                }`}
              >
                <div className={`font-semibold ${style === opt.id ? "text-[#5A6844]" : ""}`}>
                  {opt.label}
                </div>
                <div className="text-[11px] text-[#7A756D] mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        </section>

        {/* Difficulty */}
        <section
          className="bg-white border border-[#E5E1D8] p-5 shadow-xs"
          role="radiogroup"
          aria-labelledby="diff-heading"
        >
          <h2 id="diff-heading" className="font-serif text-lg font-bold text-[#000000] mb-3">
            6. Опыт в искусстве
          </h2>
          <div className="space-y-2">
            {DIFFICULTY_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={difficulty === opt.id}
                onClick={() => setDifficulty(opt.id)}
                className={`w-full text-left p-3 border text-xs transition-all cursor-pointer min-h-[48px] focus:outline-hidden focus:ring-2 focus:ring-[#899770] ${
                  difficulty === opt.id
                    ? "bg-[#F4F6F2] border-[#899770] text-[#000000]"
                    : "bg-[#FAFAFA] border-[#E5E1D8] hover:border-[#899770]/60 hover:bg-[#FDFBF7] text-[#262626]"
                }`}
              >
                <div className={`font-semibold ${difficulty === opt.id ? "text-[#5A6844]" : ""}`}>
                  {opt.label}
                </div>
                <div className="text-[11px] text-[#7A756D] mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        </section>
      </div>

      {/* 7. Coffee / Rest Break Preference */}
      <section className="bg-white border border-[#E5E1D8] p-5 shadow-xs">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="font-serif text-base sm:text-lg font-bold text-[#000000] flex items-center gap-2">
              <span>☕ 7. Пауза на отдых и кофе в маршруте</span>
            </div>
            <p className="text-xs text-[#7A756D] leading-relaxed max-w-lg">
              Запланировать комфортную паузу на середине пути в Итальянском дворике (зал 15).
              Буфет цокольного этажа временно на техобслуживании; в залах 14 и 15 есть удобные диваны.
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={includeBreak}
              onChange={(e) => setIncludeBreak(e.target.checked)}
              className="sr-only peer"
              aria-label="Включить паузу для отдыха в маршрут"
            />
            <div className="w-11 h-6 bg-[#E5E1D8] peer-focus:outline-hidden peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#D5CDC2] after:border after:h-5 after:w-5 after:transition-all peer-checked:bg-[#899770]" />
          </label>
        </div>
      </section>

      {/* Submit Button */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={isPending}
          aria-busy={isPending}
          className="w-full bg-[#899770] hover:bg-[#75835C] disabled:bg-[#C4BCB1] text-white py-4 px-6 min-h-[52px] font-medium text-base sm:text-lg transition-all shadow-sm hover:shadow-md cursor-pointer flex items-center justify-center gap-2 focus:outline-hidden focus:ring-2 focus:ring-[#899770]"
        >
          {isPending ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Yandex AI Studio формирует маршрут...</span>
            </>
          ) : (
            <>
              <span>Создать мой персональный маршрут</span>
              <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </>
          )}
        </button>
        <p className="text-center text-xs text-[#8C867E] mt-3">
          Маршрут опирается исключительно на проверенные шедевры постоянной экспозиции музея
        </p>
      </div>
    </form>
  );
}
