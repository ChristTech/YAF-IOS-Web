import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, FileText, Search, Upload, X } from 'lucide-react';
import {
  buildAllExplorerVerses,
  filterExplorerVerses,
  mergeBibleEditionsWithDefault,
} from '../../utils/spiritualLogic';
import { loadOfflineBibleEditions } from '../../utils/offlineStorage';
import { UploadBibleDatabaseDialog } from '../profile/CommandCentreDialogs';
import { UploadedBibleDocumentReaderDialog } from './UploadedBibleDocumentReaderDialog';
import type { SpiritualTranslationStrings } from '../../data/translations';
import type {
  DailyScriptureDoc,
  FellowshipAccount,
  LanguageCode,
  UploadedBibleDoc,
} from '../../types/fellowship';

interface BibleReaderScreenProps {
  account: FellowshipAccount;
  isLeadership: boolean;
  language: LanguageCode;
  labels: SpiritualTranslationStrings;
  uploadedBibles: UploadedBibleDoc[];
  scriptureDocs: DailyScriptureDoc[];
}

export const BibleReaderScreen: React.FC<BibleReaderScreenProps> = ({
  account,
  isLeadership,
  language,
  labels,
  uploadedBibles,
  scriptureDocs,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterByActiveLanguage, setFilterByActiveLanguage] = useState(true);
  const [selectedTranslation, setSelectedTranslation] = useState<string>('ALL');
  const [selectedTheme, setSelectedTheme] = useState<string>('ALL');
  const [selectedDoc, setSelectedDoc] = useState<UploadedBibleDoc | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadBanner, setUploadBanner] = useState<string | null>(null);
  const [offlineEditions, setOfflineEditions] = useState<UploadedBibleDoc[]>([]);

  // Auto-sync Bible language filter whenever the global TopAppBar language changes
  useEffect(() => {
    setFilterByActiveLanguage(true);
    setSelectedTranslation('ALL');
  }, [language]);

  useEffect(() => {
    let cancelled = false;
    void loadOfflineBibleEditions().then((items) => {
      if (!cancelled && items.length > 0) {
        setOfflineEditions(items);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [uploadedBibles.length]);

  const mergedEditions = useMemo(() => {
    const combined = [...uploadedBibles];
    for (const off of offlineEditions) {
      if (!combined.some((b) => b.id === off.id)) {
        combined.push(off);
      }
    }
    return mergeBibleEditionsWithDefault(combined);
  }, [uploadedBibles, offlineEditions]);

  const allVerses = useMemo(
    () => buildAllExplorerVerses(scriptureDocs),
    [scriptureDocs]
  );

  const distinctTranslations = useMemo(
    () => Array.from(new Set(allVerses.map((v) => v.translation))),
    [allVerses]
  );

  const distinctThemes = useMemo(
    () => Array.from(new Set(allVerses.map((v) => v.theme))),
    [allVerses]
  );

  const { verses: filteredVerses } = useMemo(
    () =>
      filterExplorerVerses(allVerses, {
        activeLanguage: language,
        filterByActiveLanguage,
        selectedTranslation,
        selectedTheme,
        searchQuery,
      }),
    [allVerses, language, filterByActiveLanguage, selectedTranslation, selectedTheme, searchQuery]
  );

  return (
    <div className="space-y-4 pb-safe-scroll">
      {/* Dark #0F172A Explorer Header */}
      <section className="rounded-[18px] bg-[#0F172A] text-white border border-[#1E293B] p-4 sm:p-5 shadow-md space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-[#F59E0B]/20 border border-[#F59E0B]/50 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-[#F59E0B]" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-sm sm:text-base font-extrabold text-white truncate">
                The Gideonites - Youth Alive • {labels.tabBibleExplorer}
              </h2>
              <p className="text-xs text-[#CBD5E1] tabular-nums">
                {filteredVerses.length} Scriptures • {mergedEditions.length} PDF/EPUB Bibles
              </p>
            </div>
          </div>

          {isLeadership && (
            <button
              type="button"
              onClick={() => setShowUploadDialog(true)}
              className="min-h-[44px] px-4 rounded-xl bg-[#E11D48] hover:bg-[#9F1239] text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0 transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span>Upload PDF/EPUB</span>
            </button>
          )}
        </div>

        {uploadBanner && (
          <div
            role="status"
            className="rounded-xl bg-[#16A34A]/20 border border-[#16A34A]/50 px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs font-semibold text-[#86EFAC]"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{uploadBanner}</span>
            </div>
            <button
              type="button"
              aria-label="Dismiss upload notice"
              onClick={() => setUploadBanner(null)}
              className="p-1 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </section>

      {/* Backend PDF & EPUB Reference Bibles Strip */}
      <section className="space-y-2">
        <p className="text-[11px] font-extrabold tracking-wider uppercase text-[#64748B] dark:text-[#94A3B8]">
          BACKEND PDF & EPUB REFERENCE BIBLES (TAP TO OPEN):
        </p>
        <div className="flex items-stretch gap-3 overflow-x-auto no-scrollbar pb-1">
          {mergedEditions.map((docItem) => (
            <button
              key={docItem.id}
              type="button"
              onClick={() => setSelectedDoc(docItem)}
              className="min-w-[240px] max-w-[280px] text-left rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] hover:border-[#E11D48] p-3.5 flex items-start gap-3 shrink-0 transition-colors shadow-xs"
            >
              <div className="w-10 h-10 rounded-xl bg-[#0F172A] text-[#F59E0B] flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-[#FEF3C7] dark:bg-[#F59E0B]/20 text-[#92400E] dark:text-[#FCD34D] text-[10px] font-extrabold">
                    {docItem.translation || docItem.version}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-[#FFF1F2] dark:bg-[#9F1239]/30 text-[#E11D48] text-[10px] font-extrabold">
                    {docItem.fileFormat || docItem.format}
                  </span>
                </div>
                <p className="text-xs font-bold text-[#0F172A] dark:text-white line-clamp-2">
                  {docItem.title}
                </p>
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate">
                  {docItem.pageOrChapterCount || docItem.sections?.length || 1} sections · Tap to open
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Search & Auto-Synced Filter Chips */}
      <section className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-4 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search scriptures, books (e.g. Daniel 11), or themes..."
            className="w-full min-h-[44px] pl-10 pr-10 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearchQuery('')}
              className="min-w-[40px] min-h-[40px] absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center text-[#64748B] hover:text-[#0F172A] dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Language Toggle + Translation Chips */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            type="button"
            onClick={() => setFilterByActiveLanguage((prev) => !prev)}
            className={`min-h-[38px] px-3.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
              filterByActiveLanguage
                ? 'bg-[#0F172A] dark:bg-[#F59E0B] text-white dark:text-[#0F172A]'
                : 'bg-[#F1F5F9] dark:bg-[#1F2937] text-[#334155] dark:text-[#CBD5E1]'
            }`}
          >
            {filterByActiveLanguage
              ? labels.bibleAutoSyncedLabel
              : labels.bibleAllLanguagesLabel}
          </button>

          <button
            type="button"
            onClick={() => setSelectedTranslation('ALL')}
            className={`min-h-[38px] px-3.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
              selectedTranslation === 'ALL'
                ? 'bg-[#E11D48] text-white'
                : 'bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-[#334155] dark:text-[#CBD5E1]'
            }`}
          >
            All Versions
          </button>

          {distinctTranslations.map((tr) => (
            <button
              key={tr}
              type="button"
              onClick={() => setSelectedTranslation(tr)}
              className={`min-h-[38px] px-3.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                selectedTranslation === tr
                  ? 'bg-[#E11D48] text-white'
                  : 'bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-[#334155] dark:text-[#CBD5E1]'
              }`}
            >
              {tr}
            </button>
          ))}
        </div>

        {/* Theme Chips */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            type="button"
            onClick={() => setSelectedTheme('ALL')}
            className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              selectedTheme === 'ALL'
                ? 'bg-[#F59E0B] text-[#0F172A] font-bold'
                : 'bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-[#64748B] dark:text-[#94A3B8]'
            }`}
          >
            All Themes
          </button>
          {distinctThemes.map((th) => (
            <button
              key={th}
              type="button"
              onClick={() => setSelectedTheme(th)}
              className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                selectedTheme === th
                  ? 'bg-[#F59E0B] text-[#0F172A] font-bold'
                  : 'bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-[#64748B] dark:text-[#94A3B8]'
              }`}
            >
              {th}
            </button>
          ))}
        </div>
      </section>

      {/* Scripture Cards List */}
      {filteredVerses.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-8 text-center space-y-2">
          <p className="text-sm font-bold text-[#0F172A] dark:text-white">
            No Matching Scriptures
          </p>
          <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
            Try clearing your search query or selecting All Versions / All Themes.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredVerses.map((v) => (
            <article
              key={v.id}
              className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-4 space-y-2 shadow-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#FFF1F2] dark:bg-[#9F1239]/30 text-[#E11D48] dark:text-[#FB7185] text-xs font-extrabold">
                    {v.reference}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#FEF3C7] dark:bg-[#F59E0B]/20 text-[#92400E] dark:text-[#FCD34D] text-[10px] font-extrabold">
                    {v.translation}
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8]">
                  {v.theme}
                </span>
              </div>
              <p className="text-sm italic leading-relaxed text-[#0F172A] dark:text-[#F8FAFC]">
                “{v.text}”
              </p>
            </article>
          ))}
        </div>
      )}

      <UploadedBibleDocumentReaderDialog
        document={selectedDoc}
        onClose={() => setSelectedDoc(null)}
      />

      <UploadBibleDatabaseDialog
        isOpen={showUploadDialog}
        account={account}
        onClose={() => setShowUploadDialog(false)}
        onSuccess={(msg) => setUploadBanner(msg)}
      />
    </div>
  );
};
