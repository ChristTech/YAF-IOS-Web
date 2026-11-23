import React from 'react';
import {
  Bookmark,
  BookOpen,
  Loader2,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  RotateCw,
  Square,
  Trash2,
  Volume2,
} from 'lucide-react';
import {
  formatAudioDurationMMSS,
  formatFileSizeMB,
  hasPlayableAudioSermon,
  sanitizeSpiritualDisplayText,
} from '../../utils/spiritualLogic';
import type { AudioSermonPlayerState } from '../../utils/audioSermonPlayer';
import type { SpiritualTranslationStrings } from '../../data/translations';
import type { SpiritualResource } from '../../types/fellowship';

export interface DisplaySpiritualResource extends SpiritualResource {
  categoryLabel: string;
  categoryKey: string;
}

interface SpiritualResourceCardProps {
  resource: DisplaySpiritualResource;
  isBookmarked: boolean;
  isLeadership: boolean;
  isActiveAudio: boolean;
  isPaused: boolean;
  audioProgress: number;
  audioPlayerState: AudioSermonPlayerState;
  labels: SpiritualTranslationStrings;
  onToggleBookmark: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleListen: () => void;
  onStopAudio: () => void;
  onToggleSermonAudio: () => void;
  onSeekSermonAudio: (seconds: number) => void;
  onSkipSermonAudio: (deltaSeconds: number) => void;
  onStopSermonAudio: () => void;
  onReadFull: () => void;
}

export const SpiritualResourceCard: React.FC<SpiritualResourceCardProps> = ({
  resource,
  isBookmarked,
  isLeadership,
  isActiveAudio,
  isPaused,
  audioProgress,
  audioPlayerState,
  labels,
  onToggleBookmark,
  onEdit,
  onDelete,
  onToggleListen,
  onStopAudio,
  onToggleSermonAudio,
  onSeekSermonAudio,
  onSkipSermonAudio,
  onStopSermonAudio,
  onReadFull,
}) => {
  const isPlayableRecording = hasPlayableAudioSermon(resource);
  const isThisRecordingActive =
    isPlayableRecording && audioPlayerState.activeResourceId === resource.id;

  const recordingDurationSec = isThisRecordingActive
    ? audioPlayerState.duration || (resource.audioDurationMinutes || 0) * 60
    : (resource.audioDurationMinutes || 0) * 60;
  const recordingCurrentSec = isThisRecordingActive ? audioPlayerState.currentTime : 0;
  const sizeBadge = formatFileSizeMB(resource.audioSizeBytes);

  const audioMins = resource.audioDurationMinutes || 0;
  const showTtsPlayer = !isPlayableRecording && (audioMins > 0 || isActiveAudio);
  const pct = isActiveAudio ? Math.min(100, Math.max(4, Math.round(audioProgress * 100))) : 0;

  return (
    <article className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-4 sm:p-5 flex flex-col justify-between gap-3.5 shadow-xs">
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#FFF1F2] dark:bg-[#9F1239]/30 text-[#E11D48] dark:text-[#FB7185] text-[11px] font-extrabold tracking-wide uppercase">
              {resource.categoryLabel}
            </span>
            {isPlayableRecording && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#FEF3C7] dark:bg-[#F59E0B]/20 text-[#92400E] dark:text-[#FCD34D] text-[11px] font-bold">
                <span>🎧 Audio</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {isLeadership && (
              <>
                <button
                  type="button"
                  aria-label={`Edit ${resource.title}`}
                  onClick={onEdit}
                  className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#64748B] hover:text-[#0F172A] dark:hover:text-white hover:bg-[#F1F5F9] dark:hover:bg-[#1F2937] transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${resource.title}`}
                  onClick={onDelete}
                  className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#64748B] hover:text-[#E11D48] hover:bg-[#FFF1F2] dark:hover:bg-[#9F1239]/25 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}

            <button
              type="button"
              aria-label={isBookmarked ? labels.bookmarkedDone : labels.saveOffline}
              aria-pressed={isBookmarked}
              onClick={onToggleBookmark}
              className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center hover:bg-[#F1F5F9] dark:hover:bg-[#1F2937] transition-colors"
            >
              <Bookmark
                className={`w-5 h-5 ${
                  isBookmarked
                    ? 'fill-[#F59E0B] text-[#F59E0B]'
                    : 'text-[#64748B] dark:text-[#94A3B8]'
                }`}
              />
            </button>
          </div>
        </div>

        <div>
          <h3 className="font-display text-base sm:text-lg font-bold text-[#0F172A] dark:text-white leading-snug">
            {resource.title}
          </h3>
          <p className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] mt-1">
            <span className="text-[#B45309] dark:text-[#F59E0B]">{resource.scriptureRef}</span>
            {' · '}
            <span>{resource.speaker}</span>
            {resource.duration ? ` · ${resource.duration}` : ''}
          </p>
        </div>

        <p className="text-xs sm:text-sm text-[#334155] dark:text-[#CBD5E1] line-clamp-3 leading-relaxed">
          {sanitizeSpiritualDisplayText(
            resource.summary || resource.body,
            resource.audioFileName
              ? `Audio Sermon • ${resource.audioFileName}`
              : 'Notes unavailable — leadership can edit this sermon to attach a new audio file.'
          )}
        </p>

        {/* Uploaded Audio Sermon Player */}
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
                  className="w-11 h-11 rounded-full bg-[#E11D48] hover:bg-[#9F1239] text-white flex items-center justify-center shrink-0 transition-colors"
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
                    {resource.audioFileName || 'Uploaded Sermon Audio'}
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
                  className="min-w-[40px] min-h-[40px] px-2 rounded-lg border border-[#E2E8F0] dark:border-[#374151] text-[11px] font-bold text-[#334155] dark:text-[#E2E8F0] disabled:opacity-40 inline-flex items-center justify-center gap-0.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>15</span>
                </button>
                <button
                  type="button"
                  disabled={!isThisRecordingActive}
                  onClick={() => onSkipSermonAudio(15)}
                  aria-label="Forward 15 seconds"
                  className="min-w-[40px] min-h-[40px] px-2 rounded-lg border border-[#E2E8F0] dark:border-[#374151] text-[11px] font-bold text-[#334155] dark:text-[#E2E8F0] disabled:opacity-40 inline-flex items-center justify-center gap-0.5"
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
              aria-label={`Seek ${resource.title}`}
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

        {/* Text-only TTS Narration Indicator */}
        {showTtsPlayer && (
          <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] p-3 space-y-2">
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={onToggleListen}
                  aria-label={
                    isActiveAudio && !isPaused ? labels.pauseAudio : labels.listenAloud
                  }
                  className="w-10 h-10 rounded-full bg-[#E11D48] hover:bg-[#9F1239] text-white flex items-center justify-center shrink-0 transition-colors"
                >
                  {isActiveAudio && !isPaused ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4 ml-0.5" />
                  )}
                </button>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#0F172A] dark:text-white truncate">
                    {isActiveAudio
                      ? isPaused
                        ? 'Audio narration paused'
                        : 'Playing audio narration...'
                      : `Voice Narration (${audioMins} mins)`}
                  </p>
                  <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] tabular-nums">
                    {isActiveAudio ? `${pct}% complete` : 'Tap play for voice narration'}
                  </p>
                </div>
              </div>

              {isActiveAudio && (
                <button
                  type="button"
                  onClick={onStopAudio}
                  aria-label={labels.stopAudio}
                  className="min-w-[40px] min-h-[40px] rounded-lg border border-[#E2E8F0] dark:border-[#374151] flex items-center justify-center text-[#64748B] hover:text-[#E11D48]"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                </button>
              )}
            </div>

            <div className="h-1.5 w-full rounded-full bg-[#E2E8F0] dark:bg-[#374151] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#E11D48] transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5 pt-1">
        {isPlayableRecording ? (
          <button
            type="button"
            onClick={onToggleSermonAudio}
            className="min-h-[44px] px-3 rounded-xl bg-[#E11D48] hover:bg-[#9F1239] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors"
          >
            {isThisRecordingActive && audioPlayerState.isBuffering ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                <span>Loading Audio...</span>
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
            onClick={onToggleListen}
            className="min-h-[44px] px-3 rounded-xl bg-[#E11D48] hover:bg-[#9F1239] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors"
          >
            {isActiveAudio && !isPaused ? (
              <>
                <Pause className="w-4 h-4 shrink-0" />
                <span>{labels.pauseAudio}</span>
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
          onClick={onReadFull}
          className="min-h-[44px] px-3 rounded-xl bg-[#0F172A] dark:bg-[#1F2937] hover:bg-[#1E293B] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors"
        >
          <BookOpen className="w-4 h-4 shrink-0 text-[#F59E0B]" />
          <span>{labels.readFullMessage}</span>
        </button>
      </div>
    </article>
  );
};
