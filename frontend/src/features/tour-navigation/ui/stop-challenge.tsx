import { useState } from "react";
import type { ReactNode } from "react";
import type { Challenge } from "@/entities/route";
import { IconCelebrate, IconCheck, IconClose, IconHint, NeoButton, NeoPanel } from "@/shared/ui";

interface StopChallengeProps {
  challenge: Challenge;
  initialSelectedOption?: number | null;
  onAnswer?: (optionIndex: number | null, isCorrect: boolean | null) => void;
}

const CYRILLIC_LABELS = ["А", "Б", "В", "Г", "Д", "Е"];

export function StopChallenge({
  challenge,
  initialSelectedOption,
  onAnswer,
}: StopChallengeProps) {
  const [selectedOption, setSelectedOption] = useState<number | null | undefined>(
    initialSelectedOption
  );
  const [prevInitial, setPrevInitial] = useState(initialSelectedOption);

  // Official React pattern: adjust state during render when a prop changes
  if (initialSelectedOption !== prevInitial) {
    setPrevInitial(initialSelectedOption);
    setSelectedOption(initialSelectedOption);
  }

  const isAnswered = selectedOption !== undefined;

  if (challenge.type === "observation") {
    return (
      <NeoPanel role="region" className="space-y-3">
        <p className="wall-label text-accent-ink">Задание-наблюдение · без оценки</p>
        <h3 className="font-serif text-lg font-bold leading-snug text-ink sm:text-xl">
          {challenge.question}
        </h3>
        {isAnswered ? (
          <p role="status" className="text-sm text-accent-ink">
            Задание отмечено выполненным. Правильного ответа здесь нет.
          </p>
        ) : (
          <NeoButton
            onClick={() => {
              setSelectedOption(null);
              onAnswer?.(null, null);
            }}
          >
            Отметить задание выполненным
          </NeoButton>
        )}
      </NeoPanel>
    );
  }

  const handleSelect = (idx: number) => {
    if (isAnswered) return;
    setSelectedOption(idx);
    const isCorrect = idx === challenge?.correct_option;
    onAnswer?.(idx, isCorrect);
  };

  if (!challenge || !challenge.question) {
    return null;
  }

  const options = Array.isArray(challenge.options) ? challenge.options : [];

  return (
    <NeoPanel role="region" className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2 bg-accent" aria-hidden="true" />
        <span className="wall-label text-accent-ink">Интерактивное задание экспоната</span>
      </div>

      <h3 className="font-serif text-lg font-bold leading-snug text-ink sm:text-xl">
        {challenge.question}
      </h3>

      <div className="space-y-2.5" role="radiogroup" aria-label="Варианты ответа на загадку">
        {options.map((optionText, idx) => {
          const isThisOptionSelected = selectedOption === idx;
          const isCorrect = idx === challenge.correct_option;
          const letterLabel = CYRILLIC_LABELS[idx] || String.fromCharCode(65 + idx);

          // Unanswered options stand proud; once answered they settle into the
          // surface, and the right one keeps a visible accent ring.
          let look = "bg-ground shadow-[var(--shadow-raised)] text-ink cursor-pointer";
          let marker = "bg-ground text-muted shadow-[var(--shadow-raised-sm)]";
          let glyph: ReactNode = letterLabel;

          if (isAnswered) {
            if (isCorrect) {
              look =
                "bg-correct/12 shadow-[var(--shadow-pressed)] ring-1 ring-correct/50 text-ink font-medium";
              marker = "bg-correct text-white";
              glyph = <IconCheck size={14} />;
            } else if (isThisOptionSelected) {
              look =
                "bg-wrong/12 shadow-[var(--shadow-pressed)] ring-1 ring-wrong/50 text-ink";
              marker = "bg-wrong text-white";
              glyph = <IconClose size={14} />;
            } else {
              look = "bg-ground shadow-[var(--shadow-pressed-sm)] text-faint opacity-70";
              marker = "bg-ground text-faint shadow-[var(--shadow-pressed-sm)]";
            }
          }

          return (
            <button
              key={`${idx}-${optionText.slice(0, 10)}`}
              type="button"
              role="radio"
              aria-checked={isThisOptionSelected}
              aria-disabled={isAnswered}
              disabled={isAnswered}
              onClick={() => handleSelect(idx)}
              className={`flex min-h-[48px] w-full items-start gap-3 rounded-[var(--radius-control)] p-3.5 text-left text-sm transition-all duration-200 disabled:cursor-default sm:p-4 ${look}`}
            >
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${marker}`}
                aria-hidden="true"
              >
                {glyph}
              </span>
              <span className="flex-1 leading-relaxed">{optionText}</span>
            </button>
          );
        })}
      </div>

      {/* Feedback & explanation */}
      {isAnswered && (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-[var(--radius-control)] p-4 text-xs leading-relaxed shadow-[var(--shadow-pressed-sm)] sm:text-sm ${
            selectedOption === challenge.correct_option
              ? "bg-correct/10 text-ink"
              : "bg-gilt-soft text-ink"
          }`}
        >
          <div className="mb-1 flex items-center gap-1.5 text-sm font-bold">
            {selectedOption === challenge.correct_option ? (
              <>
                <IconCelebrate size={17} className="shrink-0" />
                <span>Точно подмечено! Правильный ответ.</span>
              </>
            ) : (
              <>
                <IconHint size={17} className="shrink-0" />
                <span>Не совсем так, но это отличный повод приглядеться:</span>
              </>
            )}
          </div>
          {challenge.explanation && <p className="mt-1 text-muted">{challenge.explanation}</p>}
        </div>
      )}
    </NeoPanel>
  );
}
