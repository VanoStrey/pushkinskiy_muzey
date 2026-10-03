import { useState } from "react";
import type { ReactNode } from "react";
import {
  IconArrowRight,
  IconBreak,
  IconCaution,
  IconCouple,
  IconDirect,
  IconFamily,
  IconFriends,
  IconSolo,
  NeoButton,
  NeoPanel,
  NeoTile,
} from "@/shared/ui";
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

// The audience selector is the museum's own colonnade taken apart: one column
// for a lone visitor, two under a shared lintel for a couple, and so on.
const GROUP_OPTIONS: { id: GroupType; label: string; icon: ReactNode }[] = [
  { id: "solo", label: "Один / одна", icon: <IconSolo /> },
  { id: "friends", label: "С друзьями", icon: <IconFriends /> },
  { id: "family", label: "С семьей", icon: <IconFamily /> },
  { id: "couple", label: "Пара", icon: <IconCouple /> },
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

  const interestsDone = selectedInterests.length > 0;

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-5 sm:space-y-7">
      {/* Editorial intro */}
      <div className="pt-1 pb-1 text-center sm:pb-3">
        <span className="wall-label inline-block rounded-[var(--radius-pill)] bg-ground px-4 py-1.5 shadow-[var(--shadow-pressed-sm)]">
          Государственный музей им. А.С. Пушкина
        </span>
        <h1 className="mt-4 font-serif text-[2rem] font-bold leading-[1.05] text-ink sm:text-[2.75rem] lg:text-[3.25rem]">
          Маршрут, который
          <br />
          <span className="text-accent">понимает ваши интересы</span>
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-muted sm:text-base">
          Персональный AI-гид для визита в музей: погружение в историю шедевров по
          проверенному каталогу, скрытые смыслы полотен и атмосфера залов.
        </p>
      </div>

      {/* 1. Interests */}
      <NeoPanel as="section" role="group" ariaLabelledby="interests-heading">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-1">
          <h2 id="interests-heading" className="font-serif text-xl font-bold text-ink">
            <span className="text-faint">01</span> Что вам интересно?
          </h2>
          <span className="wall-label">
            {selectedInterests.length} / {MAX_INTERESTS}
          </span>
        </div>

        {interestsNotice && (
          <div
            role="alert"
            className="mb-3 rounded-[var(--radius-control)] bg-gilt-soft px-3.5 py-2.5 text-xs leading-relaxed text-ink"
          >
            {interestsNotice}
          </div>
        )}

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {AVAILABLE_INTERESTS.map((item) => (
            <NeoTile
              key={item.id}
              role="checkbox"
              selected={selectedInterests.includes(item.id)}
              onClick={() => toggleInterest(item.id)}
              label={item.label}
              hint={item.hint}
            />
          ))}
        </div>
      </NeoPanel>

      {/* 2. Free-text comment */}
      <NeoPanel as="section">
        <div className="mb-2 flex items-center justify-between gap-2">
          <label
            htmlFor="visitor-comment-input"
            className="font-serif text-xl font-bold text-ink"
          >
            <span className="text-faint">02</span> Своими словами
          </label>
          <span className="wall-label">по желанию</span>
        </div>
        <p className="text-xs leading-relaxed text-muted">
          Напишите, что особенно интересно — эпохи, сюжеты, персонажи или детали. AI-гид
          подберёт произведения с фокусом на ваш запрос.
        </p>
        <textarea
          id="visitor-comment-input"
          value={visitorComment}
          onChange={(e) => setVisitorComment(e.target.value)}
          placeholder="Например: хочу увидеть древнеегипетские саркофаги и загадочные портреты, меня привлекают необычные детали и золотые украшения..."
          maxLength={500}
          rows={3}
          className="mt-3 w-full resize-none rounded-[var(--radius-control)] bg-sunken p-3.5 text-sm text-ink shadow-[var(--shadow-pressed-sm)] transition-all placeholder:text-faint focus:outline-none focus-visible:outline-2"
        />
        <div className="mt-1 flex justify-end">
          <span className="wall-label">{visitorComment.length} / 500</span>
        </div>
      </NeoPanel>

      {/* 3. Duration */}
      <NeoPanel as="section" role="radiogroup" ariaLabelledby="duration-heading">
        <h2 id="duration-heading" className="font-serif text-xl font-bold text-ink">
          <span className="text-faint">03</span> Сколько у вас времени?
        </h2>
        <p className="mb-4 mt-1 text-xs text-muted">
          От этого зависит, сколько остановок уложится в маршрут.
        </p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {DURATION_OPTIONS.map((opt) => (
            <NeoTile
              key={opt.minutes}
              role="radio"
              selected={duration === opt.minutes}
              onClick={() => handleSelectDuration(opt.minutes)}
              label={opt.label}
              hint={opt.stopsHint}
            />
          ))}
        </div>
      </NeoPanel>

      {/* 4. Group */}
      <NeoPanel as="section" role="radiogroup" ariaLabelledby="group-heading">
        <h2 id="group-heading" className="mb-4 font-serif text-xl font-bold text-ink">
          <span className="text-faint">04</span> Кто сегодня в музее?
        </h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {GROUP_OPTIONS.map((opt) => (
            <NeoTile
              key={opt.id}
              role="radio"
              selected={groupType === opt.id}
              onClick={() => handleSelectGroup(opt.id)}
              label={opt.label}
              icon={opt.icon}
            />
          ))}
        </div>
      </NeoPanel>

      {/* 5 + 6. Style and difficulty */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-4">
        <NeoPanel as="section" role="radiogroup" ariaLabelledby="style-heading">
          <h2 id="style-heading" className="mb-4 font-serif text-lg font-bold text-ink">
            <span className="text-faint">05</span> Формат подачи
          </h2>
          <div className="space-y-2.5">
            {STYLE_OPTIONS.map((opt) => (
              <NeoTile
                key={opt.id}
                role="radio"
                selected={style === opt.id}
                onClick={() => handleSelectStyle(opt.id)}
                label={opt.label}
                hint={opt.desc}
              />
            ))}
          </div>
        </NeoPanel>

        <NeoPanel as="section" role="radiogroup" ariaLabelledby="diff-heading">
          <h2 id="diff-heading" className="mb-4 font-serif text-lg font-bold text-ink">
            <span className="text-faint">06</span> Опыт в искусстве
          </h2>
          <div className="space-y-2.5">
            {DIFFICULTY_OPTIONS.map((opt) => (
              <NeoTile
                key={opt.id}
                role="radio"
                selected={difficulty === opt.id}
                onClick={() => handleSelectDifficulty(opt.id)}
                label={opt.label}
                hint={opt.desc}
              />
            ))}
          </div>
        </NeoPanel>
      </div>

      {/* 7. Break */}
      <NeoPanel as="section" role="radiogroup" ariaLabelledby="break-heading">
        <h2 id="break-heading" className="font-serif text-xl font-bold text-ink">
          <span className="text-faint">07</span> Пауза на отдых
        </h2>
        <p className="mb-4 mt-1 text-xs leading-relaxed text-muted">
          Буфет цокольного этажа закрыт на техобслуживание. В Итальянском (зал 15) и
          Греческом (зал 14) дворах есть удобные диваны.
        </p>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <NeoTile
            role="radio"
            selected={includeBreak === true}
            onClick={() => handleSelectBreak(true)}
            label="С паузой на отдых"
            icon={<IconBreak />}
            hint="Перерыв в середине пути, в Итальянском дворике"
          />
          <NeoTile
            role="radio"
            selected={includeBreak === false}
            onClick={() => handleSelectBreak(false)}
            label="Без перерыва"
            icon={<IconDirect />}
            hint="Непрерывный просмотр шедевров"
          />
        </div>
      </NeoPanel>

      {/* Validation */}
      {validationError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-[var(--radius-control)] bg-gilt-soft p-4 shadow-[var(--shadow-raised-sm)]"
        >
          <IconCaution className="mt-0.5 shrink-0 text-gilt" />
          <div className="flex-1">
            <div className="text-sm font-bold text-ink">Заполните все пункты анкеты</div>
            <div className="mt-0.5 text-xs leading-relaxed text-muted">{validationError}</div>
          </div>
        </div>
      )}

      {/* Submit */}
      <div className="pt-1">
        <NeoButton type="submit" full busy={isPending} disabled={isPending} className="text-base sm:text-lg">
          {isPending ? (
            <span>Yandex AI Studio формирует маршрут…</span>
          ) : (
            <>
              <span>Создать мой персональный маршрут</span>
              <IconArrowRight />
            </>
          )}
        </NeoButton>
        <p className="mt-3 text-center text-xs text-faint">
          {interestsDone
            ? "Маршрут опирается только на проверенные экспонаты каталога музея"
            : "Начните с тем, которые вам интересны — остальное AI-гид подберёт сам"}
        </p>
      </div>
    </form>
  );
}
