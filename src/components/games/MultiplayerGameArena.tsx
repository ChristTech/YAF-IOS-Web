import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Crown,
  Lock,
  RotateCcw,
  Send,
  ShieldAlert,
  Timer,
  Trophy,
  Users,
  XCircle,
} from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../services/firebase';
import {
  COLLECTIONS,
  advanceMultiplayerSessionState,
  endMultiplayerSession,
  joinSessionWithTransaction,
  saveGameScore,
  startScheduledSessionNow,
  submitMultiplayerAnswerWithTransaction,
} from '../../services/fellowshipService';
import { formatActionErrorMessage, getDisplayNameForAccount } from '../../utils/fellowshipLogic';
import {
  clampNumber,
  clampRemainingSeconds,
  computeNextSessionState,
  computeRankMovements,
  getClueProgress,
  getEffectiveQuestionTimeLimit,
  getGameTypeDisplayName,
  getSessionTitle,
  isGamesGuest,
  isGamesLeadership,
  normalizeSessionStatus,
  parseMultiplayerParticipants,
  parseMultiplayerQuestions,
  parseMultiplayerSessionDoc,
  reconcileMultiplayerSession,
  sortMultiplayerParticipants,
} from '../../utils/gamesLogic';
import type {
  FellowshipAccount,
  LanguageCode,
  MultiplayerParticipant,
  QuizSession,
} from '../../types/fellowship';

interface MultiplayerGameArenaProps {
  initialSession: QuizSession;
  account: FellowshipAccount;
  language: LanguageCode;
  onExit: () => void;
}

function safeTriggerFeedback(isCorrect?: boolean): void {
  try {
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.vibrate === 'function'
    ) {
      navigator.vibrate(isCorrect === false ? [40, 30, 40] : 25);
    }
  } catch {
    // iOS Safari safely skips unsupported vibrate
  }
}

export const MultiplayerGameArena: React.FC<MultiplayerGameArenaProps> = ({
  initialSession,
  account,
  language,
  onExit,
}) => {
  const [session, setSession] = useState<QuizSession>(initialSession);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [statusError, setStatusError] = useState<string | null>(null);
  const [startingEarly, setStartingEarly] = useState(false);

  // Per-question user interaction state
  const [selectedTriviaOption, setSelectedTriviaOption] = useState<string | null>(null);
  const [whoAmIInput, setWhoAmIInput] = useState('');
  const [reconstructedWords, setReconstructedWords] = useState<string[]>([]);
  const [scrambledPool, setScrambledPool] = useState<{ id: string; word: string }[]>([]);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [submittedByQuestion, setSubmittedByQuestion] = useState<
    Record<string, { isCorrect: boolean; pointsAwarded: number; isLate: boolean }>
  >({});

  const answeredLedgerRef = useRef<Set<string>>(new Set());
  const joinedSessionRef = useRef<string | null>(null);
  const savedPodiumRef = useRef<string | null>(null);
  const previousRanksRef = useRef<Map<string, number>>(new Map());
  const lastRankRoundRef = useRef<number>(-1);
  const lastTransitionKeyRef = useRef<string>('');
  const initializedDeadlineKeyRef = useRef<string>('');

  const myUserId = account.userId || account.id;
  const displayName = getDisplayNameForAccount(account);
  const isLeadership = isGamesLeadership(account.role);
  const isGuest = isGamesGuest(account.role);

  const isHostDevice =
    session.hostId === auth.currentUser?.uid ||
    session.hostId === account.userId ||
    session.hostId === account.id;

  // Real-time subscription to /quiz_sessions/{sessionId} with monotonic guard
  useEffect(() => {
    const ref = doc(db, COLLECTIONS.QUIZ_SESSIONS, initialSession.id);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as Record<string, unknown>;
        const parsed = parseMultiplayerSessionDoc(snap.id, data, Date.now());
        setSession((prev) => reconcileMultiplayerSession(prev, parsed));
      },
      () => {
        // Offline cache fallback handled seamlessly by current session state
      }
    );
    return () => unsub();
  }, [initialSession.id]);

  const questions = useMemo(
    () => parseMultiplayerQuestions(session.questionsJson),
    [session.questionsJson]
  );

  const participants = useMemo(
    () => sortMultiplayerParticipants(parseMultiplayerParticipants(session.participantsJson)),
    [session.participantsJson]
  );

  const myParticipant: MultiplayerParticipant | undefined = useMemo(
    () => participants.find((p) => p.userId === myUserId),
    [participants, myUserId]
  );

  const status = normalizeSessionStatus(session.status);
  const substate = session.currentSubstate || 'WAITING_TO_START';
  const currentQIndex = clampNumber(
    session.currentQuestionIndex || 0,
    0,
    Math.max(0, questions.length - 1)
  );
  const currentQuestion = questions[currentQIndex] || null;
  const qTimeLimitSec = getEffectiveQuestionTimeLimit(session, currentQuestion);

  // Join session via Firestore transaction when entering SCHEDULED or ACTIVE game
  useEffect(() => {
    if (
      (status === 'SCHEDULED' || status === 'ACTIVE') &&
      joinedSessionRef.current !== session.id
    ) {
      joinedSessionRef.current = session.id;
      void joinSessionWithTransaction(session.id, account);
    }
  }, [session.id, status, account]);

  // Reset per-question inputs & capture pre-intermission ranks on round change
  useEffect(() => {
    setSelectedTriviaOption(null);
    setWhoAmIInput('');
    setReconstructedWords([]);
    setStatusError(null);

    if (currentQuestion && currentQuestion.gameType === 'SCRIPTURE_SCRAMBLE') {
      const words =
        currentQuestion.scrambledWords.length > 0
          ? currentQuestion.scrambledWords
          : [];
      setScrambledPool(words.map((word, idx) => ({ id: `${currentQIndex}-${idx}-${word}`, word })));
    } else {
      setScrambledPool([]);
    }
  }, [currentQIndex, currentQuestion?.id]);

  // Snapshot ranks just before/at QUESTION_OPEN so LEADERBOARD computes ▲/▼ deltas accurately
  useEffect(() => {
    if (status === 'ACTIVE' && substate === 'QUESTION_OPEN' && lastRankRoundRef.current !== currentQIndex) {
      lastRankRoundRef.current = currentQIndex;
      const map = new Map<string, number>();
      participants.forEach((p, idx) => map.set(p.userId, idx + 1));
      previousRanksRef.current = map;
    }
  }, [status, substate, currentQIndex, participants]);

  // Synchronized evaluation & monotonic local/host transition check
  const syncSessionState = useCallback(() => {
    const now = Date.now();
    setNowMs(now);

    if (status === 'DRAFT' || status === 'COMPLETED' || status === 'CANCELLED') {
      return;
    }

    const transition = computeNextSessionState({
      session,
      questions,
      nowMs: now,
      isHostDevice,
    });

    if (transition.changed) {
      const key = `${session.id}:${status}:${substate}:${currentQIndex}->${transition.nextStatus}:${transition.nextSubstate}:${transition.nextQuestionIndex}`;
      if (lastTransitionKeyRef.current !== key) {
        lastTransitionKeyRef.current = key;
        setSession((prev) =>
          reconcileMultiplayerSession(prev, {
            ...prev,
            status: transition.nextStatus,
            currentSubstate: transition.nextSubstate,
            currentQuestionIndex: transition.nextQuestionIndex,
            currentQuestionDeadline: transition.nextQuestionDeadline,
            leaderboardDeadline: transition.nextLeaderboardDeadline,
          })
        );
        if (isHostDevice || isLeadership) {
          void advanceMultiplayerSessionState(session.id, {
            status: transition.nextStatus,
            currentSubstate: transition.nextSubstate,
            currentQuestionIndex: transition.nextQuestionIndex,
            currentQuestionDeadline: transition.nextQuestionDeadline,
            leaderboardDeadline: transition.nextLeaderboardDeadline,
          });
        }
      }
    }
  }, [session, questions, isHostDevice, isLeadership, status, substate, currentQIndex]);

  // Ensure uninitialized ACTIVE QUESTION_OPEN or LEADERBOARD gets a one-time countdown deadline
  useEffect(() => {
    if (status !== 'ACTIVE') return;
    const initKey = `${session.id}::${currentQIndex}::${substate}`;

    if (
      substate === 'QUESTION_OPEN' &&
      (!session.currentQuestionDeadline || session.currentQuestionDeadline <= 0)
    ) {
      if (initializedDeadlineKeyRef.current === initKey) return;
      initializedDeadlineKeyRef.current = initKey;
      const nextDeadline = Date.now() + qTimeLimitSec * 1000;
      setSession((prev) => ({
        ...prev,
        currentQuestionDeadline: nextDeadline,
      }));
      if (isHostDevice || isLeadership) {
        void advanceMultiplayerSessionState(session.id, {
          status: 'ACTIVE',
          currentSubstate: 'QUESTION_OPEN',
          currentQuestionIndex: currentQIndex,
          currentQuestionDeadline: nextDeadline,
          leaderboardDeadline: 0,
        });
      }
      return;
    }

    if (
      substate === 'LEADERBOARD' &&
      (!session.leaderboardDeadline || session.leaderboardDeadline <= 0)
    ) {
      if (initializedDeadlineKeyRef.current === initKey) return;
      initializedDeadlineKeyRef.current = initKey;
      const lbSec =
        session.leaderboardDurationSeconds > 0
          ? session.leaderboardDurationSeconds
          : 6;
      const nextLbDeadline = Date.now() + lbSec * 1000;
      setSession((prev) => ({
        ...prev,
        leaderboardDeadline: nextLbDeadline,
      }));
      if (isHostDevice || isLeadership) {
        void advanceMultiplayerSessionState(session.id, {
          status: 'ACTIVE',
          currentSubstate: 'LEADERBOARD',
          currentQuestionIndex: currentQIndex,
          currentQuestionDeadline: session.currentQuestionDeadline || 0,
          leaderboardDeadline: nextLbDeadline,
        });
      }
    }
  }, [
    status,
    substate,
    session.id,
    session.currentQuestionDeadline,
    session.leaderboardDeadline,
    session.leaderboardDurationSeconds,
    qTimeLimitSec,
    isHostDevice,
    isLeadership,
    currentQIndex,
  ]);

  // 500ms ticker loop (slowed to 2000ms when COMPLETED) + iOS visibility/focus/pageshow listeners
  useEffect(() => {
    syncSessionState();
    const intervalMs = status === 'COMPLETED' ? 2000 : 500;
    const timer = window.setInterval(syncSessionState, intervalMs);

    const handleWake = () => syncSessionState();
    document.addEventListener('visibilitychange', handleWake);
    window.addEventListener('focus', handleWake);
    window.addEventListener('pageshow', handleWake);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', handleWake);
      window.removeEventListener('focus', handleWake);
      window.removeEventListener('pageshow', handleWake);
    };
  }, [syncSessionState, status]);

  // Idempotent score recording on COMPLETED podium for non-GUEST participants
  useEffect(() => {
    if (status !== 'COMPLETED' || isGuest) return;
    if (!myParticipant) return;
    if (savedPodiumRef.current === session.id) return;
    savedPodiumRef.current = session.id;

    const totalPossible = Math.max(
      questions.length * (session.baseScorePerQuestion || 100),
      100
    );
    const totalSeconds = Math.max(
      1,
      questions.length * (session.timeLimitPerQuestionSeconds || 20)
    );
    void saveGameScore({
      explicitScoreId: `mp-score-${session.id}-${myUserId}`,
      quizId: session.id,
      quizTitle: getSessionTitle(session, language),
      account,
      score: myParticipant.currentScore,
      totalQuestions: totalPossible,
      timeTakenSeconds: totalSeconds,
    });
  }, [
    status,
    isGuest,
    myParticipant,
    session,
    questions.length,
    myUserId,
    account,
    language,
  ]);

  const roundOutcomeKey = `${session.id}::${currentQIndex}`;

  const handleAnswerSubmission = async (submittedAnswer: string) => {
    if (!currentQuestion || submittingAnswer) return;
    if (submittedByQuestion[roundOutcomeKey]) return;
    const qDeadline = session.currentQuestionDeadline ?? 0;
    if (qDeadline > 0 && Date.now() > qDeadline) {
      syncSessionState();
      return;
    }
    setStatusError(null);
    setSubmittingAnswer(true);

    try {
      const res = await submitMultiplayerAnswerWithTransaction({
        sessionId: session.id,
        question: currentQuestion,
        questionIndex: currentQIndex,
        account,
        submittedAnswer,
        alreadyAnsweredLedger: answeredLedgerRef.current,
        localQuestionDeadlineMs: session.currentQuestionDeadline,
      });

      if (res.status === 'MissedQuestion') {
        setStatusError('You joined after this round began — ready for the next round!');
      } else if (res.status !== 'DuplicateRejected') {
        answeredLedgerRef.current.add(`${session.id}::${currentQIndex}::${myUserId}`);
        safeTriggerFeedback(res.isCorrect);
        setSubmittedByQuestion((prev) => ({
          ...prev,
          [roundOutcomeKey]: {
            isCorrect: res.isCorrect,
            pointsAwarded: res.pointsAwarded,
            isLate: res.status === 'DeadlineExpired',
          },
        }));
      }
    } catch (err) {
      setStatusError(formatActionErrorMessage(err, 'Unable to submit answer.'));
    } finally {
      setSubmittingAnswer(false);
    }
  };

  const sessionTitle = getSessionTitle(session, language);

  const rankedParticipants = useMemo(
    () => computeRankMovements(participants, previousRanksRef.current),
    [participants]
  );

  const top5Participants = rankedParticipants.slice(0, 5);
  const myStanding = rankedParticipants.find((p) => p.userId === myUserId);
  const fifthScore = top5Participants[4]?.currentScore ?? 0;

  // Countdown math strictly derived from deadlines
  const lobbyRemainingSec =
    session.scheduledStartTime && session.scheduledStartTime > 0
      ? Math.max(0, Math.ceil((session.scheduledStartTime - nowMs) / 1000))
      : 0;
  const lobbyMm = String(Math.floor(lobbyRemainingSec / 60)).padStart(2, '0');
  const lobbySs = String(lobbyRemainingSec % 60).padStart(2, '0');

  const questionRemainingSec = clampRemainingSeconds(
    session.currentQuestionDeadline,
    nowMs,
    qTimeLimitSec
  );

  const leaderboardRemainingSec = clampRemainingSeconds(
    session.leaderboardDeadline,
    nowMs,
    session.leaderboardDurationSeconds || 8
  );

  const clueInfo =
    currentQuestion && currentQuestion.gameType === 'WHO_AM_I'
      ? getClueProgress(
          qTimeLimitSec,
          session.currentQuestionDeadline || nowMs + qTimeLimitSec * 1000,
          nowMs,
          Math.max(2, currentQuestion.clues.length || 2)
        )
      : null;

  const isLateJoiner = (myParticipant?.joinedAtQuestionIndex || 0) > 0;
  const hasSubmittedThisRound = Boolean(submittedByQuestion[roundOutcomeKey]);
  const myRoundOutcome = submittedByQuestion[roundOutcomeKey];
  const isQuestionExpired =
    (session.currentQuestionDeadline ?? 0) > 0 && questionRemainingSec <= 0;

  // State 5: CANCELLED
  if (status === 'CANCELLED') {
    return (
      <div className="fixed inset-0 z-[45] overflow-y-auto overscroll-contain bg-[#0F172A] text-white flex flex-col items-center justify-center p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))] text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-[#E11D48]/20 border border-[#E11D48]/40 flex items-center justify-center">
          <ShieldAlert className="w-8 h-8 text-[#FB7185]" />
        </div>
        <div className="space-y-1.5 max-w-sm">
          <h2 className="font-display text-xl font-bold">Game Session Cancelled</h2>
          <p className="text-xs text-[#94A3B8]">
            {sessionTitle} was ended by Youth Leadership before completion.
          </p>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="min-h-[44px] px-6 rounded-xl bg-[#E11D48] text-white text-sm font-bold"
        >
          Return to Games Hub
        </button>
      </div>
    );
  }

  // State 4: COMPLETED -> MultiplayerPodiumView
  if (status === 'COMPLETED') {
    const first = rankedParticipants[0];
    const second = rankedParticipants[1];
    const third = rankedParticipants[2];

    return (
      <div className="fixed inset-0 z-[45] overflow-y-auto overscroll-contain bg-[#0B0F19] text-white flex flex-col pt-[env(safe-area-inset-top)] pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <div className="max-w-2xl w-full mx-auto px-4 py-6 space-y-5">
          <div className="text-center space-y-1.5">
            <span className="inline-block px-3 py-1 rounded-full bg-[#F59E0B]/20 text-[#FCD34D] text-[11px] font-extrabold tracking-widest">
              {sessionTitle}
            </span>
            <h2 className="font-display text-xl sm:text-2xl font-extrabold text-[#F59E0B]">
              👑 TOURNAMENT COMPLETED 👑
            </h2>
          </div>

          {/* 3-Pillar Podium: #2 (80px), #1 (115px), #3 (60px) */}
          <div className="rounded-2xl bg-[#111827] border border-[#1E293B] p-5">
            <div className="grid grid-cols-3 items-end gap-2 sm:gap-4 pt-4">
              {/* #2 */}
              <div className="flex flex-col items-center text-center">
                <span className="text-xs font-bold text-[#CBD5E1] truncate max-w-full">
                  {second ? second.userName : '—'}
                </span>
                <span className="text-[11px] font-mono text-[#94A3B8] mb-2">
                  {second ? `${second.currentScore} pts` : '0 pts'}
                </span>
                <div className="w-full h-[80px] rounded-t-xl bg-[#334155] border-t-4 border-[#CBD5E1] flex flex-col items-center justify-center font-extrabold text-sm">
                  <span>#2</span>
                </div>
              </div>

              {/* #1 */}
              <div className="flex flex-col items-center text-center">
                <Trophy className="w-6 h-6 text-[#F59E0B] mb-1" />
                <span className="text-xs sm:text-sm font-extrabold text-white truncate max-w-full">
                  {first ? first.userName : 'Champion'}
                </span>
                <span className="text-xs font-mono font-bold text-[#FCD34D] mb-2">
                  {first ? `${first.currentScore} pts` : '0 pts'}
                </span>
                <div className="w-full h-[115px] rounded-t-xl bg-gradient-to-b from-[#F59E0B] to-[#D97706] text-[#0F172A] flex flex-col items-center justify-center font-extrabold text-base shadow-lg">
                  <span>#1 🏆</span>
                </div>
              </div>

              {/* #3 */}
              <div className="flex flex-col items-center text-center">
                <span className="text-xs font-bold text-[#FDBA74] truncate max-w-full">
                  {third ? third.userName : '—'}
                </span>
                <span className="text-[11px] font-mono text-[#94A3B8] mb-2">
                  {third ? `${third.currentScore} pts` : '0 pts'}
                </span>
                <div className="w-full h-[60px] rounded-t-xl bg-[#78350F] border-t-4 border-[#F97316] flex flex-col items-center justify-center font-extrabold text-sm">
                  <span>#3</span>
                </div>
              </div>
            </div>
          </div>

          {/* Your Final Result Card */}
          {myStanding && (
            <div className="rounded-2xl bg-[#1E293B] border border-[#F59E0B]/40 p-4 flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#FCD34D]">
                  YOUR FINAL RESULT
                </span>
                <p className="text-base font-extrabold text-white mt-0.5">
                  Rank #{myStanding.rank} of {rankedParticipants.length}
                </p>
                {isGuest && (
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">
                    Guest scores are shown live only and not saved to the permanent leaderboard.
                  </p>
                )}
              </div>
              <div className="text-right">
                <span className="text-xl font-extrabold font-mono text-[#F59E0B]">
                  {myStanding.currentScore}
                </span>
                <span className="block text-[11px] text-[#94A3B8]">pts</span>
              </div>
            </div>
          )}

          {/* Full Standings List */}
          <div className="rounded-2xl bg-[#111827] border border-[#1E293B] p-4 space-y-2.5">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#94A3B8]">
              Final Standings ({rankedParticipants.length})
            </h3>
            {rankedParticipants.length === 0 ? (
              <p className="text-xs text-[#64748B] py-4 text-center">
                No participants recorded in this session.
              </p>
            ) : (
              rankedParticipants.map((p) => (
                <div
                  key={p.userId}
                  className={`rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2 ${
                    p.userId === myUserId
                      ? 'bg-[#E11D48]/20 border border-[#E11D48]/50'
                      : 'bg-[#1F2937]/70'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 text-xs font-extrabold text-[#F59E0B]">
                      #{p.rank}
                    </span>
                    <span className="text-sm font-bold truncate">
                      {p.userName} {p.userId === myUserId ? '(You)' : ''}
                    </span>
                  </div>
                  <span className="text-sm font-extrabold font-mono text-white shrink-0">
                    {p.currentScore} pts
                  </span>
                </div>
              ))
            )}
          </div>

          <button
            type="button"
            onClick={onExit}
            className="w-full min-h-[46px] rounded-xl bg-[#E11D48] text-white text-sm font-extrabold"
          >
            Return to Fellowship Games Hub
          </button>
        </div>
      </div>
    );
  }

  // State 1: SCHEDULED / WAITING_TO_START (Lobby)
  if (status === 'SCHEDULED' || substate === 'WAITING_TO_START') {
    return (
      <div className="fixed inset-0 z-[45] overflow-y-auto overscroll-contain bg-[#0F172A] text-white flex flex-col pt-[env(safe-area-inset-top)] pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <div className="max-w-xl w-full mx-auto px-4 py-6 space-y-5 flex-1 flex flex-col justify-center">
          <div className="flex items-center justify-between gap-2">
            <span className="px-3 py-1 rounded-full bg-[#F59E0B] text-[#0F172A] text-[11px] font-extrabold tracking-wider">
              PIN {session.roomPin}
            </span>
            <span className="px-3 py-1 rounded-full bg-[#1E293B] text-[#34D399] text-xs font-bold inline-flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>{Math.max(participants.length, session.participantCount)} Connected Player(s)</span>
            </span>
          </div>

          <div className="rounded-2xl bg-[#111827] border border-[#1E293B] p-6 text-center space-y-3">
            <span className="inline-block px-2.5 py-0.5 rounded bg-[#E11D48]/20 text-[#FB7185] text-[11px] font-bold">
              {getGameTypeDisplayName(session.gameType)}
            </span>
            <h2 className="font-display text-xl font-extrabold">{sessionTitle}</h2>
            {session.description && (
              <p className="text-xs text-[#94A3B8]">{session.description}</p>
            )}

            <div className="py-4">
              <span className="block text-[11px] font-bold uppercase tracking-widest text-[#94A3B8]">
                STARTS IN
              </span>
              <span className="font-mono text-4xl font-extrabold text-[#F59E0B] tabular-nums">
                {lobbyMm}:{lobbySs}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-xl bg-[#0F172A] p-3 text-center">
              <div>
                <span className="block text-[10px] text-[#94A3B8]">Timer</span>
                <span className="text-xs font-bold">{session.timeLimitPerQuestionSeconds}s/q</span>
              </div>
              <div>
                <span className="block text-[10px] text-[#94A3B8]">Base Score</span>
                <span className="text-xs font-bold">{session.baseScorePerQuestion} pts</span>
              </div>
              <div>
                <span className="block text-[10px] text-[#94A3B8]">Speed Bonus</span>
                <span className="text-xs font-bold">+{session.maxSpeedBonus} max</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={onExit}
              className="flex-1 min-w-[130px] min-h-[44px] rounded-xl bg-[#1E293B] text-white text-xs font-bold"
            >
              Leave Lobby
            </button>
            {isLeadership && (
              <button
                type="button"
                disabled={startingEarly}
                onClick={async () => {
                  setStartingEarly(true);
                  try {
                    await startScheduledSessionNow(session);
                  } finally {
                    setStartingEarly(false);
                  }
                }}
                className="flex-1 min-w-[160px] min-h-[44px] rounded-xl bg-[#E11D48] text-white text-sm font-extrabold disabled:opacity-50"
              >
                {startingEarly ? 'Starting...' : '🚀 Start Game Now'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // State 3: ACTIVE / LEADERBOARD (Inter-round Intermission)
  if (substate === 'LEADERBOARD') {
    const isFinalNext = currentQIndex + 1 >= Math.max(questions.length, session.totalQuestions);
    const questionCompleted =
      myRoundOutcome ||
      (myParticipant?.lastSubmittedQuestionIndex === currentQIndex
        ? {
            isCorrect: Boolean(myParticipant.lastSubmittedCorrect),
            pointsAwarded: myParticipant.lastQuestionPoints || 0,
            isLate: Boolean(myParticipant.lastSubmittedLate),
          }
        : null);

    return (
      <div className="fixed inset-0 z-[45] overflow-y-auto overscroll-contain bg-[#0F172A] text-white flex flex-col pt-[env(safe-area-inset-top)] pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <div className="max-w-2xl w-full mx-auto px-4 py-5 space-y-4">
          {/* Countdown Banner */}
          <div className="rounded-2xl bg-[#111827] border border-[#1E293B] p-4 flex items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#F59E0B]">
                {isFinalNext ? 'FINAL PODIUM IN' : 'NEXT QUESTION STARTS IN'}
              </span>
              <p className="text-xs text-[#94A3B8]">
                Round {currentQIndex + 1} of {questions.length}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#E11D48] flex items-center justify-center font-mono text-lg font-extrabold tabular-nums">
              {leaderboardRemainingSec}s
            </div>
          </div>

          {/* Current User Result Banner */}
          {questionCompleted ? (
            questionCompleted.isCorrect && !questionCompleted.isLate ? (
              <div className="rounded-2xl bg-[#065F46]/40 border border-[#10B981] p-4 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-[#34D399] shrink-0" />
                <div>
                  <p className="text-sm font-extrabold text-[#34D399]">
                    CORRECT +{questionCompleted.pointsAwarded} pts
                  </p>
                  <p className="text-xs text-[#CBD5E1]">Well done! Glory to God.</p>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-[#9F1239]/40 border border-[#FB7185] p-4 flex items-center gap-3">
                <XCircle className="w-6 h-6 text-[#FB7185] shrink-0" />
                <div>
                  <p className="text-sm font-extrabold text-[#FDA4AF]">INCORRECT</p>
                  <p className="text-xs text-[#CBD5E1]">
                    {questionCompleted.isLate
                      ? 'Submitted past deadline — 0 pts.'
                      : 'Keep pressing on to the next round!'}
                  </p>
                </div>
              </div>
            )
          ) : (
            <div className="rounded-2xl bg-[#78350F]/40 border border-[#F59E0B] p-4 flex items-center gap-3">
              <Clock className="w-6 h-6 text-[#FCD34D] shrink-0" />
              <div>
                <p className="text-sm font-extrabold text-[#FCD34D]">
                  NO ANSWER — Time&apos;s up!
                </p>
                <p className="text-xs text-[#CBD5E1]">Ready yourself for the upcoming round.</p>
              </div>
            </div>
          )}

          {/* Correct Answer & Explanation Block */}
          {currentQuestion && (
            <div className="rounded-2xl bg-[#111827] border border-[#1E293B] p-4 space-y-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#10B981]">
                CORRECT ANSWER
              </span>
              <p className="text-sm font-bold text-white">{currentQuestion.correctAnswer}</p>
              {(currentQuestion.scriptureReference || currentQuestion.explanation) && (
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  {currentQuestion.scriptureReference
                    ? `${currentQuestion.scriptureReference} • `
                    : ''}
                  {currentQuestion.explanation}
                </p>
              )}
            </div>
          )}

          {/* Top 5 Leaderboard */}
          <div className="rounded-2xl bg-[#111827] border border-[#1E293B] p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#F59E0B]">
                TOP 5 OF {rankedParticipants.length}
              </span>
              <span className="text-[11px] text-[#94A3B8]">Live Standings</span>
            </div>

            {top5Participants.map((p) => (
              <div
                key={p.userId}
                className={`rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2 transition-transform ${
                  p.userId === myUserId
                    ? 'bg-[#E11D48]/20 border border-[#E11D48]/60'
                    : 'bg-[#1F2937]/70'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-6 text-xs font-extrabold text-[#F59E0B]">#{p.rank}</span>
                  <span className="text-sm font-bold truncate">{p.userName}</span>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <span
                    className={`text-[11px] font-bold ${
                      p.rankMovement > 0
                        ? 'text-[#34D399] animate-bounce'
                        : p.rankMovement < 0
                        ? 'text-[#FB7185]'
                        : 'text-[#64748B]'
                    }`}
                  >
                    {p.rankMovement > 0
                      ? `▲ +${p.rankMovement}`
                      : p.rankMovement < 0
                      ? `▼ ${p.rankMovement}`
                      : '• 0'}
                  </span>
                  <span className="text-sm font-extrabold font-mono">{p.currentScore} pts</span>
                </div>
              </div>
            ))}
          </div>

          {/* Separate Dark Your Standing Card */}
          {myStanding && (
            <div className="rounded-2xl bg-[#0B0F19] border border-[#334155] p-4 flex items-center justify-between gap-2">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#94A3B8]">
                  YOUR STANDING
                </span>
                <p className="text-sm font-extrabold text-white">
                  Rank #{myStanding.rank} of {rankedParticipants.length}
                </p>
                {myStanding.rank > 5 && (
                  <p className="text-[11px] text-[#F59E0B]">
                    {Math.max(1, fifthScore - myStanding.currentScore)} pts from Top 5
                  </p>
                )}
              </div>
              <span className="text-lg font-extrabold font-mono text-[#F59E0B]">
                {myStanding.currentScore} pts
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onExit}
              className="flex-1 min-w-[140px] min-h-[44px] rounded-xl bg-[#1E293B] text-white text-xs font-bold"
            >
              Exit to Games Hub
            </button>
            {isLeadership && (
              <button
                type="button"
                onClick={() => void endMultiplayerSession(session.id)}
                className="min-h-[44px] px-4 rounded-xl border border-[#FB7185]/40 text-[#FB7185] text-xs font-bold"
              >
                End Game
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // State 2: ACTIVE / QUESTION_OPEN
  return (
    <div className="fixed inset-0 z-[45] overflow-hidden bg-[#0F172A] text-white flex flex-col pt-[env(safe-area-inset-top)]">
      {/* Arena Header */}
      <div className="px-4 py-3 border-b border-[#1E293B] bg-[#0B0F19] shrink-0">
        <div className="max-w-2xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onExit}
            className="min-h-[38px] px-3 rounded-xl bg-[#1E293B] text-xs font-bold inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Exit</span>
          </button>

          <div className="text-center min-w-0">
            <span className="text-[11px] font-bold text-[#F59E0B] block">
              Round {currentQIndex + 1} of {Math.max(questions.length, session.totalQuestions)}
            </span>
            <h2 className="text-xs font-bold truncate max-w-[180px] sm:max-w-xs">
              {sessionTitle}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-xl bg-[#1E293B] text-xs font-bold font-mono text-[#34D399]">
              {myParticipant?.currentScore ?? 0} pts
            </span>
            <span
              className={`px-3 py-1 rounded-xl font-mono text-sm font-extrabold tabular-nums inline-flex items-center gap-1 ${
                questionRemainingSec <= 5 ? 'bg-[#E11D48] text-white' : 'bg-[#F59E0B] text-[#0F172A]'
              }`}
            >
              <Timer className="w-3.5 h-3.5" />
              <span>{questionRemainingSec}s</span>
            </span>
          </div>
        </div>
      </div>

      {/* Scrollable Question Body */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pt-5 pb-[calc(2rem+env(safe-area-inset-bottom))] max-w-2xl w-full mx-auto space-y-4">
        {isLateJoiner && (
          <div className="rounded-xl bg-[#F59E0B]/15 border border-[#F59E0B]/40 px-3.5 py-2 text-xs font-bold text-[#FCD34D]">
            ⚡ Joined at Round {(myParticipant?.joinedAtQuestionIndex || 0) + 1}
          </div>
        )}

        {statusError && (
          <div
            role="alert"
            className="rounded-xl bg-[#9F1239]/40 border border-[#FB7185] px-3.5 py-2 text-xs font-bold text-[#FECDD3]"
          >
            {statusError}
          </div>
        )}

        {currentQuestion ? (
          <>
            {/* MODE 1: TRIVIA_CHALLENGE */}
            {currentQuestion.gameType === 'TRIVIA_CHALLENGE' && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-[#111827] border border-[#1E293B] p-5 space-y-2.5">
                  {currentQuestion.scriptureReference && (
                    <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#F59E0B]/20 text-[#FCD34D] text-[11px] font-bold">
                      {currentQuestion.scriptureReference}
                    </span>
                  )}
                  <h3 className="text-base sm:text-lg font-extrabold leading-snug text-white">
                    {currentQuestion.prompt}
                  </h3>
                </div>

                {hasSubmittedThisRound ? (
                  <div className="rounded-xl bg-[#1E293B] border border-[#38BDF8]/50 px-4 py-3 text-xs font-extrabold text-[#38BDF8] text-center">
                    Answer Submitted • {questionRemainingSec}s remaining
                  </div>
                ) : isQuestionExpired ? (
                  <div className="rounded-xl bg-[#78350F]/40 border border-[#F59E0B] px-4 py-3 text-xs font-extrabold text-[#FCD34D] text-center">
                    Time&apos;s Up • Revealing round standings...
                  </div>
                ) : null}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {currentQuestion.options.map((opt, idx) => {
                    const isSelected = selectedTriviaOption === opt;
                    const letters = ['A', 'B', 'C', 'D'];
                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={hasSubmittedThisRound || submittingAnswer || isQuestionExpired}
                        onClick={() => {
                          setSelectedTriviaOption(opt);
                          void handleAnswerSubmission(opt);
                        }}
                        className={`min-h-[60px] rounded-2xl p-4 text-left flex items-center justify-between gap-2 border-2 transition-all touch-manipulation ${
                          isSelected
                            ? 'bg-[#E11D48]/25 border-[#E11D48] text-white'
                            : 'bg-[#111827] border-[#1E293B] hover:border-[#475569] text-[#F8FAFC]'
                        } disabled:opacity-75`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-8 h-8 rounded-lg bg-[#1E293B] flex items-center justify-center text-xs font-extrabold text-[#F59E0B] shrink-0">
                            {letters[idx] || idx + 1}
                          </span>
                          <span className="text-sm font-bold break-words">{opt}</span>
                        </div>
                        {isSelected && (
                          <span className="px-2 py-0.5 rounded bg-[#E11D48] text-[10px] font-extrabold shrink-0">
                            SELECTED
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* MODE 2: WHO_AM_I */}
            {currentQuestion.gameType === 'WHO_AM_I' && clueInfo && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#111827] border border-[#F59E0B]/40 p-4">
                  <div className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-[#F59E0B]" />
                    <span className="text-sm font-extrabold">Who Am I?</span>
                  </div>
                  <span className="px-3 py-1 rounded-full bg-[#F59E0B] text-[#0F172A] text-xs font-extrabold">
                    {clueInfo.clueBannerLabel}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {currentQuestion.clues.map((clueText, idx) => {
                    const unlocked = idx <= clueInfo.currentClueIndex;
                    return (
                      <div
                        key={idx}
                        className={`rounded-2xl p-4 border ${
                          unlocked
                            ? 'bg-[#111827] border-[#10B981]/50 text-white'
                            : 'bg-[#0B0F19] border-[#1E293B] text-[#64748B]'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-xs font-extrabold mb-1">
                          {unlocked ? (
                            <span className="text-[#34D399]">Clue {idx + 1} (Unlocked)</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[#64748B]">
                              <Lock className="w-3.5 h-3.5" />
                              <span>Clue {idx + 1} unlocks as time runs...</span>
                            </span>
                          )}
                        </div>
                        {unlocked && <p className="text-sm font-semibold">{clueText}</p>}
                      </div>
                    );
                  })}
                </div>

                {hasSubmittedThisRound ? (
                  <div className="rounded-xl bg-[#1E293B] border border-[#38BDF8]/50 px-4 py-3 text-xs font-extrabold text-[#38BDF8] text-center">
                    Answer Submitted • {questionRemainingSec}s remaining
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!whoAmIInput.trim()) return;
                      void handleAnswerSubmission(whoAmIInput.trim());
                    }}
                    className="flex flex-wrap gap-2"
                  >
                    <input
                      type="text"
                      value={whoAmIInput}
                      onChange={(e) => setWhoAmIInput(e.target.value)}
                      placeholder="Type the Bible character or answer..."
                      className="flex-1 min-w-[200px] min-h-[46px] px-4 rounded-xl bg-[#111827] border border-[#334155] text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#F59E0B]"
                    />
                    <button
                      type="submit"
                      disabled={submittingAnswer || isQuestionExpired || !whoAmIInput.trim()}
                      className="min-h-[46px] px-5 rounded-xl bg-[#E11D48] text-white text-sm font-extrabold inline-flex items-center gap-1.5 disabled:opacity-50 touch-manipulation"
                    >
                      <Send className="w-4 h-4" />
                      <span>Submit</span>
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* MODE 3: SCRIPTURE_SCRAMBLE */}
            {currentQuestion.gameType === 'SCRIPTURE_SCRAMBLE' && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-[#111827] border border-[#1E293B] p-4 space-y-1">
                  <span className="text-xs font-extrabold text-[#F59E0B]">
                    {currentQuestion.scriptureReference || 'Scripture'} •{' '}
                    {currentQuestion.translation || 'KJV'}
                  </span>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    {currentQuestion.prompt}
                  </h3>
                </div>

                {/* Reconstructed Verse Tray */}
                <div className="rounded-2xl bg-[#111827] border border-[#334155] p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#94A3B8]">
                      RECONSTRUCTED VERSE TRAY
                    </span>
                    <button
                      type="button"
                      disabled={hasSubmittedThisRound}
                      onClick={() => {
                        setReconstructedWords([]);
                        setScrambledPool(
                          currentQuestion.scrambledWords.map((word, idx) => ({
                            id: `${currentQIndex}-${idx}-${word}`,
                            word,
                          }))
                        );
                      }}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#F59E0B] disabled:opacity-40"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Clear</span>
                    </button>
                  </div>

                  <div className="min-h-[56px] rounded-xl bg-[#0B0F19] border border-dashed border-[#334155] p-2.5 flex flex-wrap gap-1.5">
                    {reconstructedWords.length === 0 ? (
                      <span className="text-xs text-[#64748B] m-auto">
                        Tap word tiles below in exact scripture order...
                      </span>
                    ) : (
                      reconstructedWords.map((w, idx) => (
                        <button
                          key={`${w}-${idx}`}
                          type="button"
                          disabled={hasSubmittedThisRound}
                          onClick={() => {
                            setReconstructedWords((prev) =>
                              prev.filter((_, i) => i !== idx)
                            );
                            setScrambledPool((prev) => [
                              ...prev,
                              { id: `ret-${Date.now()}-${idx}`, word: w },
                            ]);
                          }}
                          className="min-h-[36px] px-3 rounded-xl bg-[#E11D48] text-white text-xs font-bold touch-manipulation"
                        >
                          {w}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Available Word Tiles */}
                <div className="rounded-2xl bg-[#111827] border border-[#1E293B] p-4 space-y-2.5">
                  <span className="block text-[11px] font-extrabold uppercase tracking-wider text-[#94A3B8]">
                    AVAILABLE WORD TILES
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {scrambledPool.map((tile) => (
                      <button
                        key={tile.id}
                        type="button"
                        disabled={hasSubmittedThisRound}
                        onClick={() => {
                          setScrambledPool((prev) =>
                            prev.filter((item) => item.id !== tile.id)
                          );
                          setReconstructedWords((prev) => [...prev, tile.word]);
                        }}
                        className="min-h-[38px] px-3.5 rounded-xl bg-[#1E293B] hover:bg-[#334155] border border-[#334155] text-white text-xs font-bold touch-manipulation"
                      >
                        {tile.word}
                      </button>
                    ))}
                  </div>
                </div>

                {hasSubmittedThisRound ? (
                  <div className="rounded-xl bg-[#1E293B] border border-[#38BDF8]/50 px-4 py-3 text-xs font-extrabold text-[#38BDF8] text-center">
                    Verse Submitted • {questionRemainingSec}s remaining
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={submittingAnswer || isQuestionExpired || reconstructedWords.length === 0}
                    onClick={() =>
                      void handleAnswerSubmission(reconstructedWords.join(' '))
                    }
                    className="w-full min-h-[48px] rounded-xl bg-[#10B981] text-[#0F172A] text-sm font-extrabold disabled:opacity-50 touch-manipulation"
                  >
                    Submit Verse
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="rounded-2xl bg-[#111827] border border-[#1E293B] p-6 text-center space-y-3">
            <p className="text-sm text-[#94A3B8]">
              {questions.length === 0
                ? 'No playable questions were found in this showdown.'
                : 'Loading round questions...'}
            </p>
            <button
              type="button"
              onClick={onExit}
              className="min-h-[42px] px-5 rounded-xl bg-[#E11D48] text-white text-xs font-extrabold"
            >
              Return to Games Hub
            </button>
          </div>
        )}

        {isLeadership && (
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => void endMultiplayerSession(session.id)}
              className="min-h-[38px] px-4 rounded-xl border border-[#FB7185]/40 text-[#FB7185] text-xs font-bold"
            >
              End Showdown Early
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
