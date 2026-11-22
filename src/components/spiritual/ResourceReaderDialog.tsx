import React from 'react';
import {
  Bookmark,
  BookOpen,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Share2,
  Square,
  Volume2,
  X,
} from 'lucide-react';
import {
  formatAudioDurationMMSS,
  formatFileSizeMB,
  hasPlayableAudioSermon,
  sanitizeSpiritualDisplayText,
} from '../../utils/spiritualLogic';
import type { AudioSermonPlayerState } from '../../utils/audioSermonPlayer';
import type { SpiritualTranslationStrings } from '../../data/translations';
import type { DisplaySpiritualResource } from './SpiritualResourceCard';

interface ResourceReaderDialogProps {
  resource: DisplaySpiritualResource | null;
  isBookmarked: boolean;
  isActiveAudio: boolean;
  audioProgress: number;
  audioPlayerState: AudioSermonPlayerState;
  labels: SpiritualTranslationStrings;
  onClose: () => void;
  onToggleAudio: () => void;
  onToggleSermonAudio: () => void;
  onSeekSermonAudio: (seconds: number) => void;
  onSkipSermonAudio: (deltaSeconds: number) => void;
  onStopSermonAudio: () => void;
  onShare: () => void;
  onToggleBookmark: () => void;
}

export const ResourceReaderDialog: React.FC<ResourceReaderDialogProps> = ({
  resource,
  isBookmarked,
  isActiveAudio,
  audioProgress,
  audioPlayerState,
  labels,
  onClose,
  onToggleAudio,
  onToggleSermonAudio,
  onSeekSermonAudio,
  onSkipSermonAudio,
  onStopSermonAudio,
  onShare,
  onToggleBookmark,
}) => {
  if (!resource) return null;

  const isPlayableRecording = hasPlayableAudioSermon(resource);
  const isThisRecordingActive =
    isPlayableRecording && audioPlayerState.activeResourceId === resource.id;
  const recordingDurationSec = isThisRecordingActive
    ? audioPlayerState.duration || (resource.audioDurationMinutes || 0) * 60
    : (resource.audioDurationMinutes || 0) * 60;
  const recordingCurrentSec = isThisRecordingActive ? audioPlayerState.currentTime : 0;
  const sizeBadge = formatFileSizeMB(resource.audioSizeBytes);

  const pct = isActiveAudio ? Math.min(100, Math.max(4, Math.round(audioProgress * 100))) : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="spiritual-reader-title"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-safe-modal"
    >
      <div className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] overflow-hidden shadow-2xl">
        {/* Top Header */}
        <div className="bg-[#0F172A] text-white px-5 py-4 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <BookOpen className="w-5 h-5 text-[#F59E0B] shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold tracking-wider uppercase text-[#F59E0B] truncate">
                {resource.categoryLabel}
              </p>
              <p className="text-xs text-[#CBD5E1] truncate">
                {resource.speaker} {resource.duration ? `· ${resource.duration}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label={labels.close}
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#94A3B8] hover:text-white hover:bg-[#1E293B]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          <div className="rounded-xl bg-[#FEF3C7]/60 dark:bg-[#F59E0B]/15 border border-[#F59E0B]/50 px-3.5 py-2.5">
            <p className="text-xs font-extrabold tracking-wide text-[#92400E] dark:text-[#FCD34D]">
              SCRIPTURE: {resource.scriptureRef}
            </p>
          </div>

          <h2
            id="spiritual-reader-title"
            className="font-display text-xl sm:text-2xl font-extrabold text-[#0F172A] dark:text-white leading-tight"
          >
            {resource.title}
          </h2>

          {isPlayableRecording && (
            <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={onToggleSermonAudio}
                    aria-label={
                      isThisRecordingActive && audioPlayerState.isPlaying
                        ? 'Pause Sermon Audio'
                        : 'Play Sermon Audio'
                    }
                    className="w-11 h-11 rounded-full bg-[#E11D48] hover:bg-[#9F1239] text-white flex items-center justify-center shrink-0"
                  >
                    {isThisRecordingActive && audioPlayerState.isBuffering ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isThisRecordingActive && audioPlayerState.isPlaying ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4 ml-0.5" />
                    )}
                  </button>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#0F172A] dark:text-white truncate">
                      {resource.audioFileName || 'Sermon Audio Recording'}
                    </p>
                    <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] tabular-nums">
                      {formatAudioDurationMMSS(recordingCurrentSec)} /{' '}
                      {formatAudioDurationMMSS(recordingDurationSec)}
                      {sizeBadge ? ` · ${sizeBadge}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={!isThisRecordingActive}
                    onClick={() => onSkipSermonAudio(-15)}
                    aria-label="Rewind 15 seconds"
                    className="min-w-[40px] min-h-[40px] px-2 rounded-lg border border-[#E2E8F0] dark:border-[#374151] text-[11px] font-bold disabled:opacity-40 inline-flex items-center justify-center gap-0.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>15</span>
                  </button>
                  <button
                    type="button"
                    disabled={!isThisRecordingActive}
                    onClick={() => onSkipSermonAudio(15)}
                    aria-label="Forward 15 seconds"
                    className="min-w-[40px] min-h-[40px] px-2 rounded-lg border border-[#E2E8F0] dark:border-[#374151] text-[11px] font-bold disabled:opacity-40 inline-flex items-center justify-center gap-0.5"
                  >
                    <span>15</span>
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                  {isThisRecordingActive && (
                    <button
                      type="button"
                      onClick={onStopSermonAudio}
                      aria-label="Stop Sermon Audio"
                      className="min-w-[40px] min-h-[40px] rounded-lg border border-[#E2E8F0] dark:border-[#374151] flex items-center justify-center text-[#64748B] hover:text-[#E11D48]"
                    >
                      <Square className="w-3.5 h-3.5 fill-current" />
                    </button>
                  )}
                </div>
              </div>
              <input
                type="range"
                aria-label="Seek sermon recording"
                min={0}
                max={Math.max(1, Math.floor(recordingDurationSec))}
                value={Math.min(
                  Math.max(0, Math.floor(recordingCurrentSec)),
                  Math.max(1, Math.floor(recordingDurationSec))
                )}
                disabled={!isThisRecordingActive || recordingDurationSec <= 0}
                onChange={(e) => onSeekSermonAudio(Number(e.target.value))}
                className="w-full accent-[#E11D48] cursor-pointer disabled:opacity-50"
              />
              {isThisRecordingActive && audioPlayerState.errorMessage && (
                <p role="alert" className="text-[11px] font-semibold text-[#E11D48]">
                  {audioPlayerState.errorMessage}
                </p>
              )}
            </div>
          )}

          {!isPlayableRecording && isActiveAudio && (
            <div className="rounded-xl bg-[#FFF1F2] dark:bg-[#9F1239]/25 border border-[#E11D48]/35 p-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold text-[#9F1239] dark:text-[#FECDD3]">
                <span>Playing audio narration...</span>
                <span className="tabular-nums">{pct}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/70 dark:bg-[#1F2937] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#E11D48] transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          <div className="text-sm sm:text-base leading-relaxed whitespace-pre-wrap text-[#334155] dark:text-[#E2E8F0]">
            {sanitizeSpiritualDisplayText(
              resource.body,
              resource.audioFileName
                ? `Audio Sermon • ${resource.audioFileName}`
                : 'This legacy upload contains unreadable binary bytes. Leadership can edit this resource to attach an MP3/M4A/AAC/WAV audio file.'
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-[#E2E8F0] dark:border-[#374151] bg-[#F8FAFC] dark:bg-[#0B0F19] p-3.5 sm:px-5 grid grid-cols-2 sm:grid-cols-4 gap-2 shrink-0">
          {isPlayableRecording ? (
            <button
              type="button"
              onClick={onToggleSermonAudio}
              className={`min-h-[44px] px-3 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors ${
                isThisRecordingActive && audioPlayerState.isPlaying
                  ? 'bg-[#0F172A] text-white'
                  : 'bg-[#E11D48] hover:bg-[#9F1239] text-white'
              }`}
            >
              {isThisRecordingActive && audioPlayerState.isBuffering ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Loading...</span>
                </>
              ) : isThisRecordingActive && audioPlayerState.isPlaying ? (
                <>
                  <Pause className="w-4 h-4 shrink-0" />
                  <span>{labels.pauseAudio}</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 shrink-0" />
                  <span>Play Audio</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleAudio}
              className={`min-h-[44px] px-3 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors ${
                isActiveAudio
                  ? 'bg-[#0F172A] text-white'
                  : 'bg-[#E11D48] hover:bg-[#9F1239] text-white'
              }`}
            >
              {isActiveAudio ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current shrink-0" />
                  <span>{labels.stopAudio}</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 shrink-0" />
                  <span>{labels.listenAloud}</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onShare}
            className="min-h-[44px] px-3 rounded-xl border border-[#E2E8F0] dark:border-[#374151] bg-white dark:bg-[#1F2937] text-[#0F172A] dark:text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 hover:bg-[#F1F5F9] dark:hover:bg-[#374151]"
          >
            <Share2 className="w-4 h-4 text-[#E11D48] shrink-0" />
            <span>{labels.share}</span>
          </button>

          <button
            type="button"
            onClick={onToggleBookmark}
            className={`min-h-[44px] px-3 rounded-xl border text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors ${
              isBookmarked
                ? 'bg-[#FEF3C7] dark:bg-[#F59E0B]/20 border-[#F59E0B] text-[#92400E] dark:text-[#FCD34D]'
                : 'border-[#E2E8F0] dark:border-[#374151] bg-white dark:bg-[#1F2937] text-[#0F172A] dark:text-white'
            }`}
          >
            <Bookmark
              className={`w-4 h-4 shrink-0 ${
                isBookmarked ? 'fill-[#F59E0B] text-[#F59E0B]' : 'text-[#64748B]'
              }`}
            />
            <span>{isBookmarked ? labels.bookmarkedDone : labels.saveOffline}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-3 rounded-xl bg-[#0F172A] dark:bg-[#1F2937] text-white text-xs font-bold"
          >
            {labels.close}
          </button>
        </div>
      </div>
    </div>
  );
};
