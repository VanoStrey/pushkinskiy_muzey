import { useState } from "react";
import type { Challenge } from "@/entities/route";

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
      <div className="bg-[#FAF7F2] border border-[#E3DDD4] rounded-xl p-5 sm:p-6 shadow-xs" role="region" aria-label="Задание-наблюдение">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9E2A2B] mb-2">Задание-наблюдение · без оценки</p>
        <h3 className="font-serif text-lg sm:text-xl font-bold text-[#1A1918] mb-4 leading-snug">{challenge.question}</h3>
        {isAnswered ? (
          <p role="status" className="text-sm text-[#2E6B35]">Задание отмечено выполненным. Правильного ответа здесь нет.</p>
        ) : (
          <button
            type="button"
            onClick={() => {
              setSelectedOption(null);
              onAnswer?.(null, null);
            }}
            className="px-4 py-3 min-h-[48px] rounded-xl bg-[#9E2A2B] text-white text-sm font-medium hover:bg-[#7E1E20] focus:outline-hidden focus:ring-2 focus:ring-[#9E2A2B]"
          >
            Отметить задание выполненным
          </button>
        )}
      </div>
    );
  }

  const handleSelect = (idx: number) => {
    if (isAnswered) return;
    setSelectedOption(idx);
    const isCorrect = idx === challenge.correct_option;
    onAnswer?.(idx, isCorrect);
  };

  return (
    <div
      className="bg-[#FAF7F2] border border-[#E3DDD4] rounded-xl p-5 sm:p-6 shadow-xs"
      role="region"
      aria-label="Интерактивное задание экспоната"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full bg-[#9E2A2B]" aria-hidden="true" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9E2A2B]">
          Интерактивное задание экспоната
        </span>
      </div>

      <h3 className="font-serif text-lg sm:text-xl font-bold text-[#1A1918] mb-4 leading-snug">
        {challenge.question}
      </h3>

      <div
        className="space-y-2.5"
        role="radiogroup"
        aria-label="Варианты ответа на загадку"
      >
        {challenge.options.map((optionText, idx) => {
          const isThisOptionSelected = selectedOption === idx;
          const isCorrect = idx === challenge.correct_option;
          const letterLabel = CYRILLIC_LABELS[idx] || String.fromCharCode(65 + idx);

          let optionStyle =
            "bg-white border-[#E8E3DC] hover:border-[#9E2A2B] text-[#33312E] hover:bg-[#FDFBF7]";

          if (isAnswered) {
            if (isCorrect) {
              optionStyle =
                "bg-[#EEF7ED] border-[#2E7D32] text-[#1B5E20] font-medium ring-1 ring-[#2E7D32]";
            } else if (isThisOptionSelected) {
              optionStyle =
                "bg-[#FDF2F2] border-[#D32F2F] text-[#B71C1C] ring-1 ring-[#D32F2F]";
            } else {
              optionStyle = "bg-white/70 border-[#E8E3DC] text-[#7A756D] opacity-60";
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
              className={`w-full text-left p-3.5 sm:p-4 rounded-xl border text-sm transition-all flex items-start gap-3 cursor-pointer disabled:cursor-default focus:outline-hidden focus:ring-2 focus:ring-[#9E2A2B] min-h-[48px] ${optionStyle}`}
            >
              <span
                className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold mt-0.5 border ${
                  isAnswered && isCorrect
                    ? "bg-[#2E7D32] text-white border-[#2E7D32]"
                    : isAnswered && isThisOptionSelected
                    ? "bg-[#D32F2F] text-white border-[#D32F2F]"
                    : "border-[#C4BCB1] text-[#5C5954] bg-[#F7F4EE]"
                }`}
                aria-hidden="true"
              >
                {isAnswered && isCorrect ? "✓" : isAnswered && isThisOptionSelected ? "✕" : letterLabel}
              </span>
              <span className="flex-1 leading-relaxed">{optionText}</span>
            </button>
          );
        })}
      </div>

      {/* Feedback & Explanation */}
      {isAnswered && (
        <div
          role="status"
          aria-live="polite"
          className={`mt-4 p-4 rounded-xl border text-xs sm:text-sm leading-relaxed transition-all animate-in fade-in duration-200 ${
            selectedOption === challenge.correct_option
              ? "bg-[#F4F9F3] border-[#C8E6C9] text-[#1B5E20]"
              : "bg-[#FFF9F2] border-[#FFE0B2] text-[#8D4B00]"
          }`}
        >
          <div className="font-bold flex items-center gap-1.5 mb-1 text-sm">
            {selectedOption === challenge.correct_option ? (
              <span className="flex items-center gap-1.5">
                <span className="text-base">✨</span>
                <span>Точно подмечено! Правильный ответ.</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <span className="text-base">💡</span>
                <span>Не совсем так, но это отличный повод приглядеться:</span>
              </span>
            )}
          </div>
          {challenge.explanation && <p className="mt-1 text-[#383531]">{challenge.explanation}</p>}
        </div>
      )}
    </div>
  );
}
