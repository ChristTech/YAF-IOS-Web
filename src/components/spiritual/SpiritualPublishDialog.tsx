import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, FolderOpen, Loader2, Music, Trash2, Upload, X } from 'lucide-react';
import {
  logAuditTrail,
  publishDailyScripture,
  publishSpiritualResource,
  updateSpiritualResource,
} from '../../services/fellowshipService';
import { audioSermonPlayer } from '../../utils/audioSermonPlayer';
import { parseDocumentFile } from '../../utils/documentParser';
import {
  DEFAULT_MINISTRY_AUTHOR,
  formatActionErrorMessage,
  getDisplayNameForAccount,
} from '../../utils/fellowshipLogic';
import {
  computeAudioDurationMinutes,
  formatFileSizeMB,
  formatNonAudioRejectionMessage,
  hasPlayableAudioSermon,
  isAudioFileCandidate,
  validateAudioSermonFile,
  type ExtendedSpiritualKind,
} from '../../utils/spiritualLogic';
import type { FellowshipAccount, SpiritualResource } from '../../types/fellowship';

const CATEGORY_OPTIONS: { value: ExtendedSpiritualKind; label: string }[] = [
  { value: 'SCRIPTURE_OF_THE_DAY', label: 'Scripture of the Day' },
  { value: 'SERMON', label: 'Sermon' },
  { value: 'DEVOTIONAL', label: 'Devotional' },
  { value: 'BIBLE_STUDY', label: 'Bible Study' },
  { value: 'PRAYER_POINTS', label: 'Prayer Points' },
];

export type EditableSpiritualResource = SpiritualResource & {
  categoryLabel?: string;
  categoryKey?: string;
};

interface SpiritualPublishDialogProps {
  isOpen: boolean;
  initialCategory?: ExtendedSpiritualKind;
  editingResource?: EditableSpiritualResource | null;
  account: FellowshipAccount;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const SpiritualPublishDialog: React.FC<SpiritualPublishDialogProps> = ({
  isOpen,
  initialCategory = 'SERMON',
  editingResource = null,
  account,
  onClose,
  onSuccess,
}) => {
  const displayName = getDisplayNameForAccount(account);
  const [category, setCategory] = useState<ExtendedSpiritualKind>(initialCategory);
  const [title, setTitle] = useState('');
  const [speaker, setSpeaker] = useState('');
  const [scriptureRef, setScriptureRef] = useState('');
  const [summary, setSummary] = useState('');
  const [body, setBody] = useState('');
  const [audioDuration, setAudioDuration] = useState('30');

  // Audio sermon staging state
  const [stagedAudioFile, setStagedAudioFile] = useState<File | null>(null);
  const [probingAudio, setProbingAudio] = useState(false);
  const [removeExistingAudio, setRemoveExistingAudio] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const previewObjectUrlRef = useRef<string | null>(null);
  const audioProbeSeqRef = useRef(0);
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const audioFallbackInputRef = useRef<HTMLInputElement | null>(null);
  const notesInputRef = useRef<HTMLInputElement | null>(null);

  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isEditMode = Boolean(editingResource);

  const revokePreviewUrl = () => {
    if (previewObjectUrlRef.current) {
      try {
        URL.revokeObjectURL(previewObjectUrlRef.current);
      } catch {
        // ignore
      }
      previewObjectUrlRef.current = null;
    }
  };

  const resetAllFileInputs = () => {
    if (audioInputRef.current) audioInputRef.current.value = '';
    if (audioFallbackInputRef.current) audioFallbackInputRef.current.value = '';
    if (notesInputRef.current) notesInputRef.current.value = '';
  };

  useEffect(() => {
    return () => {
      audioProbeSeqRef.current += 1;
      revokePreviewUrl();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      audioProbeSeqRef.current += 1;
      revokePreviewUrl();
      setProbingAudio(false);
      return;
    }
    setErrorMsg(null);
    setStagedAudioFile(null);
    setProbingAudio(false);
    setRemoveExistingAudio(false);
    setUploadProgress(null);
    resetAllFileInputs();

    if (editingResource) {
      const cat = (editingResource.categoryKey ||
        editingResource.kind ||
        'SERMON') as ExtendedSpiritualKind;
      setCategory(cat);
      setTitle(editingResource.title || '');
      setSpeaker(editingResource.speaker || '');
      setScriptureRef(editingResource.scriptureRef || '');
      setSummary(editingResource.summary || '');
      setBody(editingResource.body || '');
      setAudioDuration(
        String(editingResource.audioDurationMinutes ?? (cat === 'SERMON' ? 30 : 0))
      );
    } else {
      setCategory(initialCategory);
      setTitle('');
      setSpeaker('');
      setScriptureRef('');
      setSummary('');
      setBody('');
      setAudioDuration(initialCategory === 'SERMON' ? '30' : '0');
    }
  }, [isOpen, initialCategory, editingResource]);

  if (!isOpen) return null;

  const hasExistingAudio = Boolean(
    editingResource &&
      hasPlayableAudioSermon(editingResource) &&
      !removeExistingAudio
  );
  const hasAudioAttached =
    category === 'SERMON' && (Boolean(stagedAudioFile) || hasExistingAudio);

  const handleClose = () => {
    audioProbeSeqRef.current += 1;
    revokePreviewUrl();
    setStagedAudioFile(null);
    setProbingAudio(false);
    setUploadProgress(null);
    onClose();
  };

  const handleCategoryChange = (nextCat: ExtendedSpiritualKind) => {
    setCategory(nextCat);
    if (nextCat !== 'SERMON') {
      audioProbeSeqRef.current += 1;
      revokePreviewUrl();
      setStagedAudioFile(null);
      setProbingAudio(false);
      setRemoveExistingAudio(true);
      resetAllFileInputs();
    } else {
      setRemoveExistingAudio(false);
      if (!isEditMode && (!audioDuration || audioDuration === '0')) {
        setAudioDuration('30');
      }
    }
  };

  const applyTitleAndStageAudio = (file: File, durationMinutes?: number) => {
    setStagedAudioFile(file);
    setRemoveExistingAudio(false);
    if (durationMinutes && durationMinutes > 0) {
      setAudioDuration(String(durationMinutes));
    }
    setTitle((prev) => {
      if (prev.trim()) return prev;
      const cleanedName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim();
      return cleanedName || prev;
    });
  };

  const processSelectedAudioFile = (file: File) => {
    setErrorMsg(null);
    const validation = validateAudioSermonFile(file);
    if (!validation.ok) {
      setErrorMsg(validation.error);
      return;
    }

    audioProbeSeqRef.current += 1;
    const probeSeq = audioProbeSeqRef.current;
    revokePreviewUrl();

    if (!validation.ambiguous) {
      applyTitleAndStageAudio(file);
    } else {
      setProbingAudio(true);
    }

    // Verify metadata via HTML5 <audio> element (required for ambiguous formats and extracts duration cleanly)
    if (typeof Audio !== 'undefined' && typeof URL !== 'undefined') {
      try {
        const objectUrl = URL.createObjectURL(file);
        previewObjectUrlRef.current = objectUrl;
        const probe = new Audio();
        probe.preload = 'metadata';

        const cleanupProbe = () => {
          if (previewObjectUrlRef.current === objectUrl) {
            try {
              URL.revokeObjectURL(objectUrl);
            } catch {
              // ignore
            }
            previewObjectUrlRef.current = null;
          }
          probe.onloadedmetadata = null;
          probe.onerror = null;
          try {
            probe.removeAttribute('src');
            probe.load();
          } catch {
            // ignore
          }
        };

        probe.onloadedmetadata = () => {
          const isPlayable = Number.isFinite(probe.duration) ? probe.duration > 0 : true;
          const mins = computeAudioDurationMinutes(probe.duration);
          cleanupProbe();
          if (probeSeq !== audioProbeSeqRef.current) return;
          setProbingAudio(false);

          if (validation.ambiguous && !isPlayable) {
            setErrorMsg(formatNonAudioRejectionMessage(file.name));
            return;
          }
          applyTitleAndStageAudio(file, mins > 0 ? mins : undefined);
        };

        probe.onerror = () => {
          cleanupProbe();
          if (probeSeq !== audioProbeSeqRef.current) return;
          setProbingAudio(false);
          if (validation.ambiguous) {
            setErrorMsg(formatNonAudioRejectionMessage(file.name));
          }
        };

        probe.src = objectUrl;
      } catch {
        setProbingAudio(false);
        if (!validation.ambiguous) {
          applyTitleAndStageAudio(file);
        } else {
          setErrorMsg(formatNonAudioRejectionMessage(file.name));
        }
      }
    } else {
      setProbingAudio(false);
      applyTitleAndStageAudio(file);
    }
  };

  const handleSelectAudioFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset input value so re-selecting/replacing the same filename always triggers onChange
    e.target.value = '';
    if (!file) return;
    processSelectedAudioFile(file);
  };

  const handleRemoveAudio = () => {
    audioProbeSeqRef.current += 1;
    revokePreviewUrl();
    setStagedAudioFile(null);
    setProbingAudio(false);
    setRemoveExistingAudio(true);
    resetAllFileInputs();
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrorMsg(null);

    if (category === 'SERMON' && isAudioFileCandidate(file)) {
      processSelectedAudioFile(file);
      return;
    }

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
      setErrorMsg(err instanceof Error ? err.message : 'Unable to extract text from file.');
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
    } else if (hasAudioAttached) {
      if (!title.trim()) {
        setErrorMsg('Please enter a Sermon Title.');
        return;
      }
    } else if (!title.trim() || !body.trim()) {
      setErrorMsg('Title and body content are required.');
      return;
    }

    setErrorMsg(null);
    setSaving(true);
    setUploadProgress(null);

    // Stop any currently playing audio sermon before uploading/replacing/stripping audio
    if (stagedAudioFile || removeExistingAudio || isEditMode) {
      audioSermonPlayer.stop();
    }

    const authorId = account.userId || account.id;
    const resolvedSpeaker = speaker.trim() || DEFAULT_MINISTRY_AUTHOR;
    const mins = Math.max(0, Number(audioDuration) || (hasAudioAttached ? 1 : 0));
    const effectiveFileName =
      stagedAudioFile?.name ||
      (hasExistingAudio ? editingResource?.audioFileName : undefined) ||
      'sermon-audio.mp3';
    const fallbackAudioText = hasAudioAttached ? `Audio Sermon • ${effectiveFileName}` : '';
    const effectiveBody = body.trim() || fallbackAudioText;
    const effectiveSummary = summary.trim() || (body.trim() ? '' : fallbackAudioText);

    try {
      if (isEditMode && editingResource) {
        await updateSpiritualResource(editingResource.id, {
          authorId,
          authorName: resolvedSpeaker,
          category,
          title: title.trim(),
          speaker: resolvedSpeaker,
          scriptureRef: scriptureRef.trim() || 'Daniel 11:32b',
          summary: effectiveSummary,
          body: effectiveBody,
          audioDurationMinutes: mins,
          bookmarkedBy: editingResource.bookmarkedBy,
          audioFile: category === 'SERMON' ? stagedAudioFile : null,
          removeAudio: category !== 'SERMON' || removeExistingAudio,
          existingAudioCloudId: editingResource.audioCloudId,
          existingAudioFileName: editingResource.audioFileName,
          existingAudioMimeType: editingResource.audioMimeType,
          existingAudioSizeBytes: editingResource.audioSizeBytes,
          existingAudioChunkCount: editingResource.audioChunkCount,
          onUploadProgress: (done, total) => setUploadProgress({ done, total }),
        });
        await logAuditTrail({
          actorName: displayName,
          actorRole: account.role,
          action: 'UPDATE_SPIRITUAL_RESOURCE',
          actionType: 'UPDATE_SPIRITUAL_RESOURCE',
          target: title.trim() || scriptureRef.trim(),
          targetEntity: editingResource.id,
          details: `Updated ${category.replace(/_/g, ' ')}`,
        });
        onSuccess('Spiritual resource updated.');
        handleClose();
        return;
      }

      if (category === 'SCRIPTURE_OF_THE_DAY') {
        await publishDailyScripture({
          authorId,
          authorName: resolvedSpeaker,
          referenceEn: scriptureRef.trim(),
          verseTextEn: body.trim(),
          chargeText:
            summary.trim() || 'Rise as mighty Gideonites today and do Kingdom exploits!',
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
        await publishSpiritualResource({
          authorId,
          kind: category,
          title: title.trim(),
          speaker: resolvedSpeaker,
          scriptureRef: scriptureRef.trim() || 'Judges 6:12',
          duration:
            category === 'SERMON' && mins > 0 ? `${mins} min audio` : '5 min read',
          audioDurationMinutes: mins || undefined,
          summary: effectiveSummary || undefined,
          body: effectiveBody,
          audioFile: category === 'SERMON' ? stagedAudioFile : null,
          onUploadProgress: (done, total) => setUploadProgress({ done, total }),
        });
        await logAuditTrail({
          actorName: displayName,
          actorRole: account.role,
          action: `PUBLISH_${category}`,
          actionType: `PUBLISH_${category}`,
          target: title.trim(),
          targetEntity: title.trim(),
          details: `Published ${category.replace(/_/g, ' ')}: ${title.trim()}`,
        });
        onSuccess(
          stagedAudioFile
            ? `'${title.trim()}' audio sermon uploaded & active across devices.`
            : `'${title.trim()}' published to Spiritual Library.`
        );
      }
      handleClose();
    } catch (err) {
      setErrorMsg(formatActionErrorMessage(err, 'Unable to save spiritual resource.'));
    } finally {
      setSaving(false);
      setUploadProgress(null);
    }
  };

  const activeAudioLabel =
    stagedAudioFile?.name || (hasExistingAudio ? editingResource?.audioFileName : undefined);
  const activeAudioBytes =
    stagedAudioFile?.size || (hasExistingAudio ? editingResource?.audioSizeBytes : undefined);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="spiritual-publish-dialog-title"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/65 p-safe-modal"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg max-h-[86dvh] flex flex-col overflow-hidden rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] shadow-2xl"
      >
        <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-3 border-b border-[#E2E8F0] dark:border-[#374151] shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#E11D48]" />
            <h3 id="spiritual-publish-dialog-title" className="font-display text-base font-bold">
              {isEditMode ? 'Edit Spiritual Resource' : 'Publish Spiritual Resource'}
            </h3>
          </div>
          <button
            type="button"
            aria-label="Close publish dialog"
            onClick={handleClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-[#64748B] hover:text-[#0F172A] dark:hover:text-white rounded-xl"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl bg-[#FFF1F2] dark:bg-[#9F1239]/25 border border-[#E11D48]/40 px-3 py-2 text-xs font-semibold text-[#9F1239] dark:text-[#FECDD3]"
            >
              {errorMsg}
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_OPTIONS.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => handleCategoryChange(cat.value)}
                className={`min-h-[38px] px-3 rounded-lg text-xs font-bold border transition-colors ${
                  category === cat.value
                    ? 'bg-[#E11D48] text-white border-[#E11D48]'
                    : 'bg-[#F8FAFC] dark:bg-[#1F2937] text-[#334155] dark:text-[#CBD5E1] border-[#E2E8F0] dark:border-[#374151]'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {category === 'SERMON' && (
            <section
              aria-label="Audio Sermon Upload"
              className="rounded-2xl bg-[#FFFBEB] dark:bg-[#F59E0B]/10 border border-[#F59E0B]/50 p-3.5 space-y-3"
            >
              <div className="space-y-1">
                <p className="text-xs font-extrabold tracking-wide uppercase text-[#92400E] dark:text-[#FCD34D]">
                  Audio Sermon Upload
                </p>
                <p className="text-xs font-semibold text-[#92400E] dark:text-[#FCD34D] leading-relaxed">
                  Uploading an audio sermon will automatically delete &amp; replace the previous uploaded audio sermon across devices.
                </p>
              </div>

              <div className="space-y-2">
                <label className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[#E11D48]/60 bg-white dark:bg-[#111827] hover:border-[#E11D48] px-3 py-2.5 text-xs font-bold text-[#E11D48] cursor-pointer text-center">
                  <Music className="w-4 h-4 shrink-0" />
                  <span>Select Audio File (.mp3, .m4a, .aac, .wav, .ogg)</span>
                  <input
                    ref={audioInputRef}
                    type="file"
                    accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.oga,.opus,.flac,.3gp,.amr,.wma,.m4b"
                    onChange={handleSelectAudioFile}
                    className="hidden"
                  />
                </label>

                <label className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl border border-[#E2E8F0] dark:border-[#374151] bg-white/90 dark:bg-[#1F2937] hover:border-[#E11D48] px-3 py-2 text-xs font-bold text-[#0F172A] dark:text-white cursor-pointer text-center">
                  <FolderOpen className="w-4 h-4 shrink-0 text-[#B45309] dark:text-[#F59E0B]" />
                  <span>Browse All Folders / Voice Notes (Downloads, WhatsApp, Drive)</span>
                  <input
                    ref={audioFallbackInputRef}
                    type="file"
                    onChange={handleSelectAudioFile}
                    className="hidden"
                  />
                </label>

                {hasAudioAttached && (
                  <button
                    type="button"
                    onClick={handleRemoveAudio}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-[#E11D48]/40 bg-[#FFF1F2] dark:bg-[#9F1239]/25 text-[#E11D48] dark:text-[#FDA4AF] text-xs font-bold inline-flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove Audio</span>
                  </button>
                )}
              </div>

              {probingAudio && (
                <div className="flex items-center gap-2 text-xs font-semibold text-[#92400E] dark:text-[#FCD34D]">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Verifying audio file metadata...</span>
                </div>
              )}

              {hasAudioAttached && activeAudioLabel && (
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
                  <span className="px-2.5 py-1 rounded-lg bg-[#0F172A] text-white truncate max-w-[230px]">
                    {activeAudioLabel}
                  </span>
                  {activeAudioBytes ? (
                    <span className="px-2.5 py-1 rounded-lg bg-[#FEF3C7] text-[#92400E]">
                      {formatFileSizeMB(activeAudioBytes)}
                    </span>
                  ) : null}
                  {Number(audioDuration) > 0 ? (
                    <span className="px-2.5 py-1 rounded-lg bg-[#DCFCE7] text-[#166534]">
                      {audioDuration} min
                    </span>
                  ) : null}
                </div>
              )}

              {uploadProgress && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-[#0F172A] dark:text-white">
                    <span>Uploading sermon audio chunks...</span>
                    <span className="tabular-nums">
                      {uploadProgress.done} / {uploadProgress.total}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-[#E2E8F0] dark:bg-[#374151] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#E11D48] transition-all duration-200"
                      style={{
                        width: `${Math.round(
                          (uploadProgress.done / Math.max(1, uploadProgress.total)) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </section>
          )}

          {category !== 'SCRIPTURE_OF_THE_DAY' && (
            <label className="min-h-[44px] flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#64748B] hover:border-[#E11D48] p-3 text-xs font-bold text-[#E11D48] cursor-pointer text-center">
              <Upload className="w-4 h-4 shrink-0" />
              <span>
                {importing
                  ? 'Extracting text from file...'
                  : category === 'SERMON'
                  ? 'Optional: Import Sermon Notes (.pdf / .epub / .txt)'
                  : 'Import Notes from File (.pdf / .epub / .txt)'}
              </span>
              <input
                ref={notesInputRef}
                type="file"
                accept=".pdf,.epub,.txt,.csv,.json,application/pdf,application/epub+zip,text/plain,text/csv,application/json"
                onChange={handleImportFile}
                className="hidden"
              />
            </label>
          )}

          {category !== 'SCRIPTURE_OF_THE_DAY' && (
            <div>
              <label htmlFor="sp-pub-title" className="block text-xs font-semibold mb-1">
                Title *
              </label>
              <input
                id="sp-pub-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Walking in Kingdom Exploits"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="sp-pub-ref" className="block text-xs font-semibold mb-1">
                Scripture Reference {category === 'SCRIPTURE_OF_THE_DAY' ? '*' : ''}
              </label>
              <input
                id="sp-pub-ref"
                type="text"
                value={scriptureRef}
                onChange={(e) => setScriptureRef(e.target.value)}
                placeholder="e.g. Daniel 11:32b"
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm"
              />
            </div>

            <div>
              <label htmlFor="sp-pub-speaker" className="block text-xs font-semibold mb-1">
                Speaker / Author
              </label>
              <input
                id="sp-pub-speaker"
                type="text"
                value={speaker}
                onChange={(e) => setSpeaker(e.target.value)}
                placeholder={DEFAULT_MINISTRY_AUTHOR}
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm"
              />
            </div>
          </div>

          {category === 'SERMON' && (
            <div>
              <label htmlFor="sp-pub-duration" className="block text-xs font-semibold mb-1">
                Sermon Audio Duration (minutes)
              </label>
              <input
                id="sp-pub-duration"
                type="number"
                min={0}
                value={audioDuration}
                onChange={(e) => setAudioDuration(e.target.value)}
                className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm font-mono"
              />
            </div>
          )}

          <div>
            <label htmlFor="sp-pub-summary" className="block text-xs font-semibold mb-1">
              {category === 'SCRIPTURE_OF_THE_DAY' ? 'Gideonites Youth Charge' : 'Summary'}
            </label>
            <input
              id="sp-pub-summary"
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder={
                category === 'SCRIPTURE_OF_THE_DAY'
                  ? 'Rise as mighty Gideonites today and do Kingdom exploits!'
                  : hasAudioAttached
                  ? 'Optional summary (defaults to Audio Sermon filename)...'
                  : 'Short takeaway summary...'
              }
              className="w-full min-h-[44px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm"
            />
          </div>

          <div>
            <label htmlFor="sp-pub-body" className="block text-xs font-semibold mb-1">
              {category === 'SCRIPTURE_OF_THE_DAY'
                ? 'Verse Text *'
                : hasAudioAttached
                ? 'Sermon Notes / Transcript (Optional with Audio)'
                : 'Full Content *'}
            </label>
            <textarea
              id="sp-pub-body"
              rows={hasAudioAttached ? 3 : 5}
              required={!hasAudioAttached}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={
                category === 'SCRIPTURE_OF_THE_DAY'
                  ? 'Enter scripture verse text...'
                  : hasAudioAttached
                  ? 'Optional notes or outline (audio sermon can be published with Title + Audio alone)...'
                  : 'Enter full sermon notes, devotional message, study outline, or prayer points...'
              }
              className="w-full p-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm"
            />
          </div>
        </div>

        <div className="flex gap-2.5 px-5 py-3.5 border-t border-[#E2E8F0] dark:border-[#374151] bg-[#F8FAFC] dark:bg-[#0B0F19] shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 min-h-[44px] rounded-xl bg-[#E2E8F0]/70 dark:bg-[#1F2937] text-[#0F172A] dark:text-white text-xs font-bold"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || importing || probingAudio}
            className="flex-1 min-h-[44px] rounded-xl bg-[#E11D48] hover:bg-[#9F1239] text-white text-sm font-bold disabled:opacity-60"
          >
            {saving
              ? uploadProgress
                ? `Uploading ${uploadProgress.done}/${uploadProgress.total}...`
                : isEditMode
                ? 'Updating...'
                : 'Publishing...'
              : isEditMode
              ? 'Save Changes'
              : 'Publish Resource'}
          </button>
        </div>
      </form>
    </div>
  );
};
