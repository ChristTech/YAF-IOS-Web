import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, FileText, Globe, Search, Upload, X } from 'lucide-react';
import { canManageFellowship } from '../../utils/fellowshipLogic';
import {
  buildAllExplorerVerses,
  mergeUploadedBiblesWithBaseline,
} from '../../utils/spiritualLogic';
import type { TranslationStrings } from '../../data/translations';
import type {
  DailyScriptureDoc,
  FellowshipAccount,
  LanguageCode,
  UploadedBibleDoc,
} from '../../types/fellowship';

interface BibleExplorerViewProps {
  account: FellowshipAccount;
  scriptureDocs: DailyScriptureDoc[];
  uploadedBibles: UploadedBibleDoc[];
  language: LanguageCode;
  labels: TranslationStrings;
  uploadBanner: string | null;
  onDismissUploadBanner: () => void;
  onOpenBibleUpload: () => void;
  onOpenUploadedBible: (doc: UploadedBibleDoc) => void;
}

export const BibleExplorerView: React.FC<BibleExplorerViewProps> = ({
  account,
  scriptureDocs,
  uploadedBibles,
  language,
  labels,
  uploadBanner,
  onDismissUploadBanner,
  onOpenBibleUpload,
  onOpenUploadedBible,
}) => {
  const isLeadership = canManageFellowship(account.role);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterByActiveLanguage, setFilterByActiveLanguage] = useState(true);
  const [selectedTranslation, setSelectedTranslation] = useState<string>('ALL');
  const [selectedTheme, setSelectedTheme] = useState<string>('ALL');

  // Auto-Language Sync whenever TopAppBar language changes
  useEffect(() => {
    setFilterByActiveLanguage(true);
    setSelectedTranslation('ALL');
  }, [language]);

  const allVerses = useMemo(
    () => buildAllExplorerVerses(scriptureDocs),
    [scriptureDocs]
  );

  const mergedBibles = useMemo(
    () => mergeUploadedBiblesWithBaseline(uploadedBibles),
    [uploadedBibles]
  );

  const distinctTranslations = useMemo(
    () => Array.from(new Set(allVerses.map((v) => v.translation))),
    [allVerses]
  );

  const distinctThemes = useMemo(
    () => Array.from(new Set(allVerses.map((v) => v.theme))),
    [allVerses]
  );

  const languageScopedVerses = useMemo(() => {
    if (!filterByActiveLanguage) return allVerses;
    const matched = allVerses.filter((v) => v.language === language);
    return matched.length > 0 ? matched : allVerses;
  }, [allVerses, filterByActiveLanguage, language]);

  const filteredVerses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return languageScopedVerses.filter((v) => {
      if (selectedTranslation !== 'ALL' && v.translation !== selectedTranslation) return false;
      if (selectedTheme !== 'ALL' && v.theme !== selectedTheme) return false;
      if (!q) return true;
      return (
        v.reference.toLowerCase().includes(q) ||
        v.book.toLowerCase().includes(q) ||
        v.text.toLowerCase().includes(q) ||
        v.theme.toLowerCase().includes(q) ||
        v.translation.toLowerCase().includes(q)
      );
    });
  }, [languageScopedVerses, selectedTranslation, selectedTheme, searchQuery]);

  const handleSelectTranslation = (translation: string) => {
    setSelectedTranslation(translation);
    if (translation !== 'ALL') {
      const hasInLang = allVerses.some(
        (v) => v.translation === translation && v.language === language
      );
      if (!hasInLang) {
        setFilterByActiveLanguage(false);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* #0F172A Bible Explorer Header Card (18px radius) */}
      <section className="rounded-[18px] bg-[#0F172A] text-white border border-[#1E293B] p-4 sm:p-5 flex items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-[#1E293B] border border-[#F59E0B]/40 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5 text-[#F59E0B]" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-base sm:text-lg font-extrabold truncate">
              {labels.subTabs.bibleExplorer}
            </h2>
            <p className="text-xs text-[#94A3B8] tabular-nums">
              {allVerses.length} Scriptures &bull; {mergedBibles.length} PDF/EPUB Bibles
            </p>
          </div>
        </div>

        {isLeadership && (
          <button
            type="button"
            onClick={onOpenBibleUpload}
            className="min-h-[44px] px-3.5 rounded-xl border border-[#F59E0B] text-[#F59E0B] hover:bg-[#F59E0B]/10 text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>Upload PDF/EPUB</span>
          </button>
        )}
      </section>

      {/* Dismissible Upload Feedback Card */}
      {uploadBanner && (
        <div
          role="status"
          className="rounded-2xl bg-[#16A34A] text-white px-4 py-3 text-xs font-bold flex items-center justify-between gap-3 shadow-sm"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{uploadBanner}</span>
          </span>
          <button
            type="button"
            aria-label="Dismiss upload banner"
            onClick={onDismissUploadBanner}
            className="p-1 rounded-lg hover:bg-black/15"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Backend PDF & EPUB Reference Bibles Strip */}
      {mergedBibles.length > 0 && (
        <section className="space-y-2">
          <p className="text-[11px] font-extrabold tracking-wider text-[#64748B] dark:text-[#94A3B8] uppercase">
            BACKEND PDF &amp; EPUB REFERENCE BIBLES (TAP TO OPEN):
          </p>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
            {mergedBibles.map((docItem) => {
              const formatLabel = docItem.fileFormat || docItem.format || 'PDF';
              const translationLabel = docItem.translation || docItem.version || 'KJV';
              return (
                <button
                  key={docItem.id}
                  type="button"
                  onClick={() => onOpenUploadedBible(docItem)}
                  className="min-w-[235px] max-w-[270px] shrink-0 text-left rounded-2xl bg-[#0F172A] text-white border border-[#F59E0B]/45 hover:border-[#F59E0B] p-4 space-y-1.5 transition-colors shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-extrabold text-[#F59E0B] uppercase tracking-wide">
                      {formatLabel} &bull; {translationLabel}
                    </span>
                    <FileText className="w-4 h-4 text-[#94A3B8]" />
                  </div>
                  <p className="font-display text-sm font-bold leading-snug line-clamp-2 text-white">
                    {docItem.title}
                  </p>
                  <p className="text-[11px] text-[#94A3B8] tabular-nums">
                    {docItem.pageOrChapterCount || docItem.sections?.length || 1} pages/chapters &bull;{' '}
                    {docItem.extractedVersesCount || 0} verses
                  </p>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Search Bar & Filters */}
      <section className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-4 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={labels.spiritual.bibleSearchPlaceholder}
            className="w-full min-h-[44px] pl-10 pr-10 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm focus:outline-none focus:ring-2 focus:ring-[#E11D48]"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear Bible search"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-[#64748B] hover:text-[#0F172A] dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Language Toggle + Translation Chips */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
          <button
            type="button"
            onClick={() => {
              const next = !filterByActiveLanguage;
              setFilterByActiveLanguage(next);
              if (next) setSelectedTranslation('ALL');
            }}
            className={`min-h-[38px] px-3 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 border ${
              filterByActiveLanguage
                ? 'bg-[#0F172A] text-[#F59E0B] border-[#0F172A] dark:bg-[#F59E0B] dark:text-[#0F172A] dark:border-[#F59E0B]'
                : 'bg-[#F8FAFC] dark:bg-[#1F2937] text-[#334155] dark:text-[#CBD5E1] border-[#E2E8F0] dark:border-[#374151]'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>
              {filterByActiveLanguage
                ? labels.spiritual.bibleAutoSyncedLabel
                : labels.spiritual.bibleAllLanguagesLabel}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectTranslation('ALL')}
            className={`min-h-[38px] px-3 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 border ${
              selectedTranslation === 'ALL'
                ? 'bg-[#E11D48] text-white border-[#E11D48]'
                : 'bg-[#F8FAFC] dark:bg-[#1F2937] text-[#334155] dark:text-[#CBD5E1] border-[#E2E8F0] dark:border-[#374151]'
            }`}
          >
            All Versions
          </button>

          {distinctTranslations.map((tr) => (
            <button
              key={tr}
              type="button"
              onClick={() => handleSelectTranslation(tr)}
              className={`min-h-[38px] px-3 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 border ${
                selectedTranslation === tr
                  ? 'bg-[#E11D48] text-white border-[#E11D48]'
                  : 'bg-[#F8FAFC] dark:bg-[#1F2937] text-[#334155] dark:text-[#CBD5E1] border-[#E2E8F0] dark:border-[#374151]'
              }`}
            >
              {tr}
            </button>
          ))}
        </div>

        {/* Theme Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
          <button
            type="button"
            onClick={() => setSelectedTheme('ALL')}
            className={`min-h-[36px] px-3 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 border ${
              selectedTheme === 'ALL'
                ? 'bg-[#0F172A] dark:bg-[#334155] text-white border-[#0F172A] dark:border-[#334155]'
                : 'bg-white dark:bg-[#111827] text-[#64748B] dark:text-[#94A3B8] border-[#E2E8F0] dark:border-[#374151]'
            }`}
          >
            All Themes
          </button>
          {distinctThemes.map((theme) => (
            <button
              key={theme}
              type="button"
              onClick={() => setSelectedTheme(theme)}
              className={`min-h-[36px] px-3 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 border ${
                selectedTheme === theme
                  ? 'bg-[#0F172A] dark:bg-[#334155] text-white border-[#0F172A] dark:border-[#334155]'
                  : 'bg-white dark:bg-[#111827] text-[#64748B] dark:text-[#94A3B8] border-[#E2E8F0] dark:border-[#374151]'
              }`}
            >
              {theme}
            </button>
          ))}
        </div>
      </section>

      {/* Scripture Results */}
      {filteredVerses.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-8 text-center space-y-3">
          <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
            No matching scriptures found for your current search or filter.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedTranslation('ALL');
              setSelectedTheme('ALL');
              setFilterByActiveLanguage(false);
            }}
            className="min-h-[42px] px-4 rounded-xl bg-[#E11D48] text-white text-xs font-bold"
          >
            Show All Languages &amp; Scriptures
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredVerses.map((v) => (
            <article
              key={v.id}
              className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-4 space-y-2 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-extrabold text-[#E11D48]">{v.reference}</span>
                <span className="px-2 py-0.5 rounded-md bg-[#FEF3C7] dark:bg-[#F59E0B]/20 text-[#92400E] dark:text-[#F59E0B] font-bold text-[11px]">
                  {v.translation}
                </span>
                <span className="ml-auto text-[#64748B] dark:text-[#94A3B8] font-medium">
                  {v.theme}
                </span>
              </div>
              <p className="text-sm sm:text-base italic leading-relaxed text-[#0F172A] dark:text-[#F8FAFC]">
                "{v.text}"
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};
