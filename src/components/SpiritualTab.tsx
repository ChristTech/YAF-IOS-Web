import React, { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  BookOpen,
  CheckCircle2,
  Library,
  Plus,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import {
  deleteSpiritualResource,
  fetchAndReassembleSermonAudioBlob,
  toggleBookmarkSpiritualResource,
} from '../services/fellowshipService';
import {
  canManageFellowship,
  formatActionErrorMessage,
} from '../utils/fellowshipLogic';
import {
  extractScriptureOfTheDayResources,
  extractSpiritualMemoryVerse,
  findLatestActiveAudioCloudId,
  hasPlayableAudioSermon,
  type ExtendedSpiritualKind,
  type SpiritualCategoryFilter,
} from '../utils/spiritualLogic';
import {
  loadOfflineSavedResources,
  purgeStaleOfflineAudioResources,
  readLocalBookmarkIds,
  removeResourceOffline,
  saveResourceOffline,
  shouldShowIosStorageEvictionTip,
} from '../utils/offlineStorage';
import {
  audioSermonPlayer,
  type AudioSermonPlayerState,
} from '../utils/audioSermonPlayer';
import { spiritualSpeech } from '../utils/speechPlayer';
import { MemoryVerseCard } from './spiritual/MemoryVerseCard';
import {
  SpiritualResourceCard,
  type DisplaySpiritualResource,
} from './spiritual/SpiritualResourceCard';
import { ResourceReaderDialog } from './spiritual/ResourceReaderDialog';
import { SpiritualPublishDialog } from './spiritual/SpiritualPublishDialog';
import { DeleteResourceDialog } from './spiritual/DeleteResourceDialog';
import { CopyShareFallbackDialog } from './spiritual/CopyShareFallbackDialog';
import { BibleReaderScreen } from './spiritual/BibleReaderScreen';
import type { TranslationStrings } from '../data/translations';
import type {
  DailyScriptureDoc,
  FellowshipAccount,
  LanguageCode,
  SpiritualResource,
  UploadedBibleDoc,
} from '../types/fellowship';

interface SpiritualTabProps {
  account: FellowshipAccount;
  resources: SpiritualResource[];
  uploadedBibles: UploadedBibleDoc[];
  scriptureDocs: DailyScriptureDoc[];
  language: LanguageCode;
  labels: TranslationStrings;
}

const FILTER_CHIPS: { id: SpiritualCategoryFilter; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'SCRIPTURE_OF_THE_DAY', label: 'SCRIPTURE OF THE DAY' },
  { id: 'SERMON', label: 'SERMON' },
  { id: 'DEVOTIONAL', label: 'DEVOTIONAL' },
  { id: 'BIBLE_STUDY', label: 'BIBLE STUDY' },
  { id: 'PRAYER_POINTS', label: 'PRAYER POINTS' },
];

function getCategoryLabel(cat: string): string {
  switch (cat) {
    case 'SCRIPTURE_OF_THE_DAY':
      return 'SCRIPTURE OF THE DAY';
    case 'SERMON':
      return 'SERMON';
    case 'BIBLE_STUDY':
      return 'BIBLE STUDY';
    case 'PRAYER_POINTS':
      return 'PRAYER POINTS';
    default:
      return 'DEVOTIONAL';
  }
}

export const SpiritualTab: React.FC<SpiritualTabProps> = ({
  account,
  resources,
  uploadedBibles,
  scriptureDocs,
  language,
  labels,
}) => {
  const [subTab, setSubTab] = useState<'devotionals' | 'bible'>('devotionals');
  const [categoryFilter, setCategoryFilter] = useState<SpiritualCategoryFilter>('ALL');
  const [showBookmarksOnly, setShowBookmarksOnly] = useState(false);

  // Offline IndexedDB bookmarks state
  const resolvedUserId = account.userId || account.id;
  const [localBookmarkIds, setLocalBookmarkIds] = useState<string[]>(() =>
    readLocalBookmarkIds(resolvedUserId)
  );
  const [offlineSavedResources, setOfflineSavedResources] = useState<SpiritualResource[]>([]);

  // Dialog states
  const [readerResource, setReaderResource] = useState<DisplaySpiritualResource | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishCategory, setPublishCategory] = useState<ExtendedSpiritualKind>('SERMON');
  const [editingResource, setEditingResource] = useState<DisplaySpiritualResource | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DisplaySpiritualResource | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Share fallback dialog + Toast + Error banner
  const [copyFallbackText, setCopyFallbackText] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [iosTipBanner, setIosTipBanner] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Audio playback state (TTS + HTML5 Sermon Player)
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);
  const [isAudioPaused, setIsAudioPaused] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioPlayerState, setAudioPlayerState] = useState<AudioSermonPlayerState>(() =>
    audioSermonPlayer.getState()
  );

  const isLeadership = canManageFellowship(account.role);

  useEffect(() => {
    setLocalBookmarkIds(readLocalBookmarkIds(resolvedUserId));
    void loadOfflineSavedResources(resolvedUserId).then(setOfflineSavedResources);
  }, [resolvedUserId]);

  useEffect(() => {
    return audioSermonPlayer.subscribe(setAudioPlayerState);
  }, []);

  // Remote Sync Deletion Parity: keep only the latest active audioCloudId in IndexedDB & stop stale playback
  useEffect(() => {
    const latestAudioCloudId = findLatestActiveAudioCloudId(resources);
    audioSermonPlayer.stopIfNotCloudId(latestAudioCloudId);
    void purgeStaleOfflineAudioResources(latestAudioCloudId).then(() => {
      void loadOfflineSavedResources(resolvedUserId).then(setOfflineSavedResources);
    });
  }, [resources, resolvedUserId]);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 4000);
    return () => clearTimeout(t);
  }, [toastMsg]);

  useEffect(() => {
    return () => {
      spiritualSpeech.stopSync();
      audioSermonPlayer.stop();
    };
  }, []);

  const memoryVerse = useMemo(
    () => extractSpiritualMemoryVerse(scriptureDocs, language),
    [scriptureDocs, language]
  );

  const allDisplayResources = useMemo<DisplaySpiritualResource[]>(() => {
    const sotdItems = extractScriptureOfTheDayResources(scriptureDocs);
    const map = new Map<string, DisplaySpiritualResource>();

    for (const r of resources) {
      map.set(r.id, {
        ...r,
        categoryKey: r.kind,
        categoryLabel: getCategoryLabel(r.kind),
      });
    }

    for (const s of sotdItems) {
      map.set(s.id, {
        ...s,
        categoryKey: 'SCRIPTURE_OF_THE_DAY',
        categoryLabel: 'SCRIPTURE OF THE DAY',
      });
    }

    for (const off of offlineSavedResources) {
      if (!map.has(off.id)) {
        map.set(off.id, {
          ...off,
          categoryKey: off.kind,
          categoryLabel: getCategoryLabel(off.kind),
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [resources, scriptureDocs, offlineSavedResources]);

  const isResourceBookmarked = (res: SpiritualResource) =>
    localBookmarkIds.includes(res.id) ||
    res.bookmarkedBy.includes(resolvedUserId) ||
    res.bookmarkedBy.includes(account.id);

  const bookmarkedCount = useMemo(
    () => allDisplayResources.filter(isResourceBookmarked).length,
    [allDisplayResources, localBookmarkIds, resolvedUserId, account.id]
  );

  const filteredResources = useMemo(() => {
    return allDisplayResources.filter((r) => {
      if (showBookmarksOnly && !isResourceBookmarked(r)) {
        return false;
      }
      if (categoryFilter !== 'ALL' && r.categoryKey !== categoryFilter) {
        return false;
      }
      return true;
    });
  }, [allDisplayResources, showBookmarksOnly, categoryFilter, localBookmarkIds, resolvedUserId, account.id]);

  const startOrToggleSpeechSync = (res: DisplaySpiritualResource) => {
    if (hasPlayableAudioSermon(res)) {
      void handleToggleSermonAudio(res);
      return;
    }
    audioSermonPlayer.stop();
    setErrorBanner(null);
    const status = spiritualSpeech.getStatus();

    // Synchronous toggle if same resource is already loaded
    if (status.activeResourceId === res.id && activeAudioId === res.id) {
      if (isAudioPaused) {
        spiritualSpeech.resumeSync();
        setIsAudioPaused(false);
      } else {
        spiritualSpeech.pauseSync();
        setIsAudioPaused(true);
      }
      return;
    }

    const narrationText = `${res.title}. ${res.scriptureRef}. By ${res.speaker}. ${res.body}`;
    spiritualSpeech.speakSync({
      resourceId: res.id,
      title: res.title,
      speakerOrAuthor: res.speaker,
      text: narrationText,
      language,
      callbacks: {
        onStart: () => {
          setActiveAudioId(res.id);
          setIsAudioPaused(false);
          setAudioProgress(0.05);
        },
        onProgress: (progress) => {
          setAudioProgress(progress);
        },
        onPauseChange: (paused) => {
          setIsAudioPaused(paused);
        },
        onEnd: () => {
          setActiveAudioId(null);
          setIsAudioPaused(false);
          setAudioProgress(0);
        },
        onError: (msg) => {
          setActiveAudioId(null);
          setIsAudioPaused(false);
          setAudioProgress(0);
          setErrorBanner(msg);
        },
      },
    });
  };

  const handleStopAudioSync = () => {
    spiritualSpeech.stopSync();
    setActiveAudioId(null);
    setIsAudioPaused(false);
    setAudioProgress(0);
  };

  const handleToggleSermonAudio = async (res: DisplaySpiritualResource) => {
    setErrorBanner(null);
    handleStopAudioSync();
    await audioSermonPlayer.playOrToggle({
      resource: res,
      fetchBlobFn: (target) => fetchAndReassembleSermonAudioBlob(target),
    });
  };

  const handleToggleBookmark = async (res: DisplaySpiritualResource) => {
    const currentlyBookmarked = isResourceBookmarked(res);
    if (currentlyBookmarked) {
      const nextIds = await removeResourceOffline(resolvedUserId, res.id);
      setLocalBookmarkIds(nextIds);
      setOfflineSavedResources((prev) => prev.filter((item) => item.id !== res.id));
      setToastMsg('Removed from Saved Offline');
    } else {
      const nextIds = await saveResourceOffline(resolvedUserId, res);
      setLocalBookmarkIds(nextIds);
      setOfflineSavedResources((prev) =>
        prev.some((item) => item.id === res.id) ? prev : [res, ...prev]
      );
      setToastMsg('Saved offline for reading anytime');
      if (shouldShowIosStorageEvictionTip()) {
        setIosTipBanner(
          'Tip for iPhone/iPad: Tap Share → Add to Home Screen so your offline saved sermons and Bibles are never cleared after 7 days.'
        );
      }
    }

    // Sync bookmark state to Firestore for real docs (skip local seed ids)
    if (!res.id.startsWith('seed-')) {
      void toggleBookmarkSpiritualResource(res.id, res, resolvedUserId);
    }
  };

  const handleShareResource = (res: DisplaySpiritualResource) => {
    const shareTitle = `${res.title} • ${res.scriptureRef}`;
    const shareText = `${res.title}\nScripture: ${res.scriptureRef}\nBy: ${res.speaker}\n\n${res.body}\n\n— The Gideonites (The Youth Alive Fellowship)`;

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      // Must be triggered directly inside onClick handler on iOS Safari
      navigator
        .share({ title: shareTitle, text: shareText })
        .catch((err) => {
          const errName = (err as { name?: string })?.name;
          if (errName === 'AbortError') {
            return; // user dismissed sheet
          }
          fallbackCopyShare(shareText);
        });
      return;
    }

    fallbackCopyShare(shareText);
  };

  const fallbackCopyShare = (shareText: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(shareText)
        .then(() => {
          setToastMsg('Copied spiritual message to clipboard');
        })
        .catch(() => {
          setCopyFallbackText(shareText);
        });
    } else {
      setCopyFallbackText(shareText);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setErrorBanner(null);
    const targetId = deleteTarget.id;

    try {
      const nextIds = await removeResourceOffline(resolvedUserId, targetId);
      setLocalBookmarkIds(nextIds);
      setOfflineSavedResources((prev) => prev.filter((item) => item.id !== targetId));

      if (!targetId.startsWith('seed-')) {
        await deleteSpiritualResource(targetId, deleteTarget.audioCloudId);
      }

      audioSermonPlayer.stopIfResource(targetId);
      if (activeAudioId === targetId) {
        handleStopAudioSync();
      }
      if (readerResource?.id === targetId) {
        setReaderResource(null);
      }
      setDeleteTarget(null);
      setToastMsg('Resource deleted');
    } catch (err) {
      setErrorBanner(formatActionErrorMessage(err, 'Unable to delete spiritual resource.'));
    } finally {
      setDeleting(false);
    }
  };

  const openCreateModal = (cat: ExtendedSpiritualKind) => {
    setEditingResource(null);
    setPublishCategory(cat);
    setPublishOpen(true);
  };

  const openEditModal = (res: DisplaySpiritualResource) => {
    setEditingResource(res);
    setPublishCategory((res.categoryKey || res.kind || 'SERMON') as ExtendedSpiritualKind);
    setPublishOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Toast Feedback */}
      {toastMsg && (
        <div
          role="status"
          className="rounded-xl bg-[#0F172A] text-white border border-[#F59E0B]/60 px-4 py-2.5 text-xs font-semibold flex items-center justify-between gap-2 shadow-lg"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#4ADE80] shrink-0" />
            <span>{toastMsg}</span>
          </div>
          <button
            type="button"
            aria-label="Dismiss status"
            onClick={() => setToastMsg(null)}
            className="p-1 text-[#94A3B8] hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* iOS Non-Standalone Storage Eviction Tip */}
      {iosTipBanner && (
        <div
          role="status"
          className="rounded-2xl bg-[#FEF3C7] dark:bg-[#F59E0B]/15 border border-[#F59E0B] px-4 py-3 text-xs text-[#92400E] dark:text-[#FCD34D] flex items-start justify-between gap-3"
        >
          <p className="font-semibold leading-relaxed">{iosTipBanner}</p>
          <button
            type="button"
            aria-label="Dismiss iOS storage tip"
            onClick={() => setIosTipBanner(null)}
            className="p-1 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Alert Banner */}
      {errorBanner && (
        <div
          role="alert"
          className="rounded-2xl bg-[#FFF1F2] dark:bg-[#9F1239]/25 border border-[#E11D48]/40 px-4 py-3 text-xs font-semibold text-[#9F1239] dark:text-[#FECDD3] flex items-center justify-between gap-3"
        >
          <span>{errorBanner}</span>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setErrorBanner(null)}
            className="min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sticky Top Secondary Tab Bar */}
      <div
        role="tablist"
        aria-label="Spiritual Hub Sections"
        className="sticky top-[57px] z-20 grid grid-cols-2 bg-white/95 dark:bg-[#111827]/95 backdrop-blur-sm border border-[#E2E8F0] dark:border-[#374151] rounded-2xl p-1.5 gap-1.5 shadow-xs"
      >
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'devotionals'}
          onClick={() => setSubTab('devotionals')}
          className={`min-h-[44px] px-3 rounded-xl text-xs sm:text-sm font-bold transition-colors ${
            subTab === 'devotionals'
              ? 'bg-[#E11D48] text-white shadow-xs'
              : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white'
          }`}
        >
          {labels.spiritual.tabDevotionals}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'bible'}
          onClick={() => setSubTab('bible')}
          className={`min-h-[44px] px-3 rounded-xl text-xs sm:text-sm font-bold transition-colors ${
            subTab === 'bible'
              ? 'bg-[#E11D48] text-white shadow-xs'
              : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white'
          }`}
        >
          {labels.spiritual.tabBibleExplorer}
        </button>
      </div>

      {subTab === 'devotionals' ? (
        <div className="space-y-4 pb-safe-scroll">
          {/* 1. Scripture for the Day & Memory Verse Challenge Card */}
          <MemoryVerseCard
            memoryVerse={memoryVerse}
            language={language}
            labels={labels.spiritual}
            isLeadership={isLeadership}
            onPostScripture={() => openCreateModal('SCRIPTURE_OF_THE_DAY')}
          />

          {/* 2. Admin & Executive Publishing Card (Leadership Only) */}
          {isLeadership && (
            <section className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#E11D48]" />
                  <p className="text-[11px] font-extrabold tracking-wider uppercase text-[#E11D48]">
                    ADMIN &amp; EXECUTIVE PUBLISHING
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8]">
                  Live Firestore Sync
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => openCreateModal('SERMON')}
                  className="min-h-[44px] px-4 rounded-xl bg-[#E11D48] hover:bg-[#9F1239] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload Sermon</span>
                </button>
                <button
                  type="button"
                  onClick={() => openCreateModal('DEVOTIONAL')}
                  className="min-h-[44px] px-4 rounded-xl border border-[#0F172A] dark:border-[#F59E0B] text-[#0F172A] dark:text-[#FCD34D] hover:bg-[#F8FAFC] dark:hover:bg-[#1F2937] text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Daily Devotional</span>
                </button>
              </div>
            </section>
          )}

          {/* 3. Horizontal Category & Bookmark Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <button
              type="button"
              aria-pressed={showBookmarksOnly}
              onClick={() => setShowBookmarksOnly((prev) => !prev)}
              className={`min-h-[40px] px-3.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-colors ${
                showBookmarksOnly
                  ? 'bg-[#F59E0B] text-[#0F172A]'
                  : 'bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] text-[#334155] dark:text-[#CBD5E1]'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${showBookmarksOnly ? 'fill-[#0F172A]' : ''}`} />
              <span>
                {labels.spiritual.savedOffline} ({bookmarkedCount})
              </span>
            </button>

            {FILTER_CHIPS.map((chip) => {
              const active = !showBookmarksOnly && categoryFilter === chip.id;
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => {
                    setShowBookmarksOnly(false);
                    setCategoryFilter(chip.id);
                  }}
                  className={`min-h-[40px] px-3.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'bg-[#E11D48] text-white'
                      : 'bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] text-[#334155] dark:text-[#CBD5E1]'
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>

          {/* 4. Resource Cards or Empty States */}
          {filteredResources.length === 0 ? (
            <section className="rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-[#F1F5F9] dark:bg-[#1F2937] text-[#F59E0B] flex items-center justify-center mx-auto">
                {showBookmarksOnly ? (
                  <Bookmark className="w-6 h-6" />
                ) : (
                  <Library className="w-6 h-6" />
                )}
              </div>
              <div className="space-y-1">
                <h3 className="font-display text-base font-bold text-[#0F172A] dark:text-white">
                  {showBookmarksOnly ? 'No Saved Resources' : 'Word & Audio Library'}
                </h3>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] max-w-sm mx-auto">
                  {showBookmarksOnly
                    ? 'Tap the bookmark icon or "Save Offline" on any sermon or devotional to read anytime—even without internet.'
                    : 'No teachings match this category yet. Switch filters or publish a new fellowship resource.'}
                </p>
              </div>
              {showBookmarksOnly && (
                <button
                  type="button"
                  onClick={() => {
                    setShowBookmarksOnly(false);
                    setCategoryFilter('ALL');
                  }}
                  className="min-h-[44px] px-5 rounded-xl bg-[#E11D48] text-white text-xs font-bold"
                >
                  Show All Resources
                </button>
              )}
            </section>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {filteredResources.map((res) => (
                <SpiritualResourceCard
                  key={res.id}
                  resource={res}
                  isBookmarked={isResourceBookmarked(res)}
                  isLeadership={isLeadership}
                  isActiveAudio={activeAudioId === res.id}
                  isPaused={activeAudioId === res.id && isAudioPaused}
                  audioProgress={activeAudioId === res.id ? audioProgress : 0}
                  audioPlayerState={audioPlayerState}
                  labels={labels.spiritual}
                  onToggleBookmark={() => void handleToggleBookmark(res)}
                  onEdit={() => openEditModal(res)}
                  onDelete={() => setDeleteTarget(res)}
                  onToggleListen={() => startOrToggleSpeechSync(res)}
                  onStopAudio={handleStopAudioSync}
                  onToggleSermonAudio={() => void handleToggleSermonAudio(res)}
                  onSeekSermonAudio={(secs) => audioSermonPlayer.seek(secs)}
                  onSkipSermonAudio={(delta) => audioSermonPlayer.skipBy(delta)}
                  onStopSermonAudio={() => audioSermonPlayer.stop()}
                  onReadFull={() => setReaderResource(res)}
                />
              ))}
            </div>
          )}

          {/* Leadership Floating Action Button */}
          {isLeadership && (
            <button
              type="button"
              aria-label="Publish Resource"
              onClick={() => openCreateModal('SERMON')}
              className="fixed bottom-safe-fab right-4 sm:right-6 z-20 inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#E11D48] hover:bg-[#9F1239] text-white shadow-lg transition-transform active:scale-95"
            >
              <Plus className="w-6 h-6" />
            </button>
          )}
        </div>
      ) : (
        <BibleReaderScreen
          account={account}
          isLeadership={isLeadership}
          language={language}
          labels={labels.spiritual}
          uploadedBibles={uploadedBibles}
          scriptureDocs={scriptureDocs}
        />
      )}

      {/* Full Message Reader Modal */}
      <ResourceReaderDialog
        resource={readerResource}
        isBookmarked={readerResource ? isResourceBookmarked(readerResource) : false}
        isActiveAudio={Boolean(readerResource && activeAudioId === readerResource.id)}
        audioProgress={
          readerResource && activeAudioId === readerResource.id ? audioProgress : 0
        }
        audioPlayerState={audioPlayerState}
        labels={labels.spiritual}
        onClose={() => setReaderResource(null)}
        onToggleAudio={() => {
          if (!readerResource) return;
          if (activeAudioId === readerResource.id) {
            handleStopAudioSync();
          } else {
            startOrToggleSpeechSync(readerResource);
          }
        }}
        onToggleSermonAudio={() => {
          if (readerResource) {
            void handleToggleSermonAudio(readerResource);
          }
        }}
        onSeekSermonAudio={(secs) => audioSermonPlayer.seek(secs)}
        onSkipSermonAudio={(delta) => audioSermonPlayer.skipBy(delta)}
        onStopSermonAudio={() => audioSermonPlayer.stop()}
        onShare={() => readerResource && handleShareResource(readerResource)}
        onToggleBookmark={() =>
          readerResource && void handleToggleBookmark(readerResource)
        }
      />

      {/* Unified Create / Edit Publish Resource Dialog */}
      <SpiritualPublishDialog
        isOpen={publishOpen}
        initialCategory={publishCategory}
        editingResource={editingResource}
        account={account}
        onClose={() => {
          setPublishOpen(false);
          setEditingResource(null);
        }}
        onSuccess={(msg) => setToastMsg(msg)}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteResourceDialog
        isOpen={Boolean(deleteTarget)}
        resourceTitle={deleteTarget?.title || ''}
        deleting={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirmDelete={() => void handleConfirmDelete()}
      />

      {/* Copy Share Fallback Dialog */}
      <CopyShareFallbackDialog
        isOpen={Boolean(copyFallbackText)}
        shareText={copyFallbackText || ''}
        onClose={() => setCopyFallbackText(null)}
        onCopied={() => {
          setCopyFallbackText(null);
          setToastMsg('Copied spiritual message to clipboard');
        }}
      />
    </div>
  );
};
