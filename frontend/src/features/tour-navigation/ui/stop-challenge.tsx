import { useState } from "react";
import type { Challenge } from "@/entities/route";

interface StopChallengeProps {
  challenge: Challenge;
  initialSelectedOption?: number;
  onAnswer?: (optionIndex: number, isCorrect: boolean) => void;
}

export function StopChallenge({
  challenge,
  initialSelectedOption,
  onAnswer,
}: StopChallengeProps) {
  const [selectedOption, setSelectedOption] = useState<number | undefined>(
    initialSelectedOption
  );

  const isAnswered = selectedOption !== undefined;

  const handleSelect = (idx: number) => {
    if (isAnswered) return;
    setSelectedOption(idx);
    const isCorrect = idx === challenge.correct_option;
    onAnswer?.(idx, isCorrect);
  };

  return (
    <div className="bg-[#FAF7F2] border border-[#E3DDD4] rounded-xl p-5 sm:p-6 shadow-xs">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full bg-[#9E2A2B]" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9E2A2B]">
          Интерактивная загадка экспоната
        </span>
      </div>

      <h3 className="font-serif text-lg sm:text-xl font-bold text-[#1A1918] mb-4 leading-snug">
        {challenge.question}
      </h3>

      <div className="space-y-2.5">
        {challenge.options.map((optionText, idx) => {
          const isThisOptionSelected = selectedOption === idx;
          const isCorrect = idx === challenge.correct_option;

          let optionStyle = "bg-white border-[#E8E3DC] hover:border-[#9E2A2B] text-[#33312E]";

          if (isAnswered) {
            if (isCorrect) {
              optionStyle = "bg-[#EEF7ED] border-[#2E7D32] text-[#1B5E20] font-medium ring-1 ring-[#2E7D32]";
            } else if (isThisOptionSelected) {
              optionStyle = "bg-[#FDF2F2] border-[#D32F2F] text-[#B71C1C] ring-1 ring-[#D32F2F]";
            } else {
              optionStyle = "bg-white/60 border-[#E8E3DC] text-[#7A756D] opacity-60";
            }
          }

          return (
            <button
              key={idx}
              type="button"
              disabled={isAnswered}
              onClick={() => handleSelect(idx)}
              className={`w-full text-left p-3.5 rounded-lg border text-sm transition-all flex items-start gap-3 cursor-pointer disabled:cursor-default ${optionStyle}`}
            >
              <span
                className={`w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold mt-0.5 border ${
                  isAnswered && isCorrect
                    ? "bg-[#2E7D32] text-white border-[#2E7D32]"
                    : isAnswered && isThisOptionSelected
                    ? "bg-[#D32F2F] text-white border-[#D32F2F]"
                    : "border-[#C4BCB1] text-[#5C5954]"
                }`}
              >
                {isAnswered && isCorrect ? "✓" : isAnswered && isThisOptionSelected ? "✕" : String.fromCharCode(65 + idx)}
              </span>
              <span className="flex-1 leading-relaxed">{optionText}</span>
            </button>
          );
        })}
      </div>

      {/* Feedback & Explanation */}
      {isAnswered && (
        <div
          className={`mt-4 p-4 rounded-lg border text-xs sm:text-sm leading-relaxed transition-all ${
            selectedOption === challenge.correct_option
              ? "bg-[#F4F9F3] border-[#C8E6C9] text-[#1B5E20]"
              : "bg-[#FFF9F2] border-[#FFE0B2] text-[#8D4B00]"
          }`}
        >
          <div className="font-bold flex items-center gap-1.5 mb-1 text-sm">
            {selectedOption === challenge.correct_option ? (
              <>
                <span>Точно подмечено!</span>
              </>
            ) : (
              <>
                <span>Не совсем так, но это отличный повод приглядеться:</span>
              </>
            )}
          </div>
          <p>{challenge.explanation}</p>
        </div>
      )}
    </div>
  );
}
