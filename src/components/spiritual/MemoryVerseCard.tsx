import React, { useState } from 'react';
import { Eye, EyeOff, Plus, Sparkles } from 'lucide-react';
import { maskMemoryVerseText, type MemoryVerseData } from '../../utils/spiritualLogic';
import type { SpiritualTranslationStrings } from '../../data/translations';
import type { LanguageCode } from '../../types/fellowship';

interface MemoryVerseCardProps {
  memoryVerse: MemoryVerseData;
  language: LanguageCode;
  labels: SpiritualTranslationStrings;
  isLeadership: boolean;
  onPostScripture: () => void;
}

export const MemoryVerseCard: React.FC<MemoryVerseCardProps> = ({
  memoryVerse,
  language,
  labels,
  isLeadership,
  onPostScripture,
}) => {
  const [revealMemoryVerse, setRevealMemoryVerse] = useState(true);

  const displayedText = revealMemoryVerse
    ? memoryVerse.verseText
    : maskMemoryVerseText(memoryVerse.verseText);

  return (
    <section
      aria-label="Scripture for the Day and Memory Verse Challenge"
      className="rounded-[18px] bg-[#0F172A] text-white border border-[#1E293B] p-4 sm:p-5 shadow-md space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5 text-[#F59E0B]">
          <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="text-[11px] font-extrabold tracking-wider uppercase">
            {labels.scriptureOfTheDayBadge} • MEMORY VERSE
          </span>
        </div>
        <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-white/10 border border-[#F59E0B]/40 text-[#FCD34D] text-[11px] font-bold">
          Gideonites • {language}
        </span>
      </div>

      <h2 className="font-display text-base sm:text-lg font-extrabold text-[#F59E0B]">
        {memoryVerse.reference}
      </h2>

      <blockquote className="text-sm sm:text-base italic leading-relaxed text-[#F8FAFC]">
        “{displayedText}”
      </blockquote>

      {memoryVerse.speakerOrAuthor && (
        <p className="text-xs text-[#94A3B8]">
          Posted by <span className="text-[#E2E8F0] font-semibold">{memoryVerse.speakerOrAuthor}</span>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2.5 pt-1">
        <button
          type="button"
          onClick={() => setRevealMemoryVerse((prev) => !prev)}
          className="min-h-[44px] px-4 rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-[#0F172A] text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors"
        >
          {revealMemoryVerse ? (
            <>
              <EyeOff className="w-4 h-4" aria-hidden="true" />
              <span>{labels.practiceMemory}</span>
            </>
          ) : (
            <>
              <Eye className="w-4 h-4" aria-hidden="true" />
              <span>{labels.revealScripture}</span>
            </>
          )}
        </button>

        {isLeadership && (
          <button
            type="button"
            onClick={onPostScripture}
            className="min-h-[44px] px-4 rounded-xl border border-[#F59E0B]/60 bg-white/5 hover:bg-white/10 text-[#FCD34D] text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>{labels.postScriptureAction}</span>
          </button>
        )}
      </div>
    </section>
  );
};
