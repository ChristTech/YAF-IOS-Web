/// <reference types="vite/client" />
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import JSZip from 'jszip';
import type { UploadedBibleSection } from '../types/fellowship';
export { build66BookReferenceVerses } from '../data/bibleData';

if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

export interface ParsedDocumentOutput {
  title: string;
  format: 'PDF' | 'EPUB' | 'TXT';
  sections: UploadedBibleSection[];
  pageOrChapterCount: number;
  extractedVersesCount: number;
  fullText: string;
  pdfBytes?: Uint8Array;
}

export async function renderPdfPageToCanvas(
  pdfBytes: Uint8Array,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  targetCssWidth = 680
): Promise<{ numPages: number; currentPage: number }> {
  const safeCopy = new Uint8Array(pdfBytes);
  const loadingTask = pdfjsLib.getDocument({ data: safeCopy });
  const pdf = await loadingTask.promise;
  const numPages = Math.max(1, pdf.numPages || 1);
  const clampedPage = Math.min(numPages, Math.max(1, pageNumber));
  const page = await pdf.getPage(clampedPage);
  const baseViewport = page.getViewport({ scale: 1 });
  const cssScale = Math.max(0.5, targetCssWidth / (baseViewport.width || 600));
  const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2.5) : 1;
  const viewport = page.getViewport({ scale: cssScale * dpr });

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
  canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable for PDF page rendering.');
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, canvas, viewport }).promise;
  return { numPages, currentPage: clampedPage };
}

const VERSE_LINE_REGEX = /(?:[1-3]?\s*[A-Z][a-z]+\s+\d+:\d+|\b\d+:\d+\b)/g;

function countVersesInText(text: string): number {
  const matches = text.match(VERSE_LINE_REGEX);
  return matches ? matches.length : 0;
}

function stripHtmlToText(html: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    return (doc.body?.textContent || '').replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  } catch {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

export async function parseDocumentFile(file: File): Promise<ParsedDocumentOutput> {
  const nameLower = file.name.toLowerCase();
  const baseTitle = file.name.replace(/\.(pdf|epub|txt)$/i, '').replace(/[_-]+/g, ' ').trim() || 'Bible Edition';

  if (nameLower.endsWith('.pdf')) {
    const buffer = await file.arrayBuffer();
    const pdfBytes = new Uint8Array(buffer);
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) });
    const pdf = await loadingTask.promise;
    const totalPages = pdf.numPages || 0;
    const sections: UploadedBibleSection[] = [];
    const textParts: string[] = [];

    const maxPagesToRead = Math.min(totalPages, 80);
    for (let pageNum = 1; pageNum <= maxPagesToRead; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (pageText) {
        sections.push({
          title: `Page ${pageNum}`,
          content: pageText,
        });
        textParts.push(pageText);
      }
    }

    const fullText = textParts.join('\n\n');
    return {
      title: baseTitle,
      format: 'PDF',
      sections,
      pageOrChapterCount: totalPages || sections.length || 1,
      extractedVersesCount: countVersesInText(fullText),
      fullText,
      pdfBytes,
    };
  }

  if (nameLower.endsWith('.epub')) {
    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    const htmlFiles = Object.keys(zip.files)
      .filter((path) => /\.(xhtml|html|htm)$/i.test(path) && !path.toLowerCase().includes('toc'))
      .sort();

    const sections: UploadedBibleSection[] = [];
    const textParts: string[] = [];

    for (let idx = 0; idx < Math.min(htmlFiles.length, 80); idx++) {
      const filePath = htmlFiles[idx];
      const rawHtml = await zip.files[filePath].async('string');
      const clean = stripHtmlToText(rawHtml);
      if (clean && clean.length > 20) {
        sections.push({
          title: `Chapter ${sections.length + 1}`,
          content: clean,
        });
        textParts.push(clean);
      }
    }

    const fullText = textParts.join('\n\n');
    return {
      title: baseTitle,
      format: 'EPUB',
      sections,
      pageOrChapterCount: sections.length || 1,
      extractedVersesCount: countVersesInText(fullText),
      fullText,
    };
  }

  // Plain text fallback
  const fullText = (await file.text()).trim();
  const paragraphs = fullText.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  const sections: UploadedBibleSection[] = [];
  const chunkSize = 12;
  for (let i = 0; i < paragraphs.length; i += chunkSize) {
    sections.push({
      title: `Section ${sections.length + 1}`,
      content: paragraphs.slice(i, i + chunkSize).join('\n\n'),
    });
  }
  return {
    title: baseTitle,
    format: 'TXT',
    sections: sections.length > 0 ? sections : [{ title: 'Full Text', content: fullText }],
    pageOrChapterCount: Math.max(1, sections.length),
    extractedVersesCount: countVersesInText(fullText),
    fullText,
  };
}

export async function compressAvatarImageFile(
  file: File,
  maxDim = 280,
  maxChars = 88_000
): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not decode selected image.'));
      el.src = objectUrl;
    });

    const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable.');
    ctx.drawImage(img, 0, 0, width, height);

    for (const quality of [0.82, 0.7, 0.56, 0.42]) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      if (dataUrl.length <= maxChars) {
        return dataUrl;
      }
    }
    return canvas.toDataURL('image/jpeg', 0.35);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
