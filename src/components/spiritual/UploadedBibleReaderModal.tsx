import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { BookOpen, ChevronLeft, ChevronRight, Download, FileText, Search, X } from 'lucide-react';
import { getPdfBinary } from '../../utils/offlineStorage';
import { extractVersesFromBibleDoc } from '../../utils/spiritualLogic';
import type { BibleVerseItem } from '../../data/bibleData';
import type { UploadedBibleDoc } from '../../types/fellowship';

if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

interface UploadedBibleReaderModalProps {
  isOpen: boolean;
  doc: UploadedBibleDoc | null;
  onClose: () => void;
  pickerMode?: boolean;
  onPickVerse?: (verse: BibleVerseItem) => void;
}

export const UploadedBibleReaderModal: React.FC<UploadedBibleReaderModalProps> = ({
  isOpen,
  doc,
  onClose,
  pickerMode = false,
  onPickVerse,
}) => {
  const [readerTab, setReaderTab] = useState<'chapters' | 'pdf'>('chapters');
  const [chapterQuery, setChapterQuery] = useState('');
  const [selectedSectionIdx, setSelectedSectionIdx] = useState(0);

  // iOS Safari Multi-Page PDF Canvas Renderer State
  const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pdfNumPages, setPdfNumPages] = useState(0);
  const [pdfPage, setPdfPage] = useState(1);
  const [pdfRendering, setPdfRendering] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!isOpen || !doc) {
      setPdfBuffer(null);
      setPdfDoc(null);
      setPdfNumPages(0);
      setPdfPage(1);
      setReaderTab('chapters');
      setChapterQuery('');
      setSelectedSectionIdx(0);
      setPdfError(null);
      return;
    }

    let cancelled = false;
    setReaderTab('chapters');
    setSelectedSectionIdx(0);
    setChapterQuery('');
    setPdfError(null);

    if ((doc.fileFormat || doc.format) === 'PDF') {
      void getPdfBinary(doc.id).then((buf) => {
        if (!cancelled && buf) {
          setPdfBuffer(buf);
        }
      });
    } else {
      setPdfBuffer(null);
    }

    return () => {
      cancelled = true;
    };
  }, [isOpen, doc]);

  // Load PDFDocumentProxy when user switches to PDF Page Viewer tab or buffer is ready
  useEffect(() => {
    if (!isOpen || !pdfBuffer || readerTab !== 'pdf') return;
    let cancelled = false;
    setPdfError(null);

    const task = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer.slice(0)) });
    task.promise
      .then((loadedPdf) => {
        if (cancelled) return;
        setPdfDoc(loadedPdf);
        setPdfNumPages(loadedPdf.numPages || 1);
        setPdfPage(1);
      })
      .catch((err) => {
        if (cancelled) return;
        setPdfError(err instanceof Error ? err.message : 'Unable to render PDF pages.');
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, pdfBuffer, readerTab]);

  // Render active page onto high-DPI <canvas>
  useEffect(() => {
    if (!pdfDoc || readerTab !== 'pdf') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    setPdfRendering(true);

    pdfDoc
      .getPage(pdfPage)
      .then(async (page) => {
        if (cancelled) return;
        const containerWidth = canvas.parentElement?.clientWidth || 640;
        const baseViewport = page.getViewport({ scale: 1 });
        const fitScale = Math.max(0.7, Math.min(2.2, (containerWidth - 16) / baseViewport.width));
        const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
        const viewport = page.getViewport({ scale: fitScale * dpr });

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
        canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
      })
      .catch((err) => {
        if (!cancelled) {
          setPdfError(err instanceof Error ? err.message : 'Unable to draw PDF page.');
        }
      })
      .finally(() => {
        if (!cancelled) setPdfRendering(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pdfDoc, pdfPage, readerTab]);

  const sections = useMemo(() => {
    if (!doc) return [];
    if (doc.sections && doc.sections.length > 0) return doc.sections;
    return [
      {
        title: doc.title || 'Full Document',
        content: doc.contentText || 'Uploaded Bible document ready for reading.',
      },
    ];
  }, [doc]);

  const filteredSections = useMemo(() => {
    const q = chapterQuery.trim().toLowerCase();
    if (!q) return sections.map((sec, idx) => ({ ...sec, origIdx: idx }));
    return sections
      .map((sec, idx) => ({ ...sec, origIdx: idx }))
      .filter(
        (sec) =>
          sec.title.toLowerCase().includes(q) || sec.content.toLowerCase().includes(q)
      );
  }, [sections, chapterQuery]);

  const activeSection =
    filteredSections[selectedSectionIdx] || filteredSections[0] || null;

  const extractedVerses = useMemo(() => {
    if (!doc) return [];
    const verses = extractVersesFromBibleDoc(doc);
    const q = chapterQuery.trim().toLowerCase();
    if (!q) return verses;
    return verses.filter(
      (v) =>
        v.reference.toLowerCase().includes(q) || v.text.toLowerCase().includes(q)
    );
  }, [doc, chapterQuery]);

  if (!isOpen || !doc) return null;

  const formatLabel = doc.fileFormat || doc.format || 'PDF';
  const translationLabel = doc.translation || doc.version || 'KJV';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="uploaded-bible-reader-title"
      className="fixed inset-0 z-50 bg-white dark:bg-[#0B0F19] text-[#0F172A] dark:text-[#F8FAFC] flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
    >
      {/* #0F172A Reader Header */}
      <header className="bg-[#0F172A] text-white px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3 border-b border-[#1E293B]">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#1E293B] border border-[#F59E0B]/40 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5 text-[#F59E0B]" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold tracking-wider text-[#F59E0B] uppercase">
              {formatLabel} &bull; {translationLabel}
            </p>
            <h2
              id="uploaded-bible-reader-title"
              className="font-display text-sm sm:text-base font-bold truncate"
            >
              {doc.title}
            </h2>
            <p className="text-[11px] text-[#94A3B8] truncate">
              Uploaded by {doc.uploadedBy} &bull;{' '}
              {doc.pageOrChapterCount || sections.length} chapters/pages
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-label="Close Bible reader"
          onClick={onClose}
          className="min-h-[44px] min-w-[44px] rounded-xl hover:bg-[#1E293B] flex items-center justify-center text-[#94A3B8] hover:text-white shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Optional Dual-Mode Switcher when PDF Binary is Cached */}
      {pdfBuffer && (
        <div className="px-4 py-2.5 bg-[#F8FAFC] dark:bg-[#111827] border-b border-[#E2E8F0] dark:border-[#374151]">
          <div className="max-w-3xl mx-auto grid grid-cols-2 bg-[#E2E8F0]/70 dark:bg-[#1F2937] rounded-xl p-1 gap-1">
            <button
              type="button"
              onClick={() => setReaderTab('chapters')}
              className={`min-h-[38px] rounded-lg text-xs font-bold transition-colors ${
                readerTab === 'chapters'
                  ? 'bg-[#0F172A] dark:bg-[#E11D48] text-white'
                  : 'text-[#64748B] dark:text-[#94A3B8]'
              }`}
            >
              Searchable Scripture Chapters
            </button>
            <button
              type="button"
              onClick={() => setReaderTab('pdf')}
              className={`min-h-[38px] rounded-lg text-xs font-bold transition-colors ${
                readerTab === 'pdf'
                  ? 'bg-[#0F172A] dark:bg-[#E11D48] text-white'
                  : 'text-[#64748B] dark:text-[#94A3B8]'
              }`}
            >
              PDF Page Viewer ({pdfNumPages || doc.pageOrChapterCount || 1} Pages)
            </button>
          </div>
        </div>
      )}

      {readerTab === 'pdf' && pdfBuffer ? (
        <div className="flex-1 overflow-y-auto bg-[#F1F5F9] dark:bg-[#0B0F19] p-4">
          <div className="max-w-3xl mx-auto space-y-3">
            {/* Prev / Page X of Y / Next Controls */}
            <div className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] px-4 py-2.5 flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={pdfPage <= 1 || pdfRendering}
                onClick={() => setPdfPage((p) => Math.max(1, p - 1))}
                className="min-h-[40px] px-3 rounded-xl bg-[#F1F5F9] dark:bg-[#1F2937] text-xs font-bold inline-flex items-center gap-1 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Prev</span>
              </button>
              <span className="text-xs font-bold tabular-nums text-[#0F172A] dark:text-white">
                Page {pdfPage} of {pdfNumPages || doc.pageOrChapterCount || 1}
              </span>
              <button
                type="button"
                disabled={pdfPage >= (pdfNumPages || 1) || pdfRendering}
                onClick={() => setPdfPage((p) => Math.min(pdfNumPages || 1, p + 1))}
                className="min-h-[40px] px-3 rounded-xl bg-[#0F172A] dark:bg-[#E11D48] text-white text-xs font-bold inline-flex items-center gap-1 disabled:opacity-40"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {pdfError ? (
              <div className="rounded-2xl bg-[#FFF1F2] dark:bg-[#9F1239]/20 border border-[#E11D48]/40 p-6 text-center text-xs font-semibold text-[#9F1239] dark:text-[#FECDD3]">
                {pdfError}
              </div>
            ) : (
              <div className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-2 flex flex-col items-center overflow-x-auto">
                <canvas ref={canvasRef} className="rounded-lg max-w-full h-auto" />
                {pdfRendering && (
                  <p className="text-xs text-[#64748B] py-2">Rendering PDF page...</p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-3xl mx-auto space-y-4">
            {/* Chapter Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={chapterQuery}
                onChange={(e) => {
                  setChapterQuery(e.target.value);
                  setSelectedSectionIdx(0);
                }}
                placeholder="Search chapters, books, or verses inside this edition..."
                className="w-full min-h-[44px] pl-10 pr-10 rounded-xl bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] text-sm focus:outline-none focus:ring-2 focus:ring-[#E11D48]"
              />
              {chapterQuery && (
                <button
                  type="button"
                  aria-label="Clear chapter search"
                  onClick={() => {
                    setChapterQuery('');
                    setSelectedSectionIdx(0);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-[#64748B]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Chapter / Section Navigation Chips */}
            {filteredSections.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {filteredSections.map((sec, idx) => (
                  <button
                    key={`${sec.origIdx}-${sec.title}`}
                    type="button"
                    onClick={() => setSelectedSectionIdx(idx)}
                    className={`min-h-[38px] px-3.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 transition-colors border ${
                      selectedSectionIdx === idx
                        ? 'bg-[#E11D48] text-white border-[#E11D48]'
                        : 'bg-[#F8FAFC] dark:bg-[#1F2937] text-[#334155] dark:text-[#CBD5E1] border-[#E2E8F0] dark:border-[#374151]'
                    }`}
                  >
                    {sec.title}
                  </button>
                ))}
              </div>
            )}

            {/* Active Chapter Content */}
            {activeSection ? (
              <article className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-5 space-y-3 shadow-sm">
                <div className="flex items-center justify-between gap-2 border-b border-[#E2E8F0] dark:border-[#374151] pb-2.5">
                  <h3 className="text-sm font-extrabold text-[#E11D48] uppercase tracking-wide">
                    {activeSection.title}
                  </h3>
                  <span className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8]">
                    {translationLabel}
                  </span>
                </div>
                <div className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap text-[#1E293B] dark:text-[#E2E8F0]">
                  {activeSection.content}
                </div>
              </article>
            ) : (
              <div className="rounded-2xl bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-8 text-center text-sm text-[#64748B]">
                No chapters match "{chapterQuery}".
              </div>
            )}

            {/* Extracted Verses Cards (Game/Quiz Verse Picker OR Quick Reference) */}
            {extractedVerses.length > 0 && (
              <section className="rounded-2xl bg-[#F8FAFC] dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-4 space-y-2.5">
                <p className="text-[11px] font-extrabold tracking-wider text-[#64748B] dark:text-[#94A3B8] uppercase">
                  {pickerMode
                    ? 'TAP A VERSE FROM THIS CHAPTER TO USE IN GAME / QUIZ:'
                    : `EXTRACTED SCRIPTURE REFERENCES (${extractedVerses.length}):`}
                </p>
                <div className="space-y-2">
                  {extractedVerses.slice(0, 20).map((verse) => (
                    <div
                      key={verse.id}
                      className="rounded-xl bg-white dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] p-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-[#E11D48]">
                          {verse.reference}
                        </p>
                        <p className="text-xs sm:text-sm text-[#334155] dark:text-[#E2E8F0] mt-0.5 leading-snug">
                          {verse.text}
                        </p>
                      </div>
                      {pickerMode && onPickVerse && (
                        <button
                          type="button"
                          onClick={() => {
                            onPickVerse(verse);
                            onClose();
                          }}
                          className="min-h-[38px] px-3 rounded-xl bg-[#0F172A] dark:bg-[#E11D48] text-white text-xs font-bold shrink-0"
                        >
                          Use Verse
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {doc.fileDataUrl && (
              <div>
                <a
                  href={doc.fileDataUrl}
                  download={doc.fileName}
                  className="inline-flex items-center gap-2 min-h-[44px] px-4 rounded-xl bg-[#0F172A] dark:bg-[#E11D48] text-white text-xs font-bold"
                >
                  <Download className="w-4 h-4" />
                  <FileText className="w-4 h-4" />
                  <span>Download Original {formatLabel}</span>
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
