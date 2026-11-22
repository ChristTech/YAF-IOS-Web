import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface DeleteResourceDialogProps {
  isOpen: boolean;
  resourceTitle: string;
  deleting: boolean;
  onCancel: () => void;
  onConfirmDelete: () => void;
}

export const DeleteResourceDialog: React.FC<DeleteResourceDialogProps> = ({
  isOpen,
  resourceTitle,
  deleting,
  onCancel,
  onConfirmDelete,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-spiritual-resource-title"
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/65 p-safe-modal"
    >
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-5 space-y-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#FFF1F2] dark:bg-[#9F1239]/30 text-[#E11D48] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3
              id="delete-spiritual-resource-title"
              className="font-display text-base font-bold text-[#0F172A] dark:text-white"
            >
              Delete Spiritual Resource?
            </h3>
          </div>
          <button
            type="button"
            aria-label="Close delete confirmation"
            onClick={onCancel}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#64748B] hover:text-[#0F172A] dark:hover:text-white rounded-xl"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs sm:text-sm text-[#334155] dark:text-[#CBD5E1] leading-relaxed">
          Are you sure you want to permanently remove{' '}
          <strong className="text-[#0F172A] dark:text-white">“{resourceTitle}”</strong> from the
          fellowship library and your offline cache?
        </p>

        <div className="flex gap-2.5 pt-1">
          <button
            type="button"
            disabled={deleting}
            onClick={onCancel}
            className="flex-1 min-h-[44px] rounded-xl bg-[#F1F5F9] dark:bg-[#1F2937] text-[#0F172A] dark:text-white text-xs font-bold"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={onConfirmDelete}
            className="flex-1 min-h-[44px] rounded-xl bg-[#E11D48] hover:bg-[#9F1239] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
          >
            <Trash2 className="w-4 h-4" />
            <span>{deleting ? 'Deleting...' : 'Delete Resource'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
