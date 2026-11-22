import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Crown,
  Edit3,
  Gamepad2,
  Megaphone,
  Play,
  Plus,
  Rocket,
  Shield,
  Sparkles,
  Trash2,
  Trophy,
  X,
} from 'lucide-react';
import type { BibleVerseItem } from '../data/bibleData';
import {
  PresetGameSessions,
  buildLocalizedSessionTitles,
} from '../data/presetGameSessions';
import type { TranslationStrings } from '../data/translations';
import {
  broadcastGameTimeAlert,
  cancelMultiplayerSession,
  deleteDraftSession,
  deleteGameScore,
  deleteSoloGameQuiz,
  endMultiplayerSession,
  launchDraftSession,
  publishMultiplayerSession,
  startScheduledSessionNow,
} from '../services/fellowshipService';
import type {
  DailyScriptureDoc,
  FellowshipAccount,
  GameQuiz,
  GameScore,
  GameType,
  LanguageCode,
  QuizSession,
  UploadedBibleDoc,
} from '../types/fellowship';
import {
  formatActionErrorMessage,
  getDisplayNameForAccount,
} from '../utils/fellowshipLogic';
import {
  getGameTypeDefaultTimer,
  getGameTypeDisplayName,
  getGamesHeaderBannerMeta,
  getLanguageShortBadge,
  getMemberProgressStats,
  getSessionTitle,
  isGamesAdmin,
  isGamesGuest,
  isGamesLeadership,
  normalizeSessionStatus,
} from '../utils/gamesLogic';
import { BiblePickerModal } from './BiblePickerModal';
import { ActiveQuizRunner } from './games/ActiveQuizRunner';
import { CreateMultiplayerGameModal } from './games/CreateMultiplayerGameModal';
import { CreateSoloQuizModal } from './games/CreateSoloQuizModal';
import { MultiplayerGameArena } from './games/MultiplayerGameArena';

interface GamesTabProps {
  account: FellowshipAccount;
  quizSessions: QuizSession[];
  gameQuizzes: GameQuiz[];
  gameScores: GameScore[];
  isGameTimeActive: boolean;
  uploadedBibles: UploadedBibleDoc[];
  scriptureDocs: DailyScriptureDoc[];
  language: LanguageCode;
  labels: TranslationStrings;
}

const INSTANT_GAME_MODES: {
  mode: GameType;
  emoji: string;
  title: string;
  subtitle: string;
  timerText: string;
}[] = [
  {
    mode: 'TRIVIA_CHALLENGE',
    emoji: '⚡',
    title: 'Trivia Challenge',
    subtitle: '4 Options & Speed',
    timerText: '20s per question',
  },
  {
    mode: 'WHO_AM_I',
    emoji: '🕵️',
    title: 'Who Am I?',
    subtitle: 'Progressive Clues',
    timerText: '30s per question',
  },
  {
    mode: 'SCRIPTURE_SCRAMBLE',
    emoji: '🧩',
    title: 'Scripture Scramble',
    subtitle: 'Verse Scramble',
    timerText: '30s per question',
  },
];

export const GamesTab: React.FC<GamesTabProps> = ({
  account,
  quizSessions,
  gameQuizzes,
  gameScores,
  isGameTimeActive,
  uploadedBibles,
  scriptureDocs,
  language,
}) => {
  const isAdmin = isGamesAdmin(account.role);
  const isLeadership = isGamesLeadership(account.role);
  const isGuest = isGamesGuest(account.role);
  const displayName = getDisplayNameForAccount(account);
  const bannerMeta = useMemo(() => getGamesHeaderBannerMeta(account.role), [account.role]);
  const langBadge = getLanguageShortBadge(language);
  const currentUserId = account.userId || account.id;

  // Arena / Solo runner overlay states
  const [arenaSession, setArenaSession] = useState<QuizSession | null>(null);
  const [activeSoloQuiz, setActiveSoloQuiz] = useState<GameQuiz | null>(null);

  // Modals
  const [showCreateMultiplayer, setShowCreateMultiplayer] = useState(false);
  const [editingDraftSession, setEditingDraftSession] = useState<QuizSession | null>(null);
  const [preselectedVerseForCreate, setPreselectedVerseForCreate] = useState<
    (BibleVerseItem & { translation?: string }) | null
  >(null);
  const [showCreateSoloQuiz, setShowCreateSoloQuiz] = useState(false);
  const [showBibleDbModal, setShowBibleDbModal] = useState(false);

  // Feedback & busy states
  const [busyActionId, setBusyActionId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    window.setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  };

  // Partition /quiz_sessions strictly by normalized status
  const {
    activeMultiplayerSession,
    scheduledSessions,
    upcomingAndActiveSessions,
    draftSessions,
    recentCompletedSessions,
  } = useMemo(() => {
    const sorted = [...quizSessions].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const active = sorted.find((s) => normalizeSessionStatus(s.status) === 'ACTIVE') || null;
    const scheduled = sorted.filter((s) => normalizeSessionStatus(s.status) === 'SCHEDULED');
    const drafts = sorted.filter((s) => normalizeSessionStatus(s.status) === 'DRAFT');
    const completed = sorted
      .filter((s) => normalizeSessionStatus(s.status) === 'COMPLETED')
      .slice(0, 5);
    return {
      activeMultiplayerSession: active,
      scheduledSessions: scheduled,
      upcomingAndActiveSessions: sorted.filter((s) => {
        const st = normalizeSessionStatus(s.status);
        return st === 'ACTIVE' || st === 'SCHEDULED';
      }),
      draftSessions: drafts,
      recentCompletedSessions: completed,
    };
  }, [quizSessions]);

  const memberStats = useMemo(
    () => getMemberProgressStats(gameScores, account),
    [gameScores, account]
  );

  const sortedQuizzes = useMemo(
    () => [...gameQuizzes].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    [gameQuizzes]
  );

  const topLeaderboardScores = useMemo(
    () =>
      [...gameScores]
        .sort((a, b) => {
          if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
          return (a.timeTakenSeconds || 0) - (b.timeTakenSeconds || 0);
        })
        .slice(0, 20),
    [gameScores]
  );

  // Instant 3-Mode Launcher with solo fallback if multiplayer creation fails
  const handlePlayModeNow = async (mode: GameType) => {
    const existing = upcomingAndActiveSessions.find((s) => s.gameType === mode);
    if (existing) {
      setArenaSession(existing);
      return;
    }

    setBusyActionId(`mode:${mode}`);
    try {
      const titles = buildLocalizedSessionTitles(mode);
      const created = await publishMultiplayerSession({
        host: account,
        titleEn: titles.titleEn,
        titleYo: titles.titleYo,
        titleHa: titles.titleHa,
        titleIg: titles.titleIg,
        description: `Instant ${getGameTypeDisplayName(mode)} Live Showdown`,
        gameType: mode,
        delayMinutes: 0,
        timeLimitPerQuestionSeconds: getGameTypeDefaultTimer(mode),
        leaderboardDurationSeconds: 8,
        baseScorePerQuestion: 100,
        speedBonusEnabled: true,
        maxSpeedBonus: 50,
        penaltyForIncorrect: false,
        questions: PresetGameSessions.getPresetQuestions(mode, language),
      });
      setArenaSession(created);
    } catch {
      // Fall back cleanly to Sunday Fellowship Live Showdown Solo Arena
      const soloQuestions = PresetGameSessions.getSoloFallbackQuestions(language).slice(0, 4);
      const fallbackQuiz: GameQuiz = {
        id: `fallback_${mode.toLowerCase()}_${Date.now()}`,
        createdById: currentUserId,
        fellowshipId: 'GIDEONITES',
        title: 'Sunday Fellowship Live Showdown',
        description: `${getGameTypeDisplayName(mode)} • Solo Arena Fallback`,
        category: 'BIBLE_TRIVIA',
        questionsJson: JSON.stringify(soloQuestions),
        totalQuestions: soloQuestions.length,
        timeLimitSeconds: soloQuestions.length * 15,
        difficulty: 'Medium',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setActiveSoloQuiz(fallbackQuiz);
    } finally {
      setBusyActionId(null);
    }
  };

  const handleAlertAll = async () => {
    setBusyActionId('alert-all');
    try {
      await broadcastGameTimeAlert(displayName);
      showFeedback('success', 'GAME_TIME alert sent to all fellowship devices.');
    } catch (err) {
      showFeedback('error', formatActionErrorMessage(err, 'Could not broadcast Game Time alert.'));
    } finally {
      setBusyActionId(null);
    }
  };

  const handleEndActiveGame = async (sessionId: string) => {
    setBusyActionId(`end:${sessionId}`);
    try {
      await endMultiplayerSession(sessionId);
      showFeedback('success', 'Live showdown ended and final podium locked.');
    } catch (err) {
      showFeedback('error', formatActionErrorMessage(err, 'Failed to end live showdown.'));
    } finally {
      setBusyActionId(null);
    }
  };

  const handleStartScheduled = async (session: QuizSession) => {
    setBusyActionId(`start:${session.id}`);
    try {
      await startScheduledSessionNow(session);
      setArenaSession({
        ...session,
        status: 'ACTIVE',
        currentSubstate: 'QUESTION_OPEN',
      });
    } catch (err) {
      showFeedback('error', formatActionErrorMessage(err, 'Could not start scheduled session.'));
    } finally {
      setBusyActionId(null);
    }
  };

  const handleCancelScheduled = async (sessionId: string) => {
    setBusyActionId(`cancel:${sessionId}`);
    try {
      await cancelMultiplayerSession(sessionId);
      showFeedback('success', 'Scheduled showdown cancelled.');
    } catch (err) {
      showFeedback('error', formatActionErrorMessage(err, 'Could not cancel session.'));
    } finally {
      setBusyActionId(null);
    }
  };

  const handleLaunchDraft = async (draft: QuizSession) => {
    setBusyActionId(`launch:${draft.id}`);
    try {
      const live = await launchDraftSession(draft, account);
      setArenaSession(live);
    } catch (err) {
      showFeedback('error', formatActionErrorMessage(err, 'Could not launch saved draft.'));
    } finally {
      setBusyActionId(null);
    }
  };

  const handleDeleteDraft = async (draftId: string) => {
    setBusyActionId(`del-draft:${draftId}`);
    try {
      await deleteDraftSession(draftId);
      showFeedback('success', 'Saved draft deleted.');
    } catch (err) {
      showFeedback('error', formatActionErrorMessage(err, 'Could not delete draft.'));
    } finally {
      setBusyActionId(null);
    }
  };

  const handleDeleteSoloQuiz = async (quizId: string) => {
    if (!isAdmin) return;
    setBusyActionId(`del-quiz:${quizId}`);
    try {
      await deleteSoloGameQuiz(quizId);
      showFeedback('success', 'Quiz deleted.');
    } catch (err) {
      showFeedback('error', formatActionErrorMessage(err, 'Could not delete quiz.'));
    } finally {
      setBusyActionId(null);
    }
  };

  const handleDeleteScore = async (scoreId: string) => {
    if (!isAdmin) return;
    setBusyActionId(`del-score:${scoreId}`);
    try {
      await deleteGameScore(scoreId);
      showFeedback('success', 'Leaderboard score removed.');
    } catch (err) {
      showFeedback('error', formatActionErrorMessage(err, 'Could not delete score.'));
    } finally {
      setBusyActionId(null);
    }
  };

  // Full-screen Multiplayer Arena overlay
  if (arenaSession) {
    return (
      <MultiplayerGameArena
        initialSession={arenaSession}
        account={account}
        language={language}
        onExit={() => setArenaSession(null)}
      />
    );
  }

  // Full-screen Solo Quiz Runner overlay
  if (activeSoloQuiz) {
    return (
      <ActiveQuizRunner
        quiz={activeSoloQuiz}
        account={account}
        onExit={() => setActiveSoloQuiz(null)}
      />
    );
  }

  return (
    <div className="space-y-5 pb-[calc(7rem+env(safe-area-inset-bottom))]">
      {/* 2.1 Top Header Banner */}
      <section className="bg-[#0F172A] text-white rounded-b-[24px] rounded-t-2xl p-5 shadow-lg border border-slate-800">
        <div className="flex items-start gap-3.5">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center shrink-0 border"
            style={{
              backgroundColor: `${bannerMeta.accentHex}22`,
              borderColor: `${bannerMeta.accentHex}66`,
              color: bannerMeta.accentHex,
            }}
          >
            <Gamepad2 className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span
                className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md"
                style={{
                  backgroundColor: `${bannerMeta.accentHex}26`,
                  color: bannerMeta.accentHex,
                }}
              >
                {bannerMeta.subtitle}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-200 border border-slate-700">
                {langBadge}
              </span>
            </div>
            <h1 className="font-display text-base sm:text-lg font-extrabold leading-snug text-white">
              {bannerMeta.title}
            </h1>
          </div>
        </div>
      </section>

      {/* Inline Feedback Banner */}
      {toast && (
        <div
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-xs font-bold border shadow-sm ${
            toast.type === 'error'
              ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900'
              : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Feed 1: Active Multiplayer Showdown Card */}
      {activeMultiplayerSession ? (
        <section className="bg-[#E11D48] text-white rounded-3xl p-5 shadow-lg shadow-rose-900/20 border border-rose-400/40 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-white/20">
              LIVE SHOWDOWN ACTIVE
            </span>
            <span className="text-xs font-bold bg-black/25 px-2.5 py-1 rounded-lg">
              PIN: {activeMultiplayerSession.roomPin}
            </span>
          </div>
          <div>
            <h2 className="font-display text-xl font-black leading-tight">
              {getSessionTitle(activeMultiplayerSession, language)} 🎮
            </h2>
            <p className="text-sm text-rose-100 mt-1">
              {getGameTypeDisplayName(activeMultiplayerSession.gameType)} • Round{' '}
              {activeMultiplayerSession.currentQuestionIndex + 1} of{' '}
              {activeMultiplayerSession.totalQuestions}
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => setArenaSession(activeMultiplayerSession)}
              className="touch-manipulation min-h-[44px] flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white text-[#E11D48] text-sm font-black shadow-md hover:bg-rose-50"
            >
              <Play className="w-4 h-4" />
              Jump Into Live Showdown
            </button>
            {isLeadership && (
              <button
                type="button"
                disabled={busyActionId === `end:${activeMultiplayerSession.id}`}
                onClick={() => void handleEndActiveGame(activeMultiplayerSession.id)}
                className="touch-manipulation min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-white/60 text-white text-xs font-bold hover:bg-white/10 disabled:opacity-50"
              >
                End Game
              </button>
            )}
          </div>
        </section>
      ) : isGameTimeActive ? (
        <section className="bg-rose-50 dark:bg-rose-950/30 border-2 border-[#E11D48]/50 rounded-3xl p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-[#E11D48] text-white">
              LIVE GAME ARENA
            </span>
          </div>
          <h2 className="font-display text-lg font-extrabold text-[#0F172A] dark:text-white">
            Sunday Youth Live Showdown 🎮
          </h2>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => {
                if (upcomingAndActiveSessions.length > 0) {
                  setArenaSession(upcomingAndActiveSessions[0]);
                } else {
                  void handlePlayModeNow('TRIVIA_CHALLENGE');
                }
              }}
              className="touch-manipulation min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#E11D48] text-white text-sm font-black hover:bg-rose-700"
            >
              <Play className="w-4 h-4" />
              Enter Live Arena Now
            </button>
            {isLeadership && (
              <button
                type="button"
                disabled={busyActionId === 'alert-all'}
                onClick={() => void handleAlertAll()}
                className="touch-manipulation min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#F59E0B] text-[#0F172A] text-xs font-black hover:bg-amber-400 disabled:opacity-50"
              >
                <Megaphone className="w-4 h-4" />
                📢 Alert All
              </button>
            )}
          </div>
        </section>
      ) : null}

      {/* Feed 2: Scheduled Multiplayer Showdowns */}
      {scheduledSessions.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-[#64748B] dark:text-slate-400 px-1">
            SCHEDULED MULTIPLAYER SHOWDOWNS ({scheduledSessions.length})
          </h3>
          <div className="space-y-3">
            {scheduledSessions.map((session) => (
              <div
                key={session.id}
                className="bg-white dark:bg-[#0F172A] border-2 border-[#F59E0B]/70 rounded-2xl p-4 shadow-sm space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#0F172A] dark:text-slate-200">
                    {getGameTypeDisplayName(session.gameType)}
                  </span>
                  <span className="text-[11px] font-black px-2.5 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                    ⏰ Scheduled
                  </span>
                </div>
                <div>
                  <h4 className="font-display text-base font-extrabold text-[#0F172A] dark:text-white">
                    {getSessionTitle(session, language)}
                  </h4>
                  <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                    {session.totalQuestions} Rounds • {session.timeLimitPerQuestionSeconds}s per
                    question
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setArenaSession(session)}
                    className="touch-manipulation min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0F172A] dark:bg-slate-800 text-white text-xs font-bold hover:bg-slate-800 dark:hover:bg-slate-700"
                  >
                    <Clock className="w-3.5 h-3.5" />
                    Enter Lobby
                  </button>
                  {isLeadership && (
                    <>
                      <button
                        type="button"
                        disabled={busyActionId === `start:${session.id}`}
                        onClick={() => void handleStartScheduled(session)}
                        className="touch-manipulation min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#E11D48] text-white text-xs font-bold hover:bg-rose-700 disabled:opacity-50"
                      >
                        <Rocket className="w-3.5 h-3.5" />
                        🚀 Start
                      </button>
                      <button
                        type="button"
                        disabled={busyActionId === `cancel:${session.id}`}
                        onClick={() => void handleCancelScheduled(session.id)}
                        className="touch-manipulation min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Feed 3: Saved Game Drafts (Admin & Youth Executive ONLY) */}
      {isLeadership && draftSessions.length > 0 && (
        <section className="space-y-3" data-testid="saved-game-drafts">
          <h3 className="text-xs font-black uppercase tracking-wider text-[#64748B] dark:text-slate-400 px-1">
            SAVED GAME DRAFTS ({draftSessions.length})
          </h3>
          <div className="space-y-3">
            {draftSessions.map((draft) => (
              <div
                key={draft.id}
                className="bg-white dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 rounded-2xl p-4 shadow-sm space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#0F172A] dark:text-slate-200">
                    {getGameTypeDisplayName(draft.gameType)}
                  </span>
                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    DRAFT • SAVED FOR LATER
                  </span>
                </div>
                <div>
                  <h4 className="font-display text-base font-extrabold text-[#0F172A] dark:text-white">
                    {getSessionTitle(draft, language)}
                  </h4>
                  <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                    {draft.totalQuestions} Rounds • {draft.timeLimitPerQuestionSeconds}s/q •{' '}
                    {draft.baseScorePerQuestion}p base
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPreselectedVerseForCreate(null);
                      setEditingDraftSession(draft);
                      setShowCreateMultiplayer(true);
                    }}
                    className="touch-manipulation min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Edit Draft
                  </button>
                  <button
                    type="button"
                    disabled={busyActionId === `launch:${draft.id}`}
                    onClick={() => void handleLaunchDraft(draft)}
                    className="touch-manipulation min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#E11D48] text-white text-xs font-bold hover:bg-rose-700 disabled:opacity-50"
                  >
                    <Rocket className="w-3.5 h-3.5" />
                    Launch Now
                  </button>
                  <button
                    type="button"
                    disabled={busyActionId === `del-draft:${draft.id}`}
                    onClick={() => void handleDeleteDraft(draft.id)}
                    className="touch-manipulation min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 text-xs font-bold hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Feed 4: Standby Arena Banner */}
      {!activeMultiplayerSession && !isGameTimeActive && (
        <section className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-3">
          <span className="inline-block text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[#64748B] dark:text-slate-300">
            LIVE ARENA • STANDBY
          </span>
          <div>
            <h2 className="font-display text-lg font-extrabold text-[#0F172A] dark:text-white">
              Live Scripture Showdown Arena 🎮
            </h2>
            <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1">
              {isLeadership
                ? 'Schedule a Youth Alive showdown, broadcast a live Game Time alert, or pick verses from the synced Executive Bible DB.'
                : 'Pick any of the 3 live Bible modes below to start playing or join your fellowship arena in real time.'}
            </p>
          </div>
          {isLeadership && (
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setEditingDraftSession(null);
                  setPreselectedVerseForCreate(null);
                  setShowCreateMultiplayer(true);
                }}
                className="touch-manipulation min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#E11D48] text-white text-xs font-bold hover:bg-rose-700"
              >
                <Calendar className="w-3.5 h-3.5" />
                🎮 Create / Schedule Game
              </button>
              <button
                type="button"
                disabled={busyActionId === 'alert-all'}
                onClick={() => void handleAlertAll()}
                className="touch-manipulation min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#F59E0B] text-[#0F172A] text-xs font-black hover:bg-amber-400 disabled:opacity-50"
              >
                <Megaphone className="w-3.5 h-3.5" />
                📢 Alert All
              </button>
              <button
                type="button"
                onClick={() => setShowBibleDbModal(true)}
                className="touch-manipulation min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-[#0F172A] dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <BookOpen className="w-3.5 h-3.5 text-[#E11D48]" />
                Bible DB
              </button>
            </div>
          )}
        </section>
      )}

      {/* Feed 5: 3 Multiplayer Game Modes Quick-Launcher */}
      <section className="space-y-3">
        <h3 className="text-xs font-black uppercase tracking-wider text-[#64748B] dark:text-slate-400 px-1">
          3 MULTIPLAYER GAME MODES • INSTANT ARENA
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {INSTANT_GAME_MODES.map((item) => {
            const matchingLive = upcomingAndActiveSessions.find(
              (s) => s.gameType === item.mode
            );
            return (
              <div
                key={item.mode}
                className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-2xl">{item.emoji}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[#64748B] dark:text-slate-300">
                      {item.timerText}
                    </span>
                  </div>
                  <h4 className="font-display text-sm font-extrabold text-[#0F172A] dark:text-white">
                    {item.title}
                  </h4>
                  <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                    {item.subtitle}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busyActionId === `mode:${item.mode}`}
                  onClick={() => void handlePlayModeNow(item.mode)}
                  className="touch-manipulation min-h-[44px] w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#0F172A] dark:bg-[#E11D48] text-white text-xs font-extrabold hover:bg-slate-800 dark:hover:bg-rose-700 disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" />
                  {matchingLive ? 'Join Live' : 'Play Now'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Feed 6: Recent Completed Multiplayer Showdowns (.slice(0, 5)) */}
      {recentCompletedSessions.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-[#64748B] dark:text-slate-400 px-1">
            RECENT MULTIPLAYER SHOWDOWNS ({recentCompletedSessions.length})
          </h3>
          <div className="space-y-2.5">
            {recentCompletedSessions.map((session) => (
              <div
                key={session.id}
                className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <span className="inline-block text-[10px] font-black uppercase tracking-wider text-[#64748B] dark:text-slate-400 mb-0.5">
                    COMPLETED • {getGameTypeDisplayName(session.gameType)}
                  </span>
                  <h4 className="font-display text-sm font-extrabold text-[#0F172A] dark:text-white truncate">
                    {getSessionTitle(session, language)}
                  </h4>
                  <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                    {session.totalQuestions} Rounds • Final Podium &amp; Standings Recorded
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setArenaSession(session)}
                  className="touch-manipulation min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-[#F59E0B]/50 text-amber-800 dark:text-amber-300 text-xs font-black hover:bg-amber-100 dark:hover:bg-amber-900/50"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  Podium
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Feed 7: Role-Specific Console / Progress Card */}
      {isLeadership ? (
        <section className="bg-slate-900 text-white rounded-3xl p-5 border border-slate-800 shadow-sm space-y-3">
          <div className="flex items-center gap-2.5">
            <Shield className="w-5 h-5 text-[#F59E0B]" />
            <h3 className="font-display text-base font-extrabold">
              {isAdmin
                ? 'Quiz & Leaderboard Administration'
                : 'Executive Games & Bible Reference Console 🏆'}
            </h3>
          </div>
          <p className="text-xs text-slate-300">
            Build multiplayer Bible showdowns, curate solo scripture quizzes, or manage synced
            PDF / EPUB Bible editions.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setEditingDraftSession(null);
                setPreselectedVerseForCreate(null);
                setShowCreateMultiplayer(true);
              }}
              className="touch-manipulation min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#E11D48] text-white text-xs font-extrabold hover:bg-rose-700"
            >
              🎮 Schedule / Launch Multiplayer Showdown
            </button>
            <button
              type="button"
              onClick={() => setShowCreateSoloQuiz(true)}
              className="touch-manipulation min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs font-bold hover:bg-slate-700"
            >
              <Plus className="w-3.5 h-3.5 text-[#F59E0B]" />
              Create Solo Scripture Quiz
            </button>
            <button
              type="button"
              onClick={() => setShowBibleDbModal(true)}
              className="touch-manipulation min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-amber-300 text-xs font-bold hover:bg-slate-700"
            >
              📖 PDF / EPUB Bible Reference &amp; Uploader
            </button>
          </div>
        </section>
      ) : isGuest ? (
        <section className="bg-white dark:bg-[#0F172A] border border-blue-200 dark:border-blue-900/50 rounded-3xl p-5 shadow-sm space-y-2">
          <h3 className="font-display text-base font-extrabold text-[#0F172A] dark:text-white">
            Play &amp; Challenge Your Bible Knowledge! 🎮
          </h3>
          <p className="text-xs text-[#64748B] dark:text-slate-400 leading-relaxed">
            Enjoy solo scripture quizzes and join live fellowship multiplayer showdowns. Create
            a Youth Member account in Profile to save permanent scores and earn Kingdom Ranks!
          </p>
        </section>
      ) : (
        <section className="bg-white dark:bg-[#0F172A] border border-emerald-200 dark:border-emerald-900/50 rounded-3xl p-5 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-base font-extrabold text-[#0F172A] dark:text-white">
              Your Trivia Progress
            </h3>
            <span className="text-xs font-black px-3 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
              {memberStats.rankTitle}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800">
              <p className="text-[11px] font-bold uppercase text-[#64748B] dark:text-slate-400">
                Quizzes Completed
              </p>
              <p className="font-display text-xl font-black text-[#0F172A] dark:text-white mt-0.5">
                {memberStats.quizzesCompleted}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-900 p-3 border border-slate-200 dark:border-slate-800">
              <p className="text-[11px] font-bold uppercase text-[#64748B] dark:text-slate-400">
                Best Score
              </p>
              <p className="font-display text-xl font-black text-[#E11D48] mt-0.5">
                {memberStats.bestScore} pts
              </p>
            </div>
          </div>
          <p className="text-xs italic text-[#64748B] dark:text-slate-400">
            “Let the word of Christ dwell in you richly in all wisdom...” — Colossians 3:16
          </p>
        </section>
      )}

      {/* Feed 8: Featured Quizzes & Scripture Challenges (/game_quizzes) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <h3 className="font-display text-sm font-extrabold text-[#0F172A] dark:text-white">
            Featured Quizzes &amp; Scripture Challenges
          </h3>
          {isAdmin && sortedQuizzes.length > 0 && (
            <button
              type="button"
              onClick={() => setShowCreateSoloQuiz(true)}
              className="text-xs font-bold text-[#E11D48] hover:underline"
            >
              + New Quiz
            </button>
          )}
        </div>

        {sortedQuizzes.length === 0 ? (
          <div
            data-testid="empty-quizzes-state"
            className="bg-white dark:bg-[#0F172A] border border-dashed border-slate-300 dark:border-slate-700 rounded-3xl p-6 text-center space-y-3"
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-[#E11D48] flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <p className="font-display text-sm font-extrabold text-[#0F172A] dark:text-white">
                No Solo Scripture Quizzes Yet
              </p>
              <p className="text-xs text-[#64748B] dark:text-slate-400 mt-1">
                Solo challenges crafted by fellowship leadership appear here for practice anytime.
              </p>
            </div>
            {/* Strict Android Asymmetry: CTA shown ONLY to ADMINISTRATOR */}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowCreateSoloQuiz(true)}
                className="touch-manipulation min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#E11D48] text-white text-xs font-extrabold hover:bg-rose-700"
              >
                + Create First Scripture Quiz
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {sortedQuizzes.map((quiz) => (
              <div
                key={quiz.id}
                className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[#64748B] dark:text-slate-300">
                      {quiz.category.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <h4 className="font-display text-sm font-extrabold text-[#0F172A] dark:text-white truncate">
                    {quiz.title}
                  </h4>
                  <p className="text-xs text-[#64748B] dark:text-slate-400 mt-0.5">
                    {quiz.totalQuestions} Questions • {quiz.timeLimitSeconds}s Limit •{' '}
                    {quiz.difficulty}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Strict Android Asymmetry: Delete icon ONLY for ADMINISTRATOR */}
                  {isAdmin && (
                    <button
                      type="button"
                      disabled={busyActionId === `del-quiz:${quiz.id}`}
                      onClick={() => void handleDeleteSoloQuiz(quiz.id)}
                      className="touch-manipulation p-2.5 rounded-xl border border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
                      aria-label={`Delete ${quiz.title}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setActiveSoloQuiz(quiz)}
                    className="touch-manipulation min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#E11D48] text-white text-xs font-extrabold hover:bg-rose-700"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Play
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Feed 9: Youth Global Leaderboard (/game_scores, .slice(0, 20)) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-[#F59E0B]" />
            <h3 className="font-display text-sm font-extrabold text-[#0F172A] dark:text-white">
              Youth Global Leaderboard
            </h3>
          </div>
          {/* Strict Android Asymmetry: "Live Rankings" pill ONLY for ADMINISTRATOR */}
          {isAdmin && (
            <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-[#E11D48]">
              Live Rankings
            </span>
          )}
        </div>

        {topLeaderboardScores.length === 0 ? (
          <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 text-center space-y-2">
            <Trophy className="w-8 h-8 text-[#F59E0B] mx-auto" />
            <p className="font-display text-sm font-extrabold text-[#0F172A] dark:text-white">
              Leaderboard is Fresh
            </p>
            <p className="text-xs text-[#64748B] dark:text-slate-400">
              Complete any live showdown or solo scripture quiz to claim top standing!
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800 shadow-sm overflow-hidden">
            {topLeaderboardScores.map((score, idx) => {
              const isSelf =
                score.userId === account.userId || score.userId === account.id;
              return (
                <div
                  key={score.id}
                  className={`flex items-center justify-between gap-3 px-4 py-3 ${
                    isSelf ? 'bg-rose-50/70 dark:bg-rose-950/20' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                        idx === 0
                          ? 'bg-[#F59E0B] text-[#0F172A]'
                          : idx === 1
                          ? 'bg-slate-200 dark:bg-slate-700 text-[#0F172A] dark:text-white'
                          : idx === 2
                          ? 'bg-amber-700 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-[#64748B] dark:text-slate-400'
                      }`}
                    >
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-display text-sm font-bold text-[#0F172A] dark:text-white truncate">
                          {score.userName}
                        </span>
                        {isSelf && (
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-[#E11D48] text-white">
                            ★ YOU
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#64748B] dark:text-slate-400 truncate">
                        {score.quizTitle}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-black text-[#E11D48] tabular-nums">
                      {score.score} / {score.totalQuestions} pts
                    </span>
                    {/* Strict Android Asymmetry: Delete icon ONLY for ADMINISTRATOR */}
                    {isAdmin && (
                      <button
                        type="button"
                        disabled={busyActionId === `del-score:${score.id}`}
                        onClick={() => void handleDeleteScore(score.id)}
                        className="p-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-50"
                        aria-label={`Remove score for ${score.userName}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {isGuest && (
          <p className="text-xs text-[#64748B] dark:text-slate-400 bg-slate-100 dark:bg-slate-900 rounded-xl px-3.5 py-2.5 border border-slate-200 dark:border-slate-800">
            Guest Mode: You can play freely, but Guest scores are not saved to the permanent
            fellowship leaderboard. Sign in as a Member in Profile to save scores.
          </p>
        )}
      </section>

      {/* Section 2.2: Floating Action Button (create_quiz_fab) */}
      {isLeadership && (
        <button
          type="button"
          data-testid="create_quiz_fab"
          aria-label="Create or Schedule Multiplayer Game"
          onClick={() => {
            setEditingDraftSession(null);
            setPreselectedVerseForCreate(null);
            setShowCreateMultiplayer(true);
          }}
          className="touch-manipulation fixed right-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-30 w-14 h-14 rounded-2xl bg-[#E11D48] text-white shadow-xl shadow-rose-900/30 flex items-center justify-center hover:bg-rose-700 active:scale-95 transition-transform"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Modals */}
      <CreateMultiplayerGameModal
        isOpen={showCreateMultiplayer}
        account={account}
        language={language}
        uploadedBibles={uploadedBibles}
        scriptureDocs={scriptureDocs}
        initialDraftSession={editingDraftSession}
        initialSelectedVerse={preselectedVerseForCreate}
        onClose={() => {
          setShowCreateMultiplayer(false);
          setEditingDraftSession(null);
          setPreselectedVerseForCreate(null);
        }}
        onSavedDraft={() => {
          showFeedback('success', 'Game draft saved (no notification sent).');
        }}
        onLaunchedSession={(session) => {
          setShowCreateMultiplayer(false);
          setEditingDraftSession(null);
          setPreselectedVerseForCreate(null);
          setArenaSession(session);
        }}
        onScheduledSession={() => {
          showFeedback('success', 'Multiplayer showdown scheduled and Fellowship alerted!');
        }}
      />

      <CreateSoloQuizModal
        isOpen={showCreateSoloQuiz}
        account={account}
        uploadedBibles={uploadedBibles}
        scriptureDocs={scriptureDocs}
        onClose={() => setShowCreateSoloQuiz(false)}
        onCreated={() => {
          showFeedback('success', 'Solo scripture quiz published!');
        }}
      />

      <BiblePickerModal
        isOpen={showBibleDbModal}
        onClose={() => setShowBibleDbModal(false)}
        uploadedBibles={uploadedBibles}
        scriptureDocs={scriptureDocs}
        account={account}
        pickerMode={true}
        onPickVerse={(verse) => {
          setShowBibleDbModal(false);
          if (isLeadership) {
            setEditingDraftSession(null);
            setPreselectedVerseForCreate(verse);
            setShowCreateMultiplayer(true);
          }
        }}
      />
    </div>
  );
};
