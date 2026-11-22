import React from 'react';
import {
  AlertTriangle,
  BookOpen,
  Bookmark,
  Check,
  Copy,
  Pause,
  Share2,
  Square,
  Volume2,
  X,
} from 'lucide-react';
import type { TranslationStrings } from '../../data/translations';
import type { SpiritualResource } from '../../types/fellowship';

interface ResourceReaderDialogProps {
  resource: SpiritualResource | null;
  isBookmarked: boolean;
  isPlaying: boolean;
  isPaused: boolean;
  progress: number;
  labels: TranslationStrings;
  onClose: () => void;
  onListenAloud: (resource: SpiritualResource) => void;
  onStopAudio: () => void;
  onShare: (resource: SpiritualResource) => void;
  onToggleBookmark: (resource: SpiritualResource) => void;
}

export const ResourceReaderDialog: React.FC<ResourceReaderDialogProps> = ({
  resource,
  isBookmarked,
  isPlaying,
  isPaused,
  progress,
  labels,
  onClose,
  onListenAloud,
  onStopAudio,
  onShare,
  onToggleBookmark,
}) => {
  if (!resource) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="resource-reader-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 sm:p-6 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
    >
      <div className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] overflow-hidden shadow-2xl">
        {/* #0F172A Top Header */}
        <div className="bg-[#0F172A] text-white px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <BookOpen className="w-5 h-5 text-[#F59E0B] shrink-0" />
            <span className="text-xs font-extrabold tracking-wider text-[#F59E0B] uppercase truncate">
              {resource.kind.replace(/_/g, ' ')} &bull; {resource.speaker}
            </span>
          </div>
          <button
            type="button"
            aria-label="Close reader"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-[#94A3B8] hover:text-white hover:bg-[#1E293B]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          <h2
            id="resource-reader-modal-title"
            className="font-display text-lg sm:text-xl font-extrabold text-[#0F172A] dark:text-white leading-snug"
          >
            {resource.title}
          </h2>

          {/* Gold Scripture Banner */}
          <div className="rounded-xl bg-[#FEF3C7] dark:bg-[#F59E0B]/15 border border-[#F59E0B]/50 px-4 py-2.5 flex items-center justify-between gap-2">
            <span className="text-xs font-extrabold text-[#92400E] dark:text-[#FEF3C7] uppercase tracking-wide">
              SCRIPTURE: {resource.scriptureRef}
            </span>
            <span className="text-[11px] font-semibold text-[#92400E]/80 dark:text-[#FDE68A]">
              {resource.duration}
            </span>
          </div>

          {isPlaying && (
            <div className="rounded-xl bg-[#0F172A] text-white p-3 space-y-2 border border-[#1E293B]">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#F59E0B] inline-flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4" />
                  <span>{isPaused ? 'Audio Paused' : 'Playing Narration...'}</span>
                </span>
                <button
                  type="button"
                  onClick={onStopAudio}
                  className="text-xs font-bold text-[#FB7185] hover:underline inline-flex items-center gap-1"
                >
                  <Square className="w-3 h-3 fill-current" />
                  <span>{labels.spiritual.stopAudio}</span>
                </button>
              </div>
              <div className="h-1.5 w-full rounded-full bg-[#1E293B] overflow-hidden">
                <div
                  className="h-full bg-[#E11D48] transition-all duration-300"
                  style={{ width: `${Math.round(Math.max(5, progress * 100))}%` }}
                />
              </div>
            </div>
          )}

          <div className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap text-[#1E293B] dark:text-[#E2E8F0]">
            {resource.body}
          </div>
        </div>

        {/* Bottom Action Bar */}
        <div className="px-4 sm:px-6 py-3.5 bg-[#F8FAFC] dark:bg-[#0B0F19] border-t border-[#E2E8F0] dark:border-[#374151] flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => (isPlaying && !isPaused ? onStopAudio() : onListenAloud(resource))}
            className="min-h-[44px] px-4 rounded-xl bg-[#E11D48] hover:bg-[#9F1239] text-white text-xs font-bold inline-flex items-center gap-1.5"
          >
            {isPlaying && !isPaused ? (
              <>
                <Pause className="w-4 h-4" />
                <span>{labels.spiritual.stopAudio}</span>
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
            onClick={() => onToggleBookmark(resource)}
            className={`min-h-[44px] px-3.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 border ${
              isBookmarked
                ? 'bg-[#FEF3C7] dark:bg-[#F59E0B]/20 border-[#F59E0B] text-[#92400E] dark:text-[#FEF3C7]'
                : 'bg-white dark:bg-[#1F2937] border-[#E2E8F0] dark:border-[#374151] text-[#0F172A] dark:text-white'
            }`}
          >
            {isBookmarked ? (
              <Check className="w-4 h-4 text-[#F59E0B]" />
            ) : (
              <Bookmark className="w-4 h-4" />
            )}
            <span>
              {isBookmarked ? labels.spiritual.bookmarkedLabel : labels.spiritual.saveOffline}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onShare(resource)}
            className="min-h-[44px] px-3.5 rounded-xl bg-white dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-[#0F172A] dark:text-white text-xs font-bold inline-flex items-center gap-1.5"
          >
            <Share2 className="w-4 h-4" />
            <span>{labels.spiritual.shareLabel}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="ml-auto min-h-[44px] px-4 rounded-xl bg-[#0F172A] dark:bg-[#334155] text-white text-xs font-bold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

interface DeleteResourceConfirmDialogProps {
  resource: SpiritualResource | null;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const DeleteResourceConfirmDialog: React.FC<DeleteResourceConfirmDialogProps> = ({
  resource,
  deleting,
  onCancel,
  onConfirm,
}) => {
  if (!resource) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-spiritual-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#111827] border border-[#E11D48] p-5 space-y-4 shadow-2xl">
        <div className="flex items-center gap-2.5 text-[#E11D48]">
          <AlertTriangle className="w-6 h-6 shrink-0" />
          <h3 id="delete-spiritual-modal-title" className="font-display text-base font-bold">
            Delete Spiritual Resource?
          </h3>
        </div>
        <p className="text-xs text-[#334155] dark:text-[#CBD5E1] leading-relaxed">
          Remove <strong>"{resource.title}"</strong> from the live fellowship spiritual library?
          This action removes the document from Firestore for all synced Android and PWA devices.
        </p>
        <div className="flex gap-2.5">
          <button
            type="button"
            disabled={deleting}
            onClick={onCancel}
            className="flex-1 min-h-[44px] rounded-xl bg-[#F1F5F9] dark:bg-[#1F2937] text-xs font-bold"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={onConfirm}
            className="flex-1 min-h-[44px] rounded-xl bg-[#E11D48] hover:bg-[#9F1239] text-white text-xs font-bold disabled:opacity-60"
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface ShareCopyFallbackModalProps {
  shareText: string | null;
  onClose: () => void;
  onCopied: () => void;
}

export const ShareCopyFallbackModal: React.FC<ShareCopyFallbackModalProps> = ({
  shareText,
  onClose,
  onCopied,
}) => {
  if (!shareText) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-fallback-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-5 space-y-3 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 id="share-fallback-modal-title" className="font-display text-sm font-bold">
            Copy Resource to Share
          </h3>
          <button
            type="button"
            aria-label="Close share dialog"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center text-[#64748B]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <textarea
          readOnly
          rows={7}
          value={shareText}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full p-3 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-xs leading-relaxed"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              if (navigator.clipboard?.writeText) {
                void navigator.clipboard.writeText(shareText).then(onCopied).catch(() => {});
              }
            }}
            className="flex-1 min-h-[44px] rounded-xl bg-[#0F172A] dark:bg-[#E11D48] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5"
          >
            <Copy className="w-4 h-4" />
            <span>Copy Text</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 rounded-xl bg-[#F1F5F9] dark:bg-[#1F2937] text-xs font-bold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
