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

export function RoutePreferencesForm({
  initialValues,
  onSubmit,
  isLoading = false,
}: RoutePreferencesFormProps) {
  // All fields start clean and unselected unless explicit initial values are supplied
  const [selectedInterests, setSelectedInterests] = useState<string[]>(
    initialValues?.interests && initialValues.interests.length > 0
      ? initialValues.interests.slice(0, MAX_INTERESTS)
      : []
  );
  const [duration, setDuration] = useState<number | null>(
    initialValues?.duration_minutes ?? null
  );
  const [groupType, setGroupType] = useState<GroupType | null>(
    initialValues?.group_type ?? null
  );
  const [difficulty, setDifficulty] = useState<DifficultyLevel | null>(
    initialValues?.difficulty ?? null
  );
  const [style, setStyle] = useState<TourStyle | null>(
    initialValues?.style ?? null
  );
  const [includeBreak, setIncludeBreak] = useState<boolean | null>(
    initialValues?.include_break !== undefined ? initialValues.include_break : null
  );
  const [visitorComment, setVisitorComment] = useState<string>(
    initialValues?.visitor_comment ?? ""
  );

  const [interestsNotice, setInterestsNotice] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isPending = isLoading || isSubmitting;
  const [prevInitialValues, setPrevInitialValues] = useState(initialValues);

  if (initialValues !== prevInitialValues) {
    setPrevInitialValues(initialValues);
    setIsSubmitting(false);
    setValidationError(null);
    setInterestsNotice(null);
    if (initialValues) {
      if (initialValues.interests) setSelectedInterests(initialValues.interests.slice(0, MAX_INTERESTS));
      if (initialValues.duration_minutes) setDuration(initialValues.duration_minutes);
      if (initialValues.group_type) setGroupType(initialValues.group_type);
      if (initialValues.difficulty) setDifficulty(initialValues.difficulty);
      if (initialValues.style) setStyle(initialValues.style);
      if (initialValues.include_break !== undefined) setIncludeBreak(initialValues.include_break);
      if (initialValues.visitor_comment) setVisitorComment(initialValues.visitor_comment);
    } else {
      setSelectedInterests([]);
      setDuration(null);
      setGroupType(null);
      setDifficulty(null);
      setStyle(null);
      setIncludeBreak(null);
      setVisitorComment("");
    }
  }

  const toggleInterest = (id: string) => {
    setValidationError(null);
    if (selectedInterests.includes(id)) {
      setSelectedInterests(selectedInterests.filter((item) => item !== id));
      setInterestsNotice(null);
    } else {
      if (selectedInterests.length < MAX_INTERESTS) {
        setSelectedInterests([...selectedInterests, id]);
        setInterestsNotice(null);
      } else {
        setInterestsNotice(
          `Выбрано максимум ${MAX_INTERESTS} темы для гармоничного маршрута. Снимите одну, чтобы выбрать другую.`
        );
      }
    }
  };

  const handleSelectDuration = (val: number) => {
    setDuration((prev) => (prev === val ? null : val));
    setValidationError(null);
  };

  const handleSelectGroup = (val: GroupType) => {
    setGroupType((prev) => (prev === val ? null : val));
    setValidationError(null);
  };

  const handleSelectStyle = (val: TourStyle) => {
    setStyle((prev) => (prev === val ? null : val));
    setValidationError(null);
  };

  const handleSelectDifficulty = (val: DifficultyLevel) => {
    setDifficulty((prev) => (prev === val ? null : val));
    setValidationError(null);
  };

  const handleSelectBreak = (val: boolean) => {
    setIncludeBreak((prev) => (prev === val ? null : val));
    setValidationError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isPending) return;

    if (selectedInterests.length === 0) {
      setValidationError("1. Пожалуйста, выберите хотя бы одну тему интереса (от 1 до 4).");
      return;
    }
    if (duration === null) {
      setValidationError("3. Пожалуйста, укажите продолжительность визита.");
      return;
    }
    if (groupType === null) {
      setValidationError("4. Пожалуйста, выберите состав группы.");
      return;
    }
    if (style === null) {
      setValidationError("5. Пожалуйста, выберите формат подачи экскурсии.");
      return;
    }
    if (difficulty === null) {
      setValidationError("6. Пожалуйста, укажите ваш опыт в искусстве.");
      return;
    }
    if (includeBreak === null) {
      setValidationError("7. Пожалуйста, укажите, нужен ли перерыв на отдых.");
      return;
    }

    setValidationError(null);
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
          Персональный AI-гид для визита в музей: глубокое погружение в историю шедевров по проверенному каталогу музея, скрытые смыслы полотен и атмосфера залов.
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
          <span className="text-xs">
            {selectedInterests.length > 0 ? (
              <span className="text-[#5A6844] font-semibold">
                ✓ Выбрано {selectedInterests.length} из {MAX_INTERESTS}
              </span>
            ) : (
              <span className="text-[#A8A29A]">Выберите от 1 до {MAX_INTERESTS} тем</span>
            )}
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
        <div className="flex items-center justify-between mb-1">
          <h2 id="duration-heading" className="font-serif text-xl font-bold text-[#000000]">
            3. Сколько у вас времени?
          </h2>
          <span className="text-xs">
            {duration !== null ? (
              <span className="text-[#5A6844] font-semibold">
                ✓ Выбрано: {DURATION_OPTIONS.find((d) => d.minutes === duration)?.label}
              </span>
            ) : (
              <span className="text-[#A8A29A]">Не выбрано</span>
            )}
          </span>
        </div>
        <p className="text-xs text-[#7A756D] mb-3">
          Выберите продолжительность визита для расчета оптимального количества шедевров и темпа:
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {DURATION_OPTIONS.map((opt) => (
            <button
              key={opt.minutes}
              type="button"
              role="radio"
              aria-checked={duration === opt.minutes}
              onClick={() => handleSelectDuration(opt.minutes)}
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
        <div className="flex items-center justify-between mb-3">
          <h2 id="group-heading" className="font-serif text-xl font-bold text-[#000000]">
            4. Кто сегодня в музее?
          </h2>
          <span className="text-xs">
            {groupType !== null ? (
              <span className="text-[#5A6844] font-semibold">
                ✓ Выбрано: {GROUP_OPTIONS.find((g) => g.id === groupType)?.label}
              </span>
            ) : (
              <span className="text-[#A8A29A]">Не выбрано</span>
            )}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {GROUP_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={groupType === opt.id}
              onClick={() => handleSelectGroup(opt.id)}
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
          <div className="flex items-center justify-between mb-3">
            <h2 id="style-heading" className="font-serif text-lg font-bold text-[#000000]">
              5. Формат подачи
            </h2>
            <span className="text-xs">
              {style !== null ? (
                <span className="text-[#5A6844] font-semibold">✓</span>
              ) : (
                <span className="text-[#A8A29A]">Не выбрано</span>
              )}
            </span>
          </div>
          <div className="space-y-2">
            {STYLE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={style === opt.id}
                onClick={() => handleSelectStyle(opt.id)}
                className={`w-full text-left p-3 border text-xs transition-all cursor-pointer min-h-[48px] focus:outline-hidden focus:ring-2 focus:ring-[#899770] ${
                  style === opt.id
                    ? "bg-[#F4F6F2] border-[#899770] text-[#000000] ring-1 ring-[#899770]"
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
          <div className="flex items-center justify-between mb-3">
            <h2 id="diff-heading" className="font-serif text-lg font-bold text-[#000000]">
              6. Опыт в искусстве
            </h2>
            <span className="text-xs">
              {difficulty !== null ? (
                <span className="text-[#5A6844] font-semibold">✓</span>
              ) : (
                <span className="text-[#A8A29A]">Не выбрано</span>
              )}
            </span>
          </div>
          <div className="space-y-2">
            {DIFFICULTY_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={difficulty === opt.id}
                onClick={() => handleSelectDifficulty(opt.id)}
                className={`w-full text-left p-3 border text-xs transition-all cursor-pointer min-h-[48px] focus:outline-hidden focus:ring-2 focus:ring-[#899770] ${
                  difficulty === opt.id
                    ? "bg-[#F4F6F2] border-[#899770] text-[#000000] ring-1 ring-[#899770]"
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
      <section
        className="bg-white border border-[#E5E1D8] p-5 sm:p-6 shadow-xs"
        role="radiogroup"
        aria-labelledby="break-heading"
      >
        <div className="flex items-center justify-between mb-2">
          <h2 id="break-heading" className="font-serif text-xl font-bold text-[#000000]">
            7. Пауза на отдых и кофе в маршруте
          </h2>
          <span className="text-xs">
            {includeBreak !== null ? (
              <span className="text-[#5A6844] font-semibold">✓ Выбран вариант</span>
            ) : (
              <span className="text-[#A8A29A]">Не выбрано</span>
            )}
          </span>
        </div>
        <p className="text-xs text-[#7A756D] leading-relaxed mb-3">
          Буфет цокольного этажа временно закрыт на техобслуживание. В Итальянском дворике (зал 15) и Греческом дворике (зал 14) обустроены удобные диваны для отдыха.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            role="radio"
            aria-checked={includeBreak === true}
            onClick={() => handleSelectBreak(true)}
            className={`p-3.5 border text-left transition-all cursor-pointer min-h-[56px] focus:outline-hidden focus:ring-2 focus:ring-[#899770] ${
              includeBreak === true
                ? "bg-[#F4F6F2] border-[#899770] text-[#000000] ring-1 ring-[#899770]"
                : "bg-[#FAFAFA] border-[#E5E1D8] hover:border-[#899770]/60 hover:bg-[#FDFBF7] text-[#262626]"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-[#000000]">
                ☕ С паузой на отдых
              </span>
              <span
                className={`w-4 h-4 border flex items-center justify-center text-[10px] shrink-0 ${
                  includeBreak === true ? "border-[#899770] bg-[#899770] text-white" : "border-[#C4BCB1]"
                }`}
                aria-hidden="true"
              >
                {includeBreak === true ? "✓" : ""}
              </span>
            </div>
            <div className="text-[11px] text-[#7A756D] mt-1">
              Перерыв в середине пути в Итальянском дворике (зал 15)
            </div>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={includeBreak === false}
            onClick={() => handleSelectBreak(false)}
            className={`p-3.5 border text-left transition-all cursor-pointer min-h-[56px] focus:outline-hidden focus:ring-2 focus:ring-[#899770] ${
              includeBreak === false
                ? "bg-[#F4F6F2] border-[#899770] text-[#000000] ring-1 ring-[#899770]"
                : "bg-[#FAFAFA] border-[#E5E1D8] hover:border-[#899770]/60 hover:bg-[#FDFBF7] text-[#262626]"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-[#000000]">
                ⚡ Без перерыва
              </span>
              <span
                className={`w-4 h-4 border flex items-center justify-center text-[10px] shrink-0 ${
                  includeBreak === false ? "border-[#899770] bg-[#899770] text-white" : "border-[#C4BCB1]"
                }`}
                aria-hidden="true"
              >
                {includeBreak === false ? "✓" : ""}
              </span>
            </div>
            <div className="text-[11px] text-[#7A756D] mt-1">
              Непрерывный просмотр шедевров без запланированной паузы
            </div>
          </button>
        </div>
      </section>

      {/* Validation Error Banner */}
      {validationError && (
        <div
          role="alert"
          className="p-4 bg-[#FFF9F2] border-l-4 border-[#899770] text-[#262626] text-sm flex items-start gap-3 shadow-xs animate-in fade-in"
        >
          <span className="text-lg shrink-0" aria-hidden="true">⚠️</span>
          <div className="flex-1">
            <div className="font-bold text-[#000000]">Заполните все пункты анкеты</div>
            <div className="text-xs text-[#5C5954] mt-0.5 leading-relaxed">{validationError}</div>
          </div>
        </div>
      )}

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
