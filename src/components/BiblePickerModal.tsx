import React, { useMemo, useState } from 'react';
import { BookOpen, FileText, Search, Trash2, Upload, X } from 'lucide-react';
import {
  BIBLE_VERSES,
  build66BookReferenceVerses,
  type BibleVerseItem,
} from '../data/bibleData';
import {
  deleteUploadedBibleEdition,
  logAuditTrail,
  publishUploadedBibleEdition,
} from '../services/fellowshipService';
import {
  extractBiblePackVerses,
  mergeBibleEditionsWithDefault,
} from '../utils/spiritualLogic';
import { UploadedBibleDocumentReaderDialog } from './spiritual/UploadedBibleDocumentReaderDialog';
import { UploadBibleDatabaseModal } from './games/UploadBibleDatabaseModal';
import { formatActionErrorMessage, getDisplayNameForAccount } from '../utils/fellowshipLogic';
import type {
  DailyScriptureDoc,
  FellowshipAccount,
  UploadedBibleDoc,
  UploadedBibleSection,
} from '../types/fellowship';

export const BIBLE_PICKER_THEMES = [
  'All',
  'Exploits & Strength',
  'Courage & Boldness',
  'Youth & Purpose',
  'Victory & Conquerors',
  'Wisdom & Guidance',
  'Faith & Trust',
  'Gideonites Heritage',
] as const;

interface PickerVerseEntry extends BibleVerseItem {
  version: string;
}

interface BiblePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  uploadedBibles: UploadedBibleDoc[];
  scriptureDocs?: DailyScriptureDoc[];
  account?: FellowshipAccount;
  onPickVerse?: (verse: BibleVerseItem & { translation?: string }) => void;
  pickerMode?: boolean;
  defaultTab?: 'Verses' | 'Bibles' | 'All' | 'Uploaded';
  initialDoc?: UploadedBibleDoc | null;
}

function mapVerseToPickerTheme(rawTheme: string): string {
  const lower = (rawTheme || '').toLowerCase();
  if (lower.includes('exploit') || lower.includes('strength') || lower.includes('power') || lower.includes('renewal')) {
    return 'Exploits & Strength';
  }
  if (lower.includes('courage') || lower.includes('bold') || lower.includes('warfare')) {
    return 'Courage & Boldness';
  }
  if (lower.includes('youth') || lower.includes('purpose') || lower.includes('influence') || lower.includes('example')) {
    return 'Youth & Purpose';
  }
  if (lower.includes('victory') || lower.includes('kingdom') || lower.includes('salv')) {
    return 'Victory & Conquerors';
  }
  if (lower.includes('wisdom') || lower.includes('guidance') || lower.includes('direction') || lower.includes('mastery')) {
    return 'Wisdom & Guidance';
  }
  if (lower.includes('faith') || lower.includes('trust') || lower.includes('provision')) {
    return 'Faith & Trust';
  }
  if (lower.includes('gideon') || lower.includes('gap') || lower.includes('revival')) {
    return 'Gideonites Heritage';
  }
  return rawTheme || 'Gideonites Heritage';
}

export const BiblePickerModal: React.FC<BiblePickerModalProps> = ({
  isOpen,
  onClose,
  uploadedBibles,
  scriptureDocs = [],
  account,
  onPickVerse,
  pickerMode = false,
  defaultTab = 'Verses',
  initialDoc = null,
}) => {
  const [activeTab, setActiveTab] = useState<'VERSES' | 'BIBLES'>(
    defaultTab === 'Bibles' || defaultTab === 'Uploaded' ? 'BIBLES' : 'VERSES'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVersion, setSelectedVersion] = useState<string>('All');
  const [selectedTheme, setSelectedTheme] = useState<string>('All');
  const [selectedBook, setSelectedBook] = useState<string>('All');
  const [selectedDoc, setSelectedDoc] = useState<UploadedBibleDoc | null>(initialDoc);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [syncing66, setSyncing66] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setSelectedDoc(initialDoc);
      setActiveTab(
        initialDoc || defaultTab === 'Bibles' || defaultTab === 'Uploaded'
          ? 'BIBLES'
          : 'VERSES'
      );
      setStatusMessage(null);
    }
  }, [isOpen, defaultTab, initialDoc]);

  const mergedBibles = useMemo(
    () => mergeBibleEditionsWithDefault(uploadedBibles),
    [uploadedBibles]
  );

  const allVerses = useMemo<PickerVerseEntry[]>(() => {
    const base: PickerVerseEntry[] = BIBLE_VERSES.map((v) => ({
      ...v,
      version: 'KJV',
      theme: mapVerseToPickerTheme(v.theme),
    }));
    const fromPacks: PickerVerseEntry[] = extractBiblePackVerses(scriptureDocs).map((p) => ({
      id: p.id,
      testament: p.testament,
      book: p.book,
      chapter: p.chapter,
      verse: p.verse,
      reference: p.reference,
      text: p.text,
      theme: mapVerseToPickerTheme(p.theme),
      version: p.translation || 'KJV',
    }));
    const seen = new Set<string>();
    const combined: PickerVerseEntry[] = [];
    for (const v of [...fromPacks, ...base]) {
      const k = `${v.version.toLowerCase()}|${v.reference.toLowerCase()}`;
      if (!seen.has(k)) {
        seen.add(k);
        combined.push(v);
      }
    }
    return combined;
  }, [scriptureDocs]);

  const availableVersions = useMemo(() => {
    const defaults = ['All', 'KJV', 'NKJV', 'NIV', 'AMP'];
    const custom = Array.from(
      new Set([
        ...mergedBibles.map((b) => b.translation || b.version).filter(Boolean),
        ...allVerses.map((v) => v.version).filter(Boolean),
      ])
    ).filter((v) => !defaults.includes(v));
    return [...defaults, ...custom];
  }, [mergedBibles, allVerses]);

  const distinctBooks = useMemo(() => {
    const books = Array.from(new Set(allVerses.map((v) => v.book).filter(Boolean)));
    return books;
  }, [allVerses]);

  const filteredVerses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allVerses.filter((v) => {
      if (selectedVersion !== 'All' && v.version !== selectedVersion) return false;
      if (selectedTheme !== 'All' && v.theme !== selectedTheme) return false;
      if (selectedBook !== 'All' && v.book !== selectedBook) return false;
      if (!q) return true;
      return (
        v.reference.toLowerCase().includes(q) ||
        v.text.toLowerCase().includes(q) ||
        v.book.toLowerCase().includes(q) ||
        v.theme.toLowerCase().includes(q)
      );
    });
  }, [allVerses, searchQuery, selectedVersion, selectedTheme, selectedBook]);

  if (!isOpen) return null;

  const canUpload =
    !account ||
    account.role === 'ADMINISTRATOR' ||
    account.role === 'YOUTH_EXECUTIVE';

  const handleSync66 = async () => {
    if (!account) return;
    setSyncing66(true);
    setStatusMessage(null);
    try {
      const displayName = getDisplayNameForAccount(account);
      const trans = selectedVersion !== 'All' ? selectedVersion : 'KJV';
      const verses = build66BookReferenceVerses(trans);
      const editionSections: UploadedBibleSection[] = [
        {
          title: `66-Book Canonical Index (${trans})`,
          content: verses.map((v) => `${v.reference} — ${v.text}`).join('\n'),
        },
      ];
      await publishUploadedBibleEdition({
        title: `${trans} 66-Book Reference Bible`,
        translation: trans,
        format: 'PDF',
        fileName: `${trans.toLowerCase().replace(/[^a-z0-9]/g, '')}-66books.pdf`,
        fileSizeKb: 42,
        sections: editionSections,
        pageOrChapterCount: 66,
        verses,
        uploadedBy: displayName,
        authorId: account.userId || account.id,
      });
      await logAuditTrail({
        actorName: displayName,
        actorRole: account.role,
        action: 'SYNC_BIBLE_66_BOOKS',
        target: trans,
      });
      setStatusMessage(`Synced 66-Book ${trans} Reference Bible to Firestore.`);
    } catch (err) {
      setStatusMessage(formatActionErrorMessage(err, 'Unable to sync 66-Book Bible.'));
    } finally {
      setSyncing66(false);
    }
  };

  const handleDeleteBible = async (docItem: UploadedBibleDoc) => {
    if (docItem.id === 'bdoc_default_kjv') return;
    try {
      await deleteUploadedBibleEdition(docItem.id);
      setStatusMessage(`Deleted "${docItem.title}".`);
    } catch (err) {
      setStatusMessage(formatActionErrorMessage(err, 'Unable to delete Bible edition.'));
    }
  };

  if (selectedDoc) {
    return (
      <UploadedBibleDocumentReaderDialog
        document={selectedDoc}
        pickerMode={pickerMode || Boolean(onPickVerse)}
        onPickVerse={(verse) => {
          onPickVerse?.(verse);
          setSelectedDoc(null);
          onClose();
        }}
        onClose={() => {
          if (initialDoc) {
            setSelectedDoc(null);
            onClose();
          } else {
            setSelectedDoc(null);
          }
        }}
      />
    );
  }

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="bible-picker-title"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 sm:p-6 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
      >
        <div className="w-full max-w-2xl max-h-[90dvh] flex flex-col rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-[#0F172A] text-white px-4 sm:px-5 py-3.5 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <BookOpen className="w-5 h-5 text-[#F59E0B] shrink-0" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id="bible-picker-title" className="text-base font-bold truncate">
                    Executive Bible Reference
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-[#F59E0B] text-[#0F172A] text-[11px] font-extrabold">
                    {allVerses.length} Verses
                  </span>
                </div>
                <p className="text-[11px] text-[#94A3B8]">
                  Scripture database &amp; synced PDF / EPUB fellowship editions
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {canUpload && account && (
                <button
                  type="button"
                  onClick={() => setShowUploadModal(true)}
                  className="min-h-[36px] px-3 rounded-xl bg-[#E11D48] text-white text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload PDF/EPUB</span>
                </button>
              )}
              <button
                type="button"
                aria-label="Close Executive Bible Reference"
                onClick={onClose}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#94A3B8] hover:text-white hover:bg-[#1E293B]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 2 Tabs */}
          <div className="px-4 pt-3 pb-2 bg-[#F8FAFC] dark:bg-[#0B0F19] border-b border-[#E2E8F0] dark:border-[#374151] space-y-2.5 shrink-0">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('VERSES')}
                className={`min-h-[40px] px-3 rounded-xl text-xs font-bold transition-colors ${
                  activeTab === 'VERSES'
                    ? 'bg-[#E11D48] text-white'
                    : 'bg-white dark:bg-[#1F2937] text-[#334155] dark:text-[#94A3B8] border border-[#E2E8F0] dark:border-[#374151]'
                }`}
              >
                📖 Scripture Verses ({filteredVerses.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('BIBLES')}
                className={`min-h-[40px] px-3 rounded-xl text-xs font-bold transition-colors ${
                  activeTab === 'BIBLES'
                    ? 'bg-[#E11D48] text-white'
                    : 'bg-white dark:bg-[#1F2937] text-[#334155] dark:text-[#94A3B8] border border-[#E2E8F0] dark:border-[#374151]'
                }`}
              >
                📄 PDF / EPUB Bibles ({mergedBibles.length})
              </button>
            </div>

            {statusMessage && (
              <div className="rounded-xl bg-[#FEF3C7] dark:bg-[#F59E0B]/20 border border-[#F59E0B]/50 px-3 py-2 text-xs font-semibold text-[#92400E] dark:text-[#FEF3C7]">
                {statusMessage}
              </div>
            )}

            {activeTab === 'VERSES' && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search reference, verse text, book, or theme..."
                    className="w-full min-h-[42px] pl-10 pr-4 rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] text-sm text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#E11D48]"
                  />
                </div>

                {/* Version Filter */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] mr-1">
                    Version:
                  </span>
                  {availableVersions.map((ver) => (
                    <button
                      key={ver}
                      type="button"
                      onClick={() => setSelectedVersion(ver)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                        selectedVersion === ver
                          ? 'bg-[#0F172A] dark:bg-[#F59E0B] text-white dark:text-[#0F172A]'
                          : 'bg-white dark:bg-[#1F2937] text-[#334155] dark:text-[#CBD5E1] border border-[#E2E8F0] dark:border-[#374151]'
                      }`}
                    >
                      {ver}
                    </button>
                  ))}
                </div>

                {/* Theme Filter */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] mr-1">
                    Theme:
                  </span>
                  {BIBLE_PICKER_THEMES.map((thm) => (
                    <button
                      key={thm}
                      type="button"
                      onClick={() => setSelectedTheme(thm)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                        selectedTheme === thm
                          ? 'bg-[#E11D48] text-white'
                          : 'bg-white dark:bg-[#1F2937] text-[#334155] dark:text-[#CBD5E1] border border-[#E2E8F0] dark:border-[#374151]'
                      }`}
                    >
                      {thm}
                    </button>
                  ))}
                </div>

                {/* Dynamic Book Filter when distinct books > 2 */}
                {distinctBooks.length > 2 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8] mr-1">
                      Book:
                    </span>
                    {['All', ...distinctBooks].map((bk) => (
                      <button
                        key={bk}
                        type="button"
                        onClick={() => setSelectedBook(bk)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap ${
                          selectedBook === bk
                            ? 'bg-[#10B981] text-white'
                            : 'bg-white dark:bg-[#1F2937] text-[#334155] dark:text-[#CBD5E1] border border-[#E2E8F0] dark:border-[#374151]'
                        }`}
                      >
                        {bk}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-3">
            {activeTab === 'BIBLES' ? (
              <div className="space-y-3">
                {canUpload && account && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowUploadModal(true)}
                      className="min-h-[40px] px-3.5 rounded-xl bg-[#E11D48] text-white text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload PDF/EPUB</span>
                    </button>
                    <button
                      type="button"
                      disabled={syncing66}
                      onClick={handleSync66}
                      className="min-h-[40px] px-3.5 rounded-xl bg-[#FEF3C7] dark:bg-[#F59E0B]/20 border border-[#F59E0B]/60 text-[#92400E] dark:text-[#FEF3C7] text-xs font-bold disabled:opacity-50"
                    >
                      {syncing66 ? 'Syncing 66 Books...' : 'Sync 66-Book Reference Bible'}
                    </button>
                  </div>
                )}

                {mergedBibles.map((docItem) => {
                  const isDefault = docItem.id === 'bdoc_default_kjv';
                  return (
                    <div
                      key={docItem.id}
                      className="rounded-xl border border-[#E2E8F0] dark:border-[#374151] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#1F2937]"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-[#F59E0B] shrink-0" />
                          <h4 className="font-semibold text-sm text-[#0F172A] dark:text-white truncate">
                            {docItem.title}
                          </h4>
                        </div>
                        <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1">
                          {docItem.translation || docItem.version} &bull;{' '}
                          {docItem.fileFormat || docItem.format} &bull;{' '}
                          {docItem.pageOrChapterCount || docItem.sections?.length || 1} sections
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {!isDefault && canUpload && (
                          <button
                            type="button"
                            onClick={() => handleDeleteBible(docItem)}
                            aria-label={`Delete ${docItem.title}`}
                            className="min-h-[40px] px-3 rounded-xl border border-[#E11D48]/40 text-[#E11D48] text-xs font-bold inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedDoc(docItem)}
                          className="min-h-[40px] px-3.5 rounded-xl bg-[#0F172A] dark:bg-[#E11D48] text-white text-xs font-bold"
                        >
                          Open Bible
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : filteredVerses.length === 0 ? (
              <div className="text-center py-10 text-sm text-[#64748B] dark:text-[#94A3B8]">
                No matching scriptures found for “{searchQuery}”.
              </div>
            ) : (
              filteredVerses.map((v) => {
                const previewWords = v.text
                  .replace(/[,.;:!?"'()—[\]]/g, '')
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 6);
                return (
                  <div
                    key={v.id}
                    className="rounded-xl border border-[#E2E8F0] dark:border-[#374151] p-4 bg-white dark:bg-[#1F2937] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
                        <span className="font-bold text-[#E11D48]">{v.reference}</span>
                        <span className="px-1.5 py-0.5 rounded bg-[#F1F5F9] dark:bg-[#111827] font-bold text-[10px]">
                          {v.version}
                        </span>
                        <span>&bull;</span>
                        <span>{v.theme}</span>
                      </div>
                      <p className="text-sm text-[#0F172A] dark:text-[#F8FAFC] leading-relaxed">
                        “{v.text}”
                      </p>
                      <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                        <span className="font-bold">Auto-Scramble Preview:</span>{' '}
                        {[...previewWords].reverse().join(' · ')}
                      </p>
                    </div>
                    {(pickerMode || onPickVerse) && (
                      <button
                        type="button"
                        onClick={() => {
                          onPickVerse?.({ ...v, translation: v.version });
                          onClose();
                        }}
                        className="min-h-[40px] px-4 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] dark:bg-[#E11D48] text-white text-xs font-bold shrink-0 touch-manipulation"
                      >
                        Select
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {account && (
        <UploadBibleDatabaseModal
          isOpen={showUploadModal}
          account={account}
          onClose={() => setShowUploadModal(false)}
          onSuccess={(msg) => setStatusMessage(msg)}
        />
      )}
    </>
  );
};

export const BibleScripturePickerDialog = BiblePickerModal;
