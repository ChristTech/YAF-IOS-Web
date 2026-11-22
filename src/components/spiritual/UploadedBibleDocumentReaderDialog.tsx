import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Search,
  Upload,
  X,
} from 'lucide-react';
import { renderPdfPageToCanvas } from '../../utils/documentParser';
import {
  loadPdfBinaryForBibleDoc,
  savePdfBinaryForBibleDoc,
} from '../../utils/offlineStorage';
import { extractVersesFromBibleDoc } from '../../utils/spiritualLogic';
import type { BibleVerseItem } from '../../data/bibleData';
import type { UploadedBibleDoc } from '../../types/fellowship';

export interface PickedBibleVerse extends BibleVerseItem {
  translation?: string;
}

interface UploadedBibleDocumentReaderDialogProps {
  document: UploadedBibleDoc | null;
  onClose: () => void;
  pickerMode?: boolean;
  onPickVerse?: (verse: PickedBibleVerse) => void;
}

export const UploadedBibleDocumentReaderDialog: React.FC<
  UploadedBibleDocumentReaderDialogProps
> = ({ document: docItem, onClose, pickerMode = false, onPickVerse }) => {
  const [viewMode, setViewMode] = useState<'chapters' | 'pdf'>('chapters');
  const [chapterSearch, setChapterSearch] = useState('');
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [pdfRenderError, setPdfRenderError] = useState<string | null>(null);
  const [renderingPdf, setRenderingPdf] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!docItem) return;
    setChapterSearch('');
    setCurrentPage(1);
    setNumPages(docItem.pageOrChapterCount || 1);
    setPdfRenderError(null);
    setViewMode('chapters');

    let cancelled = false;
    void loadPdfBinaryForBibleDoc(docItem.id).then((bytes) => {
      if (!cancelled) {
        setPdfBytes(bytes);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [docItem?.id]);

  useEffect(() => {
    if (viewMode !== 'pdf' || !pdfBytes || !canvasRef.current) return;
    let cancelled = false;
    setRenderingPdf(true);
    setPdfRenderError(null);

    const width = Math.min(760, Math.max(300, (containerRef.current?.clientWidth || 640) - 24));
    void renderPdfPageToCanvas(pdfBytes, currentPage, canvasRef.current, width)
      .then((res) => {
        if (!cancelled) {
          setNumPages(res.numPages);
          setCurrentPage(res.currentPage);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPdfRenderError(
            err instanceof Error ? err.message : 'Unable to render PDF page.'
          );
        }
      })
      .finally(() => {
        if (!cancelled) setRenderingPdf(false);
      });

    return () => {
      cancelled = true;
    };
  }, [viewMode, pdfBytes, currentPage]);

  const sections = useMemo(() => {
    if (!docItem) return [];
    const base =
      docItem.sections && docItem.sections.length > 0
        ? docItem.sections
        : [{ title: 'Edition Content', content: docItem.contentText }];
    const q = chapterSearch.trim().toLowerCase();
    if (!q) return base;
    return base.filter(
      (s) =>
        s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q)
    );
  }, [docItem, chapterSearch]);

  const extractedVerses = useMemo(() => {
    if (!docItem) return [];
    const list = extractVersesFromBibleDoc(docItem);
    const q = chapterSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (v) =>
        v.reference.toLowerCase().includes(q) || v.text.toLowerCase().includes(q)
    );
  }, [docItem, chapterSearch]);

  useEffect(() => {
    if (!docItem) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [docItem, onClose]);

  if (!docItem) return null;

  const editionTranslation = docItem.translation || docItem.version || 'KJV';

  const handleAttachLocalPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      setPdfBytes(bytes);
      setCurrentPage(1);
      setViewMode('pdf');
      await savePdfBinaryForBibleDoc(docItem.id, file.name, bytes);
    } catch {
      setPdfRenderError('Could not load local PDF file for canvas rendering.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bible-doc-reader-title"
      className="fixed inset-0 z-50 bg-white dark:bg-[#0B0F19] text-[#0F172A] dark:text-[#F8FAFC] flex flex-col min-h-[100dvh]"
    >
      {/* Header with iOS safe top padding */}
      <div className="bg-[#0F172A] text-white pt-[env(safe-area-inset-top)] px-4 sm:px-6 border-b border-[#1E293B] shrink-0">
        <div className="h-16 flex items-center justify-between gap-3 max-w-3xl mx-auto">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#F59E0B]/20 border border-[#F59E0B]/40 flex items-center justify-center shrink-0">
              <BookOpen className="w-4 h-4 text-[#F59E0B]" />
            </div>
            <div className="min-w-0">
              <h2 id="bible-doc-reader-title" className="text-sm sm:text-base font-bold truncate">
                {docItem.title}
              </h2>
              <p className="text-[11px] text-[#94A3B8] truncate">
                {editionTranslation} · {docItem.fileFormat || docItem.format} ·{' '}
                {docItem.pageOrChapterCount || sections.length || 1}{' '}
                {docItem.format === 'PDF' ? 'Pages' : 'Sections'}
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Close Bible reader"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#94A3B8] hover:text-white hover:bg-[#1E293B] shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Reader Mode Switcher */}
        <div className="max-w-3xl mx-auto pb-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode('chapters')}
            className={`min-h-[38px] px-3.5 rounded-xl text-xs font-bold transition-colors ${
              viewMode === 'chapters'
                ? 'bg-[#E11D48] text-white'
                : 'bg-[#1E293B] text-[#CBD5E1]'
            }`}
          >
            Searchable Chapters &amp; Verses
          </button>

          {pdfBytes ? (
            <button
              type="button"
              onClick={() => setViewMode('pdf')}
              className={`min-h-[38px] px-3.5 rounded-xl text-xs font-bold transition-colors ${
                viewMode === 'pdf'
                  ? 'bg-[#F59E0B] text-[#0F172A]'
                  : 'bg-[#1E293B] text-[#CBD5E1]'
              }`}
            >
              PDF Page Viewer ({numPages} Pages)
            </button>
          ) : (
            docItem.format === 'PDF' && (
              <label className="min-h-[38px] px-3.5 rounded-xl bg-[#1E293B] hover:bg-[#334155] text-[#FCD34D] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>Load Local PDF Pages</span>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleAttachLocalPdf}
                  className="hidden"
                />
              </label>
            )
          )}
        </div>
      </div>

      {/* Body */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 max-w-3xl w-full mx-auto space-y-4 pb-[calc(2rem+env(safe-area-inset-bottom))]"
      >
        {viewMode === 'pdf' && pdfBytes ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 rounded-xl bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-2.5">
              <button
                type="button"
                disabled={currentPage <= 1 || renderingPdf}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="min-h-[44px] px-4 rounded-xl bg-white dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-xs font-bold inline-flex items-center gap-1 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Prev</span>
              </button>
              <span className="text-xs font-bold font-mono tabular-nums">
                Page {currentPage} of {numPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= numPages || renderingPdf}
                onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                className="min-h-[44px] px-4 rounded-xl bg-white dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-xs font-bold inline-flex items-center gap-1 disabled:opacity-40"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {pdfRenderError && (
              <div
                role="alert"
                className="rounded-xl bg-[#FFF1F2] dark:bg-[#9F1239]/25 border border-[#E11D48]/40 px-3 py-2 text-xs font-semibold text-[#9F1239] dark:text-[#FECDD3]"
              >
                {pdfRenderError}
              </div>
            )}

            <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#374151] bg-[#F1F5F9] dark:bg-[#111827] p-3 flex justify-center overflow-x-auto">
              <canvas
                ref={canvasRef}
                aria-label={`PDF page ${currentPage} of ${numPages}`}
                className="max-w-full rounded-lg shadow-sm bg-white"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={chapterSearch}
                onChange={(e) => setChapterSearch(e.target.value)}
                placeholder="Search inside chapters or verses..."
                className="w-full min-h-[44px] pl-10 pr-10 rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] text-sm"
              />
              {chapterSearch && (
                <button
                  type="button"
                  aria-label="Clear chapter search"
                  onClick={() => setChapterSearch('')}
                  className="min-w-[40px] min-h-[40px] absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center text-[#64748B]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {pickerMode && onPickVerse && extractedVerses.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                  Extracted Verses ({extractedVerses.length})
                </h3>
                <div className="space-y-2">
                  {extractedVerses.slice(0, 40).map((verseItem) => (
                    <div
                      key={verseItem.id}
                      className="rounded-xl bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-[#E11D48]">
                          {verseItem.reference} • {editionTranslation}
                        </p>
                        <p className="text-sm text-[#0F172A] dark:text-[#F8FAFC] mt-0.5">
                          {verseItem.text}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onPickVerse({ ...verseItem, translation: editionTranslation })
                        }
                        className="min-h-[38px] px-3.5 rounded-xl bg-[#E11D48] text-white text-xs font-bold shrink-0 touch-manipulation"
                      >
                        Use Verse
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sections.length === 0 ? (
              <div className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-8 text-center text-sm text-[#64748B]">
                No chapters matched “{chapterSearch}”.
              </div>
            ) : (
              sections.map((sec, idx) => (
                <article
                  key={`${sec.title}-${idx}`}
                  className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-4 sm:p-5 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-extrabold text-[#E11D48]">
                      <FileText className="w-4 h-4 shrink-0" />
                      <span>{sec.title}</span>
                    </div>
                    {pickerMode && onPickVerse && (
                      <button
                        type="button"
                        onClick={() =>
                          onPickVerse({
                            id: `${docItem.id}-sec-${idx}`,
                            testament: 'Old Testament',
                            book: sec.title.split(' ')[0] || 'Scripture',
                            chapter: 1,
                            verse: 1,
                            reference: sec.title,
                            text: sec.content.slice(0, 260),
                            theme: docItem.title,
                            translation: editionTranslation,
                          })
                        }
                        className="min-h-[34px] px-3 rounded-lg bg-[#E11D48] text-white text-xs font-bold touch-manipulation"
                      >
                        Use Verse
                      </button>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-[#334155] dark:text-[#E2E8F0]">
                    {sec.content}
                  </p>
                </article>
              ))
            )}

            {docItem.fileDataUrl && (
              <a
                href={docItem.fileDataUrl}
                download={docItem.fileName}
                className="min-h-[44px] px-4 rounded-xl bg-[#E11D48] text-white text-xs font-bold inline-flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                <span>Download {docItem.fileName}</span>
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
