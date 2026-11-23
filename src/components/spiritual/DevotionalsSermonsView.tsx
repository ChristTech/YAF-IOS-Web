import React, { useMemo, useState } from 'react';
import {
  AudioLines,
  BookOpen,
  Bookmark,
  Check,
  Eye,
  EyeOff,
  FileText,
  Pause,
  Pencil,
  Plus,
  Share2,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import { DEFAULT_DAILY_SCRIPTURE } from '../../data/bibleData';
import { extractDailyResources } from '../../services/fellowshipService';
import { canManageFellowship, localizeBuiltInVerse } from '../../utils/fellowshipLogic';
import { getMemoryVerseText, maskMemoryVerse } from '../../utils/spiritualLogic';
import type { TranslationStrings } from '../../data/translations';
import type {
  DailyScriptureDoc,
  FellowshipAccount,
  LanguageCode,
  SpiritualResource,
  SpiritualResourceCategory,
} from '../../types/fellowship';
import type { PublishCategory } from '../profile/CommandCentreDialogs';

export type SpiritualFilterChip =
  | 'ALL'
  | 'BOOKMARKED'
  | SpiritualResourceCategory;

interface DevotionalsSermonsViewProps {
  account: FellowshipAccount;
  scriptureDocs: DailyScriptureDoc[];
  resources: SpiritualResource[];
  bookmarkedIds: Set<string>;
  dismissedIds: Set<string>;
  language: LanguageCode;
  labels: TranslationStrings;
  playingId: string | null;
  isPaused: boolean;
  progress: number;
  audioError: string | null;
  onClearAudioError: () => void;
  onListenAloud: (resource: SpiritualResource) => void;
  onStopAudio: () => void;
  onOpenReader: (resource: SpiritualResource) => void;
  onToggleBookmark: (resource: SpiritualResource) => void;
  onShare: (resource: SpiritualResource) => void;
  onOpenPublish: (initialCategory: PublishCategory) => void;
  onEditResource: (resource: SpiritualResource) => void;
  onRequestDelete: (resource: SpiritualResource) => void;
}

const FILTER_ORDER: { id: SpiritualFilterChip; label?: string }[] = [
  { id: 'BOOKMARKED' },
  { id: 'ALL' },
  { id: 'SCRIPTURE_OF_THE_DAY', label: 'SCRIPTURE OF THE DAY' },
  { id: 'SERMON', label: 'SERMON' },
  { id: 'DEVOTIONAL', label: 'DEVOTIONAL' },
  { id: 'BIBLE_STUDY', label: 'BIBLE STUDY' },
  { id: 'PRAYER_POINTS', label: 'PRAYER POINTS' },
];

export const DevotionalsSermonsView: React.FC<DevotionalsSermonsViewProps> = ({
  account,
  scriptureDocs,
  resources,
  bookmarkedIds,
  dismissedIds,
  language,
  labels,
  playingId,
  isPaused,
  progress,
  audioError,
  onClearAudioError,
  onListenAloud,
  onStopAudio,
  onOpenReader,
  onToggleBookmark,
  onShare,
  onOpenPublish,
  onEditResource,
  onRequestDelete,
}) => {
  const [filterChip, setFilterChip] = useState<SpiritualFilterChip>('ALL');
  const [revealMemory, setRevealMemory] = useState(true);

  const isLeadership = canManageFellowship(account.role);

  const heroScripture = useMemo(() => {
    const extracted = extractDailyResources(scriptureDocs);
    const liveDoc = extracted.dailyScripture || DEFAULT_DAILY_SCRIPTURE;
    const reference = (liveDoc.referenceEn || liveDoc.reference || 'Daniel 11:32b').trim();
    const rawVerse = (
      liveDoc.verseTextEn ||
      liveDoc.verseText ||
      '...but the people that do know their God shall be strong, and do exploits.'
    ).trim();
    const localized = localizeBuiltInVerse(reference, rawVerse, language, liveDoc);
    const displayText = getMemoryVerseText(reference, localized, language);
    return {
      reference,
      text: displayText,
      authorName: (liveDoc.authorName || 'Living Faith Church Youth Ministry').trim(),
    };
  }, [scriptureDocs, language]);

  const maskedVerse = useMemo(
    () => maskMemoryVerse(heroScripture.text, revealMemory),
    [heroScripture.text, revealMemory]
  );

  const visibleResources = useMemo(
    () => resources.filter((r) => !dismissedIds.has(r.id)),
    [resources, dismissedIds]
  );

  const filteredResources = useMemo(() => {
    return visibleResources.filter((r) => {
      if (filterChip === 'ALL') return true;
      if (filterChip === 'BOOKMARKED') {
        return bookmarkedIds.has(r.id) || r.bookmarkedBy.includes(account.id);
      }
      return r.kind === filterChip;
    });
  }, [visibleResources, filterChip, bookmarkedIds, account.id]);

  const savedCount = useMemo(
    () =>
      visibleResources.filter(
        (r) => bookmarkedIds.has(r.id) || r.bookmarkedBy.includes(account.id)
      ).length,
    [visibleResources, bookmarkedIds, account.id]
  );

  return (
    <div className="space-y-4">
      {/* Audio playback error / alert */}
      {audioError && (
        <div
          role="alert"
          className="rounded-2xl bg-[#FFF1F2] dark:bg-[#9F1239]/25 border border-[#E11D48]/40 px-4 py-3 text-xs font-semibold text-[#9F1239] dark:text-[#FECDD3] flex items-center justify-between gap-3"
        >
          <span>{audioError}</span>
          <button
            type="button"
            aria-label="Dismiss audio alert"
            onClick={onClearAudioError}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Card 1 — #0F172A Globe Black Scripture for the Day & Memory Verse Challenge */}
      <section className="rounded-2xl bg-[#0F172A] text-white border border-[#1E293B] p-5 space-y-4 shadow-md">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold tracking-wider text-[#F59E0B] uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{labels.spiritual.scriptureOfTheDayBadge} &bull; MEMORY VERSE</span>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-[#1E293B] border border-[#334155] text-[11px] font-bold text-[#CBD5E1] shrink-0">
            Gideonites &bull; {language}
          </span>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-extrabold text-[#FB7185] uppercase tracking-wide">
            {heroScripture.reference}
          </p>
          <blockquote className="font-display text-base sm:text-lg font-bold leading-relaxed text-white">
            "{maskedVerse}"
          </blockquote>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => setRevealMemory((v) => !v)}
            className="min-h-[44px] px-4 rounded-xl bg-[#F59E0B] hover:bg-[#D97706] text-[#0F172A] text-xs font-extrabold inline-flex items-center gap-1.5 transition-colors"
          >
            {revealMemory ? (
              <>
                <EyeOff className="w-4 h-4" />
                <span>{labels.spiritual.practiceMemory}</span>
              </>
            ) : (
              <>
                <Eye className="w-4 h-4" />
                <span>{labels.spiritual.revealScripture}</span>
              </>
            )}
          </button>

          {isLeadership && (
            <button
              type="button"
              onClick={() => onOpenPublish('SCRIPTURE_OF_THE_DAY')}
              className="min-h-[44px] px-4 rounded-xl bg-[#1E293B] hover:bg-[#334155] border border-[#F59E0B]/50 text-[#FEF3C7] text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4 text-[#F59E0B]" />
              <span>{labels.spiritual.postScriptureAction}</span>
            </button>
          )}
        </div>

        {heroScripture.authorName && (
          <p className="text-[11px] text-[#94A3B8]">
            Posted by <span className="font-semibold text-[#CBD5E1]">{heroScripture.authorName}</span>
          </p>
        )}
      </section>

      {/* Card 2 — Leadership Quick Actions Card */}
      {isLeadership && (
        <section className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-4 space-y-3">
          <p className="text-[11px] font-extrabold tracking-wider text-[#64748B] dark:text-[#94A3B8] uppercase">
            ADMIN &amp; EXECUTIVE PUBLISHING
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => onOpenPublish('SERMON')}
              className="min-h-[44px] px-3 rounded-xl bg-[#E11D48] hover:bg-[#9F1239] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5"
            >
              <FileText className="w-4 h-4" />
              <span>Upload Sermon</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenPublish('DEVOTIONAL')}
              className="min-h-[44px] px-3 rounded-xl border border-[#E11D48] text-[#E11D48] dark:text-[#FB7185] hover:bg-[#FFF1F2] dark:hover:bg-[#9F1239]/20 text-xs font-bold inline-flex items-center justify-center gap-1.5"
            >
              <BookOpen className="w-4 h-4" />
              <span>Daily Devotional</span>
            </button>
          </div>
        </section>
      )}

      {/* Horizontal Category & Saved Offline Filter Row */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        {FILTER_ORDER.map((item) => {
          const isSelected = filterChip === item.id;
          const label =
            item.id === 'BOOKMARKED'
              ? `${labels.spiritual.savedOfflineFilter}${savedCount > 0 ? ` (${savedCount})` : ''}`
              : item.id === 'ALL'
              ? labels.spiritual.allFilter
              : item.label || item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilterChip(item.id)}
              className={`min-h-[40px] px-3.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-colors border ${
                isSelected
                  ? 'bg-[#E11D48] text-white border-[#E11D48]'
                  : 'bg-white dark:bg-[#111827] border-[#E2E8F0] dark:border-[#374151] text-[#334155] dark:text-[#CBD5E1]'
              }`}
            >
              {item.id === 'BOOKMARKED' && (
                <Bookmark
                  className={`w-3.5 h-3.5 ${
                    isSelected ? 'fill-white text-white' : 'text-[#F59E0B]'
                  }`}
                />
              )}
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Resource Feed / Empty State */}
      {filteredResources.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-8 text-center space-y-2">
          <BookOpen className="w-8 h-8 mx-auto text-[#64748B] dark:text-[#94A3B8]" />
          <h3 className="font-display text-base font-bold text-[#0F172A] dark:text-white">
            {filterChip === 'BOOKMARKED' ? 'No Saved Resources' : 'Word & Audio Library'}
          </h3>
          <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#94A3B8] max-w-md mx-auto">
            {filterChip === 'BOOKMARKED'
              ? "Tap 'Save Offline' or bookmark any sermon or devotional to read without internet."
              : 'No resources have been published in this category yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredResources.map((res) => {
            const isBookmarked =
              bookmarkedIds.has(res.id) || res.bookmarkedBy.includes(account.id);
            const isThisPlaying = playingId === res.id;
            const hasAudioBox =
              Boolean(res.audioDurationMinutes && res.audioDurationMinutes > 0) ||
              isThisPlaying;
            const canEditOrDelete = isLeadership && !res.id.startsWith('seed-');

            return (
              <article
                key={res.id}
                className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-5 space-y-3 shadow-sm"
              >
                {/* Header Row */}
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-[#FFF1F2] dark:bg-[#9F1239]/30 text-[#E11D48] dark:text-[#FB7185] text-[11px] font-extrabold tracking-wide uppercase">
                    {res.kind.replace(/_/g, ' ')}
                  </span>

                  <div className="flex items-center gap-1">
                    {canEditOrDelete && (
                      <>
                        <button
                          type="button"
                          aria-label={`Edit ${res.title}`}
                          onClick={() => onEditResource(res)}
                          className="min-h-[40px] min-w-[40px] rounded-xl text-[#64748B] hover:text-[#0F172A] dark:hover:text-white hover:bg-[#F1F5F9] dark:hover:bg-[#1F2937] flex items-center justify-center"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${res.title}`}
                          onClick={() => onRequestDelete(res)}
                          className="min-h-[40px] min-w-[40px] rounded-xl text-[#E11D48] hover:bg-[#FFF1F2] dark:hover:bg-[#9F1239]/25 flex items-center justify-center"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      aria-label={isBookmarked ? 'Remove offline bookmark' : 'Save offline bookmark'}
                      onClick={() => onToggleBookmark(res)}
                      className="min-h-[40px] min-w-[40px] rounded-xl hover:bg-[#F1F5F9] dark:hover:bg-[#1F2937] flex items-center justify-center"
                    >
                      <Bookmark
                        className={`w-4 h-4 ${
                          isBookmarked
                            ? 'fill-[#F59E0B] text-[#F59E0B]'
                            : 'text-[#64748B] dark:text-[#94A3B8]'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Title, Ref & Speaker */}
                <div className="space-y-1">
                  <h3 className="font-display text-base sm:text-lg font-extrabold text-[#0F172A] dark:text-white leading-snug">
                    {res.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold text-[#D97706] dark:text-[#F59E0B]">
                      {res.scriptureRef}
                    </span>
                    <span className="text-[#64748B] dark:text-[#94A3B8]">&bull;</span>
                    <span className="text-[#64748B] dark:text-[#94A3B8]">
                      By {res.speaker}
                    </span>
                    <span className="text-[#64748B] dark:text-[#94A3B8]">&bull;</span>
                    <span className="text-[#64748B] dark:text-[#94A3B8]">{res.duration}</span>
                  </div>
                </div>

                {/* Summary Snippet */}
                <p className="text-xs sm:text-sm text-[#334155] dark:text-[#CBD5E1] line-clamp-2 leading-relaxed">
                  {res.summary || res.body}
                </p>

                {/* Inline Audio Player Box */}
                {hasAudioBox && (
                  <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="inline-flex items-center gap-1.5 font-bold text-[#0F172A] dark:text-white">
                        <AudioLines
                          className={`w-4 h-4 ${
                            isThisPlaying && !isPaused ? 'text-[#E11D48] animate-pulse' : 'text-[#F59E0B]'
                          }`}
                        />
                        <span>
                          {isThisPlaying
                            ? isPaused
                              ? 'Audio Narration Paused'
                              : 'Narrating Aloud...'
                            : `Audio Message • ${res.audioDurationMinutes || 30} min`}
                        </span>
                      </span>
                      {isThisPlaying && (
                        <button
                          type="button"
                          onClick={onStopAudio}
                          className="text-xs font-bold text-[#E11D48] inline-flex items-center gap-1"
                        >
                          <Square className="w-3 h-3 fill-current" />
                          <span>{labels.spiritual.stopAudio}</span>
                        </button>
                      )}
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-[#E2E8F0] dark:bg-[#374151] overflow-hidden">
                      <div
                        className="h-full bg-[#E11D48] transition-all duration-300"
                        style={{
                          width: `${isThisPlaying ? Math.round(Math.max(6, progress * 100)) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Primary & Secondary Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onListenAloud(res)}
                    className="min-h-[44px] px-3.5 rounded-xl bg-[#E11D48] hover:bg-[#9F1239] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                  >
                    {isThisPlaying && !isPaused ? (
                      <>
                        <Pause className="w-4 h-4" />
                        <span>{labels.spiritual.pauseAudio}</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-4 h-4" />
                        <span>{labels.spiritual.listenAloud}</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenReader(res)}
                    className="min-h-[44px] px-3.5 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] dark:bg-[#1F2937] dark:hover:bg-[#334155] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <BookOpen className="w-4 h-4 text-[#F59E0B]" />
                    <span>{labels.spiritual.readFullMessage}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onToggleBookmark(res)}
                    className={`min-h-[44px] px-3 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 border ${
                      isBookmarked
                        ? 'bg-[#FEF3C7] dark:bg-[#F59E0B]/20 border-[#F59E0B] text-[#92400E] dark:text-[#FEF3C7]'
                        : 'bg-[#F8FAFC] dark:bg-[#1F2937] border-[#E2E8F0] dark:border-[#374151] text-[#334155] dark:text-[#CBD5E1]'
                    }`}
                  >
                    {isBookmarked ? (
                      <Check className="w-3.5 h-3.5 text-[#F59E0B]" />
                    ) : (
                      <Bookmark className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {isBookmarked
                        ? labels.spiritual.bookmarkedLabel
                        : labels.spiritual.saveOffline}
                    </span>
                  </button>

                  <button
                    type="button"
                    aria-label={`Share ${res.title}`}
                    onClick={() => onShare(res)}
                    className="min-h-[44px] min-w-[44px] rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-[#334155] dark:text-[#CBD5E1] flex items-center justify-center ml-auto"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Floating Action Button for Leadership */}
      {isLeadership && (
        <button
          type="button"
          aria-label="Publish spiritual resource"
          onClick={() => onOpenPublish('SERMON')}
          className="fixed right-4 sm:right-6 bottom-[calc(4.85rem+env(safe-area-inset-bottom))] z-30 min-h-[54px] min-w-[54px] px-4 rounded-2xl bg-[#E11D48] hover:bg-[#9F1239] text-white shadow-xl flex items-center justify-center gap-1.5 font-bold text-xs transition-transform active:scale-95"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">Publish</span>
        </button>
      )}
    </div>
  );
};
