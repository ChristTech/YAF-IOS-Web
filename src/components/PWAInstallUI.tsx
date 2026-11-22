import React, { useState } from 'react';
import { Download, Share, Smartphone, WifiOff, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        aria-label="Install Gideonites App"
        className="inline-flex items-center gap-1.5 rounded-lg bg-[#E11D48] hover:bg-[#9F1239] text-white px-2.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 min-h-[36px]"
      >
        <Download className="w-3.5 h-3.5" />
        {!compact && <span>Install App</span>}
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowIOSGuide(true)}
        aria-label="Install on iPhone or iPad"
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#F59E0B]/60 bg-[#1E293B] hover:bg-[#334155] text-[#FEF3C7] px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 min-h-[36px]"
      >
        <Smartphone className="w-3.5 h-3.5 text-[#F59E0B]" />
        {!compact && <span>{isIOS ? 'iOS Install' : 'Install PWA'}</span>}
      </button>

      {showIOSGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ios-install-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-5 shadow-xl text-[#0F172A] dark:text-white">
            <div className="flex items-start justify-between gap-3">
              <h3 id="ios-install-title" className="text-base font-bold">
                Install on iPhone / iPad & Desktop
              </h3>
              <button
                type="button"
                aria-label="Close install guide"
                onClick={() => setShowIOSGuide(false)}
                className="p-1.5 rounded-lg text-[#64748B] hover:bg-[#F1F5F9] dark:hover:bg-[#1F2937]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-3 space-y-2.5 text-sm text-[#334155] dark:text-[#94A3B8]">
              <p>
                <strong className="text-[#0F172A] dark:text-white">iOS Safari:</strong> Tap the{' '}
                <span className="inline-flex items-center gap-1 font-semibold text-[#E11D48]">
                  <Share className="w-3.5 h-3.5" /> Share
                </span>{' '}
                button in Safari toolbar, scroll down, and tap{' '}
                <strong className="text-[#0F172A] dark:text-white">Add to Home Screen</strong>.
              </p>
              <p>
                <strong className="text-[#0F172A] dark:text-white">Android / Chrome:</strong> Open browser menu and tap{' '}
                <strong className="text-[#0F172A] dark:text-white">Install App</strong> or{' '}
                <strong className="text-[#0F172A] dark:text-white">Add to Home screen</strong>.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="mt-4 w-full min-h-[44px] rounded-xl bg-[#0F172A] dark:bg-[#E11D48] text-white text-sm font-semibold hover:opacity-95 transition-opacity"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const IOSInstallBanner: React.FC = () => {
  const { isInstalled, isIOS, isInstallable, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);

  if (isInstalled || dismissed) return null;

  return (
    <div className="rounded-2xl bg-[#0F172A] text-white border border-[#F59E0B]/50 p-4 flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#E11D48]/20 border border-[#E11D48]/40 flex items-center justify-center shrink-0 mt-0.5">
          <Smartphone className="w-4 h-4 text-[#F59E0B]" />
        </div>
        <div>
          <p className="text-sm font-semibold">Install on iPhone / iPad & Mobile</p>
          <p className="text-xs text-[#94A3B8] mt-1 leading-relaxed">
            {isInstallable
              ? 'Tap Install App to add The Gideonites directly to your home screen for offline access.'
              : isIOS
              ? 'In Safari, tap the Share icon and select "Add to Home Screen" for full-screen standalone access.'
              : 'Install this PWA from your browser or Safari Share → "Add to Home Screen" for offline-ready access.'}
          </p>
          {isInstallable && (
            <button
              type="button"
              onClick={install}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-[#E11D48] hover:bg-[#9F1239] px-3 py-1.5 text-xs font-semibold text-white"
            >
              <Download className="w-3.5 h-3.5" />
              Install Now
            </button>
          )}
        </div>
      </div>
      <button
        type="button"
        aria-label="Dismiss install banner"
        onClick={() => setDismissed(true)}
        className="p-1.5 text-[#94A3B8] hover:text-white rounded-lg"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:w-auto z-40 flex items-center gap-2 rounded-xl bg-[#F59E0B] text-[#0F172A] px-3.5 py-2 text-xs font-semibold shadow-lg"
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>Offline Mode — Cached fellowship data is active.</span>
    </div>
  );
};
