import React, { useEffect, useRef } from 'react';
import { Copy, X } from 'lucide-react';

interface CopyShareFallbackDialogProps {
  isOpen: boolean;
  shareText: string;
  onClose: () => void;
  onCopied: () => void;
}

export const CopyShareFallbackDialog: React.FC<CopyShareFallbackDialogProps> = ({
  isOpen,
  shareText,
  onClose,
  onCopied,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleManualCopy = async () => {
    try {
      textareaRef.current?.select();
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
      } else {
        document.execCommand?.('copy');
      }
      onCopied();
    } catch {
      textareaRef.current?.select();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="copy-fallback-title"
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/65 p-safe-modal"
    >
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-5 space-y-3 shadow-2xl">
        <div className="flex items-center justify-between gap-2">
          <h3 id="copy-fallback-title" className="font-display text-base font-bold">
            Copy & Share Message
          </h3>
          <button
            type="button"
            aria-label="Close share dialog"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#64748B]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
          Select and copy the fellowship message below to paste into WhatsApp, Messages, or email:
        </p>

        <textarea
          ref={textareaRef}
          aria-label="Shareable fellowship message"
          readOnly
          rows={6}
          value={shareText}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full p-3 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-xs leading-relaxed"
        />

        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={handleManualCopy}
            className="flex-1 min-h-[44px] rounded-xl bg-[#E11D48] hover:bg-[#9F1239] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5"
          >
            <Copy className="w-4 h-4" />
            <span>Copy Text</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 rounded-xl bg-[#0F172A] dark:bg-[#1F2937] text-white text-xs font-bold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
