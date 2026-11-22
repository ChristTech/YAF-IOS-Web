import React, { useEffect, useState } from 'react';
import { FileText, Upload, X } from 'lucide-react';
import { build66BookReferenceVerses } from '../../data/bibleData';
import { logAuditTrail, publishUploadedBibleEdition } from '../../services/fellowshipService';
import { parseDocumentFile } from '../../utils/documentParser';
import {
  formatActionErrorMessage,
  getDisplayNameForAccount,
  parseLineOrJsonBibleVerses,
} from '../../utils/fellowshipLogic';
import { saveBibleEditionOffline } from '../../utils/offlineStorage';
import type { FellowshipAccount, UploadedBibleSection } from '../../types/fellowship';

export const BIBLE_TRANSLATION_OPTIONS = [
  'KJV',
  'NKJV',
  'NIV',
  'AMP',
  'Bibeli Mimo (YO)',
  'Littafi Mai Tsarki (HA)',
  'Baịbụl Nsọ (IG)',
] as const;

interface UploadBibleDatabaseModalProps {
  isOpen: boolean;
  account: FellowshipAccount;
  onClose: () => void;
  onSuccess?: (message: string) => void;
}

export const UploadBibleDatabaseModal: React.FC<UploadBibleDatabaseModalProps> = ({
  isOpen,
  account,
  onClose,
  onSuccess,
}) => {
  const displayName = getDisplayNameForAccount(account);
  const [formatTab, setFormatTab] = useState<'PDF_EPUB' | 'LINE' | 'JSON'>('PDF_EPUB');
  const [translation, setTranslation] = useState<string>('KJV');
  const [title, setTitle] = useState('KJV Youth Study Edition');
  const [fileName, setFileName] = useState('');
  const [fileSizeKb, setFileSizeKb] = useState(0);
  const [fileFormat, setFileFormat] = useState<'PDF' | 'EPUB'>('PDF');
  const [sections, setSections] = useState<UploadedBibleSection[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [rawContentText, setRawContentText] = useState('');
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | undefined>(undefined);
  const [parsing, setParsing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFormatTab('PDF_EPUB');
      setTranslation('KJV');
      setTitle('KJV Youth Study Edition');
      setFileName('');
      setFileSizeKb(0);
      setFileFormat('PDF');
      setSections([]);
      setPageCount(0);
      setRawContentText('');
      setPdfBytes(undefined);
      setErrorMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setParsing(true);
    try {
      setFileName(file.name);
      setFileSizeKb(Math.max(1, Math.round(file.size / 1024)));
      setFileFormat(file.name.toLowerCase().endsWith('.epub') ? 'EPUB' : 'PDF');
      const parsed = await parseDocumentFile(file);
      setTitle(parsed.title || file.name);
      setSections(parsed.sections);
      setPageCount(parsed.pageOrChapterCount);
      setRawContentText(parsed.fullText);
      setPdfBytes(parsed.pdfBytes);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to parse selected Bible file.');
    } finally {
      setParsing(false);
    }
  };

  const handleFillSample = () => {
    if (formatTab === 'JSON') {
      setRawContentText(
        JSON.stringify(
          [
            {
              reference: 'Judges 6:12',
              book: 'Judges',
              chapter: 6,
              verse: 12,
              text: 'The LORD is with thee, thou mighty man of valour.',
              translation,
              theme: 'Courage & Boldness',
            },
            {
              reference: 'Daniel 11:32',
              book: 'Daniel',
              chapter: 11,
              verse: 32,
              text: 'But the people that do know their God shall be strong, and do exploits.',
              translation,
              theme: 'Exploits & Strength',
            },
          ],
          null,
          2
        )
      );
    } else {
      setRawContentText(
        `Judges 6:12 | The LORD is with thee, thou mighty man of valour. | ${translation} | Courage & Boldness\nDaniel 11:32 | But the people that do know their God shall be strong, and do exploits. | ${translation} | Exploits & Strength`
      );
    }
  };

  const handleSync66Book = async () => {
    setErrorMsg(null);
    setUploading(true);
    try {
      const verses = build66BookReferenceVerses(translation);
      const editionSections: UploadedBibleSection[] = [
        {
          title: `66-Book Canonical Index (${translation})`,
          content: verses.map((v) => `${v.reference} — ${v.text}`).join('\n'),
        },
      ];
      const res = await publishUploadedBibleEdition({
        title: `${translation} 66-Book Reference Bible`,
        translation,
        format: 'PDF',
        fileName: `${translation.toLowerCase().replace(/[^a-z0-9]/g, '')}-66books.pdf`,
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
        actionType: 'SYNC_BIBLE_66_BOOKS',
        target: translation,
        targetEntity: translation,
        details: `Synced 66-book reference pack (${res.chunkDocsCount} chunks)`,
      });
      onSuccess?.(`Synced 66-book ${translation} Reference Bible to Firestore.`);
      onClose();
    } catch (err) {
      setErrorMsg(formatActionErrorMessage(err, 'Unable to sync 66-book reference Bible.'));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg('Please enter an Edition Title.');
      return;
    }
    setErrorMsg(null);
    setUploading(true);
    try {
      const parsedVerses =
        formatTab === 'JSON'
          ? parseLineOrJsonBibleVerses(rawContentText, 'JSON', translation)
          : parseLineOrJsonBibleVerses(rawContentText, 'LINE', translation);

      const resolvedSections: UploadedBibleSection[] =
        sections.length > 0
          ? sections
          : [
              {
                title: `${translation} Passage Excerpt`,
                content:
                  rawContentText.trim() ||
                  `${title.trim()} (${translation}) synced to Fellowship Backend.`,
              },
            ];

      const publishResult = await publishUploadedBibleEdition({
        title: title.trim(),
        translation,
        format: fileFormat,
        fileName: fileName || `${translation.toLowerCase()}.${fileFormat.toLowerCase()}`,
        fileSizeKb: fileSizeKb || Math.max(1, Math.round(rawContentText.length / 1024)),
        sections: resolvedSections,
        pageOrChapterCount: pageCount || resolvedSections.length,
        verses: parsedVerses,
        uploadedBy: displayName,
        authorId: account.userId || account.id,
      });

      await saveBibleEditionOffline(
        {
          id: publishResult.docId,
          title: title.trim(),
          version: translation,
          translation,
          format: fileFormat,
          fileFormat,
          fileName: fileName || `${translation.toLowerCase()}.${fileFormat.toLowerCase()}`,
          fileSizeKb: fileSizeKb || Math.max(1, Math.round(rawContentText.length / 1024)),
          pageOrChapterCount: pageCount || resolvedSections.length,
          extractedVersesCount: parsedVerses.length,
          sections: resolvedSections,
          contentText: resolvedSections.map((s) => `${s.title}\n${s.content}`).join('\n\n'),
          uploadedBy: displayName,
          createdAt: Date.now(),
        },
        pdfBytes
      );

      await logAuditTrail({
        actorName: displayName,
        actorRole: account.role,
        action: 'UPLOAD_BIBLE_EDITION',
        actionType: 'UPLOAD_BIBLE_EDITION',
        target: title.trim(),
        targetEntity: title.trim(),
        details: `${translation} (${fileFormat}) • ${resolvedSections.length} sections`,
      });
      onSuccess?.(`Uploaded Bible edition '${title.trim()}' to Firestore.`);
      onClose();
    } catch (err) {
      setErrorMsg(formatActionErrorMessage(err, 'Unable to upload Bible edition.'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="games-upload-bible-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 sm:p-6 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg max-h-[90dvh] overflow-y-auto overscroll-contain rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-5 space-y-4 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#F59E0B]" />
            <h3 id="games-upload-bible-title" className="font-display text-base font-bold text-[#0F172A] dark:text-white">
              Upload Bible Database Edition
            </h3>
          </div>
          <button
            type="button"
            aria-label="Close bible upload dialog"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#64748B] hover:text-[#0F172A] dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="rounded-xl bg-[#FFF1F2] dark:bg-[#9F1239]/25 border border-[#E11D48]/40 px-3 py-2 text-xs font-semibold text-[#9F1239] dark:text-[#FECDD3]"
          >
            {errorMsg}
          </div>
        )}

        {/* 3 Import Tabs */}
        <div className="grid grid-cols-3 bg-[#F1F5F9] dark:bg-[#1F2937] rounded-xl p-1 gap-1">
          {(
            [
              { id: 'PDF_EPUB', label: 'PDF / EPUB' },
              { id: 'LINE', label: 'Line / Text' },
              { id: 'JSON', label: 'JSON' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFormatTab(t.id)}
              className={`min-h-[38px] rounded-lg text-xs font-bold transition-colors ${
                formatTab === t.id
                  ? 'bg-[#0F172A] dark:bg-[#E11D48] text-white'
                  : 'text-[#64748B] dark:text-[#94A3B8]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 7 Translation Selector Chips */}
        <div>
          <span className="block text-xs font-semibold mb-1.5 text-[#334155] dark:text-[#CBD5E1]">
            Translation
          </span>
          <div className="flex flex-wrap gap-1.5">
            {BIBLE_TRANSLATION_OPTIONS.map((tr) => (
              <button
                key={tr}
                type="button"
                onClick={() => setTranslation(tr)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border touch-manipulation ${
                  translation === tr
                    ? 'bg-[#F59E0B] text-[#0F172A] border-[#F59E0B]'
                    : 'bg-[#F8FAFC] dark:bg-[#1F2937] text-[#334155] dark:text-[#CBD5E1] border-[#E2E8F0] dark:border-[#374151]'
                }`}
              >
                {tr}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label
            htmlFor="games-bible-edition-title"
            className="block text-xs font-semibold mb-1 text-[#334155] dark:text-[#CBD5E1]"
          >
            Edition Title *
          </label>
          <input
            id="games-bible-edition-title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. KJV Youth Study Edition"
            className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm text-[#0F172A] dark:text-white"
          />
        </div>

        {formatTab === 'PDF_EPUB' ? (
          <div className="space-y-3">
            <label className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#64748B] hover:border-[#E11D48] p-4 text-center text-xs cursor-pointer">
              <Upload className="w-5 h-5 text-[#E11D48]" />
              <span className="font-bold text-[#E11D48]">
                {parsing
                  ? 'Extracting PDF/EPUB chapters & verses...'
                  : fileName || 'Choose .pdf or .epub Bible file'}
              </span>
              {sections.length > 0 && (
                <span className="text-[11px] text-[#10B981] font-semibold">
                  Extracted {sections.length} sections ({pageCount} pages/chapters)
                </span>
              )}
              <input
                type="file"
                accept=".pdf,.epub,.txt,application/pdf,application/epub+zip,text/plain"
                onChange={handleFilePick}
                className="hidden"
              />
            </label>
            <textarea
              rows={3}
              value={rawContentText}
              onChange={(e) => setRawContentText(e.target.value)}
              placeholder="Optional excerpt or extracted text preview..."
              className="w-full p-3 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-xs text-[#0F172A] dark:text-white"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#334155] dark:text-[#CBD5E1]">
                {formatTab === 'JSON'
                  ? 'JSON Verses Array'
                  : 'Format: Reference | Verse Text | Translation | Theme'}
              </span>
              <button
                type="button"
                onClick={handleFillSample}
                className="text-xs font-bold text-[#E11D48] hover:underline"
              >
                Fill Sample Data
              </button>
            </div>
            <textarea
              rows={5}
              value={rawContentText}
              onChange={(e) => setRawContentText(e.target.value)}
              placeholder={
                formatTab === 'JSON'
                  ? '[{"reference":"Judges 6:12","text":"...","translation":"KJV","theme":"Courage & Boldness"}]'
                  : 'Judges 6:12 | The LORD is with thee, thou mighty man of valour. | KJV | Courage & Boldness'
              }
              className="w-full p-3 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-xs font-mono text-[#0F172A] dark:text-white"
            />
          </div>
        )}

        <button
          type="button"
          disabled={uploading}
          onClick={handleSync66Book}
          className="w-full min-h-[42px] rounded-xl bg-[#FEF3C7] dark:bg-[#F59E0B]/20 border border-[#F59E0B]/60 text-[#92400E] dark:text-[#FEF3C7] text-xs font-bold"
        >
          Sync 66-Book Reference Bible ({translation})
        </button>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-w-[110px] min-h-[44px] rounded-xl bg-[#F1F5F9] dark:bg-[#1F2937] text-[#0F172A] dark:text-white text-xs font-bold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={uploading || parsing}
            className="flex-1 min-w-[140px] min-h-[44px] rounded-xl bg-[#0F172A] dark:bg-[#E11D48] text-white text-sm font-bold disabled:opacity-60"
          >
            {uploading ? 'Syncing...' : 'Upload & Sync Edition'}
          </button>
        </div>
      </form>
    </div>
  );
};
