import React, { useEffect, useState } from 'react';
import { BookOpen, Download, FileText, Radio, Send, Upload, X } from 'lucide-react';
import {
  createNotification,
  logAuditTrail,
  publishDailyScripture,
  publishSpiritualResource,
  publishUploadedBibleEdition,
} from '../../services/fellowshipService';
import { build66BookReferenceVerses, parseDocumentFile } from '../../utils/documentParser';
import {
  DEFAULT_MINISTRY_AUTHOR,
  formatActionErrorMessage,
  getDisplayNameForAccount,
  parseLineOrJsonBibleVerses,
} from '../../utils/fellowshipLogic';
import { saveBibleEditionOffline } from '../../utils/offlineStorage';
import type { FellowshipAccount, UploadedBibleSection } from '../../types/fellowship';

export type PublishCategory =
  | 'SCRIPTURE_OF_THE_DAY'
  | 'SERMON'
  | 'DEVOTIONAL'
  | 'BIBLE_STUDY'
  | 'PRAYER_POINTS';

interface PublishResourceDialogProps {
  isOpen: boolean;
  initialCategory?: PublishCategory;
  account: FellowshipAccount;
  onClose: () => void;
  onSuccess: (statusMessage: string) => void;
}

const PUBLISH_CATEGORIES: { value: PublishCategory; label: string }[] = [
  { value: 'SCRIPTURE_OF_THE_DAY', label: 'Scripture of the Day' },
  { value: 'SERMON', label: 'Sermon' },
  { value: 'DEVOTIONAL', label: 'Devotional' },
  { value: 'BIBLE_STUDY', label: 'Bible Study' },
  { value: 'PRAYER_POINTS', label: 'Prayer Points' },
];

export const PublishResourceDialog: React.FC<PublishResourceDialogProps> = ({
  isOpen,
  initialCategory = 'SERMON',
  account,
  onClose,
  onSuccess,
}) => {
  const displayName = getDisplayNameForAccount(account);
  const [category, setCategory] = useState<PublishCategory>(initialCategory);
  const [title, setTitle] = useState('');
  const [speaker, setSpeaker] = useState('');
  const [scriptureRef, setScriptureRef] = useState('');
  const [summary, setSummary] = useState('');
  const [body, setBody] = useState('');
  const [audioDuration, setAudioDuration] = useState('25');
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCategory(initialCategory);
      setTitle('');
      setSpeaker('');
      setScriptureRef('');
      setSummary('');
      setBody('');
      setAudioDuration('25');
      setErrorMsg(null);
    }
  }, [isOpen, initialCategory]);

  if (!isOpen) return null;

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setImporting(true);
    try {
      const parsed = await parseDocumentFile(file);
      if (!title.trim()) setTitle(parsed.title);
      if (parsed.fullText.trim()) {
        setBody(parsed.fullText.trim());
      } else {
        setErrorMsg('No readable text could be extracted from this file.');
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Unable to parse selected file.'
      );
    } finally {
      setImporting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (category === 'SCRIPTURE_OF_THE_DAY') {
      if (!scriptureRef.trim() || !body.trim()) {
        setErrorMsg('Scripture reference and verse text are required.');
        return;
      }
    } else if (!title.trim() || !body.trim()) {
      setErrorMsg('Title and body content are required.');
      return;
    }

    setErrorMsg(null);
    setSaving(true);
    try {
      if (category === 'SCRIPTURE_OF_THE_DAY') {
        await publishDailyScripture({
          authorId: account.userId || account.id,
          authorName: speaker.trim() || DEFAULT_MINISTRY_AUTHOR,
          referenceEn: scriptureRef.trim(),
          verseTextEn: body.trim(),
          chargeText: summary.trim() || 'Rise as mighty Gideonites today and do Kingdom exploits!',
        });
        await logAuditTrail({
          actorName: displayName,
          actorRole: account.role,
          action: 'PUBLISH_DAILY_SCRIPTURE',
          actionType: 'PUBLISH_DAILY_SCRIPTURE',
          target: scriptureRef.trim(),
          targetEntity: scriptureRef.trim(),
          details: `Published Scripture of the Day (${scriptureRef.trim()})`,
        });
        onSuccess(`Published Scripture for the Day (${scriptureRef.trim()}).`);
      } else {
        const mins = category === 'SERMON' ? Math.max(0, Number(audioDuration) || 0) : 0;
        await publishSpiritualResource({
          authorId: account.userId || account.id,
          kind: category,
          title: title.trim(),
          speaker: speaker.trim() || DEFAULT_MINISTRY_AUTHOR,
          scriptureRef: scriptureRef.trim() || 'Judges 6:12',
          duration: category === 'SERMON' && mins > 0 ? `${mins} min audio` : '5 min read',
          audioDurationMinutes: mins || undefined,
          summary: summary.trim() || undefined,
          body: body.trim(),
        });
        await logAuditTrail({
          actorName: displayName,
          actorRole: account.role,
          action: `PUBLISH_${category}`,
          actionType: `PUBLISH_${category}`,
          target: title.trim(),
          targetEntity: title.trim(),
          details: `Published ${category.replace('_', ' ')}: ${title.trim()}`,
        });
        onSuccess(`'${title.trim()}' published live to Spiritual Library.`);
      }
      onClose();
    } catch (err) {
      setErrorMsg(formatActionErrorMessage(err, 'Unable to publish resource.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="publish-resource-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-5 space-y-4 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#E11D48]" />
            <h3 id="publish-resource-dialog-title" className="font-display text-base font-bold">
              Publish Spiritual Resource
            </h3>
          </div>
          <button
            type="button"
            aria-label="Close publish resource dialog"
            onClick={onClose}
            className="p-2 text-[#64748B] hover:text-[#0F172A] dark:hover:text-white"
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

        {/* Category Chips */}
        <div className="flex flex-wrap gap-1.5">
          {PUBLISH_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setCategory(cat.value)}
              className={`min-h-[34px] px-3 rounded-lg text-xs font-bold border ${
                category === cat.value
                  ? 'bg-[#E11D48] text-white border-[#E11D48]'
                  : 'bg-[#F8FAFC] dark:bg-[#1F2937] text-[#334155] dark:text-[#CBD5E1] border-[#E2E8F0] dark:border-[#374151]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {category !== 'SCRIPTURE_OF_THE_DAY' && (
          <label className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#64748B] hover:border-[#E11D48] p-3 text-xs font-bold text-[#E11D48] cursor-pointer">
            <Upload className="w-4 h-4" />
            <span>
              {importing
                ? 'Extracting text from file...'
                : 'Import Sermon / Devotional from File (.pdf / .epub / .txt)'}
            </span>
            <input
              type="file"
              accept=".pdf,.epub,.txt,.csv,.json,application/pdf,application/epub+zip,text/plain,text/csv,application/json"
              onChange={handleImportFile}
              className="hidden"
            />
          </label>
        )}

        {category !== 'SCRIPTURE_OF_THE_DAY' && (
          <div>
            <label htmlFor="pub-res-title" className="block text-xs font-semibold mb-1">
              Title *
            </label>
            <input
              id="pub-res-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Walking in the Spirit"
              className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm"
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="pub-res-ref" className="block text-xs font-semibold mb-1">
              Scripture Reference {category === 'SCRIPTURE_OF_THE_DAY' ? '*' : ''}
            </label>
            <input
              id="pub-res-ref"
              type="text"
              value={scriptureRef}
              onChange={(e) => setScriptureRef(e.target.value)}
              placeholder="e.g. Judges 6:12"
              className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm"
            />
          </div>
          {category === 'SERMON' ? (
            <div>
              <label htmlFor="pub-res-duration" className="block text-xs font-semibold mb-1">
                Audio Duration (minutes)
              </label>
              <input
                id="pub-res-duration"
                type="number"
                min={0}
                value={audioDuration}
                onChange={(e) => setAudioDuration(e.target.value)}
                className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm font-mono"
              />
            </div>
          ) : (
            <div>
              <label htmlFor="pub-res-speaker" className="block text-xs font-semibold mb-1">
                Speaker / Author
              </label>
              <input
                id="pub-res-speaker"
                type="text"
                value={speaker}
                onChange={(e) => setSpeaker(e.target.value)}
                placeholder={displayName}
                className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm"
              />
            </div>
          )}
        </div>

        {category === 'SERMON' && (
          <div>
            <label htmlFor="pub-sermon-speaker" className="block text-xs font-semibold mb-1">
              Minister / Preacher
            </label>
            <input
              id="pub-sermon-speaker"
              type="text"
              value={speaker}
              onChange={(e) => setSpeaker(e.target.value)}
              placeholder="e.g. Pastor Tunde Adeyemi"
              className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm"
            />
          </div>
        )}

        <div>
          <label htmlFor="pub-res-summary" className="block text-xs font-semibold mb-1">
            {category === 'SCRIPTURE_OF_THE_DAY' ? 'Gideonites Youth Charge' : 'Short Summary'}
          </label>
          <input
            id="pub-res-summary"
            type="text"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder={
              category === 'SCRIPTURE_OF_THE_DAY'
                ? 'Rise as mighty Gideonites today!'
                : 'Optional one-line takeaway...'
            }
            className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm"
          />
        </div>

        <div>
          <label htmlFor="pub-res-body" className="block text-xs font-semibold mb-1">
            {category === 'SCRIPTURE_OF_THE_DAY' ? 'Verse Text *' : 'Full Content / Transcript *'}
          </label>
          <textarea
            id="pub-res-body"
            rows={5}
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              category === 'SCRIPTURE_OF_THE_DAY'
                ? 'Enter full scripture verse text...'
                : 'Paste or type full sermon notes, devotional text, or prayer points...'
            }
            className="w-full p-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm"
          />
        </div>

        <div className="flex gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] rounded-xl bg-[#F1F5F9] dark:bg-[#1F2937] text-xs font-bold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || importing}
            className="flex-1 min-h-[44px] rounded-xl bg-[#E11D48] hover:bg-[#9F1239] text-white text-sm font-bold disabled:opacity-60"
          >
            {saving ? 'Publishing...' : 'Publish to Firestore'}
          </button>
        </div>
      </form>
    </div>
  );
};

interface UploadBibleDatabaseDialogProps {
  isOpen: boolean;
  account: FellowshipAccount;
  onClose: () => void;
  onSuccess: (statusMessage: string) => void;
}

const BIBLE_TRANSLATIONS = [
  'KJV',
  'NKJV',
  'NIV',
  'AMP',
  'Bibeli Mimo (YO)',
  'Littafi Mai Tsarki (HA)',
  'Baịbụl Nsọ (IG)',
] as const;

export const UploadBibleDatabaseDialog: React.FC<UploadBibleDatabaseDialogProps> = ({
  isOpen,
  account,
  onClose,
  onSuccess,
}) => {
  const displayName = getDisplayNameForAccount(account);
  const [formatTab, setFormatTab] = useState<'PDF_EPUB' | 'LINE' | 'JSON'>('PDF_EPUB');
  const [translation, setTranslation] = useState<string>('KJV');
  const [title, setTitle] = useState('King James Version (Study Edition)');
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
      setTitle('King James Version (Study Edition)');
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
              book: 'Judges',
              chapter: 6,
              verse: 12,
              text: 'And the angel of the LORD appeared unto him, and said unto him, The LORD is with thee, thou mighty man of valour.',
            },
            {
              book: 'Daniel',
              chapter: 11,
              verse: 32,
              text: 'But the people that do know their God shall be strong, and do exploits.',
            },
          ],
          null,
          2
        )
      );
    } else {
      setRawContentText(
        `Judges 6:12 | And the angel of the LORD appeared unto him, and said unto him, The LORD is with thee, thou mighty man of valour. | ${translation} | Courage & Boldness\nDaniel 11:32 | But the people that do know their God shall be strong, and do exploits. | ${translation} | Exploits & Strength`
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
      onSuccess(`Synced 66-book ${translation} Reference Bible to Firestore.`);
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
      onSuccess(`Uploaded Bible edition '${title.trim()}' to Firestore.`);
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
      aria-labelledby="upload-bible-db-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-safe-modal"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-5 space-y-4 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#F59E0B]" />
            <h3 id="upload-bible-db-title" className="font-display text-base font-bold">
              Upload Bible Database Edition
            </h3>
          </div>
          <button
            type="button"
            aria-label="Close bible upload dialog"
            onClick={onClose}
            className="p-2 text-[#64748B] hover:text-[#0F172A] dark:hover:text-white"
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

        {/* 3 Format Tabs */}
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
              className={`min-h-[36px] rounded-lg text-xs font-bold ${
                formatTab === t.id
                  ? 'bg-[#0F172A] dark:bg-[#E11D48] text-white'
                  : 'text-[#64748B] dark:text-[#94A3B8]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 7 Translation Chips */}
        <div>
          <span className="block text-xs font-semibold mb-1.5">Translation</span>
          <div className="flex flex-wrap gap-1.5">
            {BIBLE_TRANSLATIONS.map((tr) => (
              <button
                key={tr}
                type="button"
                onClick={() => setTranslation(tr)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border ${
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
          <label htmlFor="bible-edition-title" className="block text-xs font-semibold mb-1">
            Edition Title *
          </label>
          <input
            id="bible-edition-title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. KJV Youth Study Edition"
            className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm"
          />
        </div>

        {formatTab === 'PDF_EPUB' ? (
          <div className="space-y-3">
            <label className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#64748B] hover:border-[#E11D48] p-4 text-center text-xs cursor-pointer">
              <Upload className="w-5 h-5 text-[#E11D48]" />
              <span className="font-bold text-[#E11D48]">
                {parsing
                  ? 'Extracting PDF/EPUB chapters & verses...'
                  : fileName || 'Choose .pdf, .epub, or .txt Bible file'}
              </span>
              {sections.length > 0 && (
                <span className="text-[11px] text-[#10B981] font-semibold">
                  Extracted {sections.length} sections ({pageCount} pages/chapters)
                </span>
              )}
              <input
                type="file"
                accept=".pdf,.epub,.txt,.csv,.json,application/pdf,application/epub+zip,text/plain,text/csv,application/json"
                onChange={handleFilePick}
                className="hidden"
              />
            </label>
            <textarea
              rows={3}
              value={rawContentText}
              onChange={(e) => setRawContentText(e.target.value)}
              placeholder="Optional excerpt or extracted text preview..."
              className="w-full p-3 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-xs"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold">
                {formatTab === 'JSON' ? 'JSON Verses Array' : 'Line-by-Line Verses (Book C:V | Text)'}
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
                  ? '[{"book":"Judges","chapter":6,"verse":12,"text":"..."}]'
                  : 'Judges 6:12 | The LORD is with thee, thou mighty man of valour.'
              }
              className="w-full p-3 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-xs font-mono"
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

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[44px] rounded-xl bg-[#F1F5F9] dark:bg-[#1F2937] text-xs font-bold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={uploading || parsing}
            className="flex-1 min-h-[44px] rounded-xl bg-[#0F172A] dark:bg-[#E11D48] text-white text-sm font-bold disabled:opacity-60"
          >
            {uploading ? 'Syncing...' : 'Upload & Sync Edition'}
          </button>
        </div>
      </form>
    </div>
  );
};

interface DataExportPreviewDialogProps {
  isOpen: boolean;
  title: string;
  filename: string;
  csvContent: string;
  onClose: () => void;
  onDownloaded: () => void;
}

export const DataExportPreviewDialog: React.FC<DataExportPreviewDialogProps> = ({
  isOpen,
  title,
  filename,
  csvContent,
  onClose,
  onDownloaded,
}) => {
  if (!isOpen) return null;

  const handleDownload = () => {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onDownloaded();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="csv-export-preview-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 id="csv-export-preview-title" className="font-display text-base font-bold">
              {title}
            </h3>
            <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">{filename}</p>
          </div>
          <button
            type="button"
            aria-label="Close export preview"
            onClick={onClose}
            className="p-2 text-[#64748B] hover:text-[#0F172A] dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <pre className="rounded-xl bg-[#0F172A] text-[#4ADE80] font-mono text-[11px] leading-relaxed p-4 max-h-72 overflow-auto border border-[#1E293B]">
          {csvContent}
        </pre>

        <div className="flex justify-end gap-2.5">
          <button
            type="button"
            onClick={handleDownload}
            className="min-h-[42px] px-4 rounded-xl bg-[#E11D48] hover:bg-[#9F1239] text-white text-xs font-bold inline-flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            <span>Download .csv</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] px-5 rounded-xl bg-[#0F172A] dark:bg-[#1F2937] text-white text-xs font-bold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

interface SmsBroadcastDialogProps {
  isOpen: boolean;
  account: FellowshipAccount;
  accounts: FellowshipAccount[];
  onClose: () => void;
  onSuccess: (statusMessage: string) => void;
}

export const SmsBroadcastDialog: React.FC<SmsBroadcastDialogProps> = ({
  isOpen,
  account,
  accounts,
  onClose,
  onSuccess,
}) => {
  const displayName = getDisplayNameForAccount(account);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const phoneRecipientsCount = accounts.filter(
    (a) => Boolean((a.phone || a.phoneNumber || '').trim())
  ).length;

  useEffect(() => {
    if (isOpen) {
      setMessage('');
      setErrorMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setErrorMsg(null);
    setSending(true);
    try {
      await createNotification(
        {
          title: 'Emergency Fellowship SMS & Push Broadcast',
          message: message.trim().slice(0, 160),
          type: 'ANNOUNCEMENT',
          targetRole: 'ALL',
        },
        true
      );
      await logAuditTrail({
        actorName: displayName,
        actorRole: account.role,
        action: 'SMS_BROADCAST',
        actionType: 'SMS_BROADCAST',
        target: `${phoneRecipientsCount || accounts.length} recipients`,
        targetEntity: 'SMS_GATEWAY',
        details: message.trim().slice(0, 160),
      });
      onSuccess(
        `Emergency SMS broadcast queued for ${phoneRecipientsCount || accounts.length} active fellowship members.`
      );
      onClose();
    } catch (err) {
      setErrorMsg(formatActionErrorMessage(err, 'Unable to dispatch SMS broadcast.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sms-broadcast-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
    >
      <form
        onSubmit={handleSend}
        className="w-full max-w-md rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-5 space-y-4 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-[#E11D48]" />
            <h3 id="sms-broadcast-title" className="font-display text-base font-bold">
              Dispatch Emergency SMS Broadcast
            </h3>
          </div>
          <button
            type="button"
            aria-label="Close SMS broadcast dialog"
            onClick={onClose}
            className="p-2 text-[#64748B]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
          Targeting <strong>{phoneRecipientsCount || accounts.length}</strong> active member phone{' '}
          {(phoneRecipientsCount || accounts.length) === 1 ? 'number' : 'numbers'} in{' '}
          <strong>GIDEONITES</strong>.
        </p>

        {errorMsg && (
          <div
            role="alert"
            className="rounded-xl bg-[#FFF1F2] dark:bg-[#9F1239]/25 border border-[#E11D48]/40 px-3 py-2 text-xs font-semibold text-[#9F1239] dark:text-[#FECDD3]"
          >
            {errorMsg}
          </div>
        )}

        <div>
          <textarea
            rows={4}
            maxLength={160}
            required
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 160))}
            placeholder="Urgent fellowship notice..."
            className="w-full p-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm"
          />
          <p className="text-right text-[11px] font-mono text-[#64748B] dark:text-[#94A3B8] mt-1 tabular-nums">
            {message.length}/160 characters
          </p>
        </div>

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-[42px] rounded-xl bg-[#F1F5F9] dark:bg-[#1F2937] text-xs font-bold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={sending || !message.trim()}
            className="flex-1 min-h-[42px] rounded-xl bg-[#E11D48] hover:bg-[#9F1239] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{sending ? 'Sending...' : 'Send Broadcast'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
