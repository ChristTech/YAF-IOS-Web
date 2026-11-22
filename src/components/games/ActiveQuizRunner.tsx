import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  FastForward,
  Timer,
  Trophy,
  XCircle,
} from 'lucide-react';
import { saveGameScore } from '../../services/fellowshipService';
import { getDisplayNameForAccount } from '../../utils/fellowshipLogic';
import {
  SOLO_INTERMISSION_SECONDS,
  buildSoloSimulatedStandings,
  clampRemainingSeconds,
  computeSoloPerQuestionSeconds,
  createInitialSoloQuizState,
  isGamesGuest,
  parseSoloQuizQuestions,
  reduceSoloQuizState,
} from '../../utils/gamesLogic';
import type { FellowshipAccount, GameQuiz } from '../../types/fellowship';

interface ActiveQuizRunnerProps {
  quiz: GameQuiz;
  account: FellowshipAccount;
  onExit: () => void;
}

const KAHOOT_STYLES = [
  { bg: 'bg-[#E21B3C]', shape: '▲', label: 'A' },
  { bg: 'bg-[#1368CE]', shape: '◆', label: 'B' },
  { bg: 'bg-[#D89E00]', shape: '●', label: 'C' },
  { bg: 'bg-[#26890C]', shape: '■', label: 'D' },
] as const;

export const ActiveQuizRunner: React.FC<ActiveQuizRunnerProps> = ({
  quiz,
  account,
  onExit,
}) => {
  const questions = useMemo(
    () => parseSoloQuizQuestions(quiz.questionsJson),
    [quiz.questionsJson]
  );
  const perQuestionSeconds = useMemo(
    () => computeSoloPerQuestionSeconds(quiz.timeLimitSeconds, questions.length),
    [quiz.timeLimitSeconds, questions.length]
  );

  const [state, dispatch] = useReducer(
    reduceSoloQuizState,
    {
      quizId: quiz.id,
      totalQuestions: questions.length,
      perQuestionSeconds,
      intermissionSeconds: SOLO_INTERMISSION_SECONDS,
      nowMs: Date.now(),
    },
    createInitialSoloQuizState
  );
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const startMsRef = useRef<number>(Date.now());
  const savedScoreRef = useRef<boolean>(false);

  // Reset cleanly only if a different quiz is launched
  useEffect(() => {
    if (state.quizId === quiz.id && state.totalQuestions === questions.length) return;
    startMsRef.current = Date.now();
    savedScoreRef.current = false;
    const now = Date.now();
    setNowMs(now);
    dispatch({
      type: 'RESET',
      quizId: quiz.id,
      totalQuestions: questions.length,
      perQuestionSeconds,
      intermissionSeconds: SOLO_INTERMISSION_SECONDS,
      nowMs: now,
    });
  }, [quiz.id, questions.length, perQuestionSeconds, state.quizId, state.totalQuestions]);

  const { phase, questionIndex, deadlineMs, totalPoints, correctCount, lastOutcome, peerScores } =
    state;

  const displayName = getDisplayNameForAccount(account);
  const isGuest = isGamesGuest(account.role);
  const currentQ = questions[questionIndex];

  const syncClock = useCallback(() => {
    if (phase === 'PODIUM' || questions.length === 0) return;
    const now = Date.now();
    setNowMs(now);
    if (phase === 'QUESTION' && now >= deadlineMs) {
      dispatch({
        type: 'QUESTION_TIMEOUT',
        questionIndex,
        nowMs: now,
      });
    } else if (phase === 'INTERMISSION' && now >= deadlineMs) {
      dispatch({
        type: 'ADVANCE_FROM_INTERMISSION',
        questionIndex,
        nowMs: now,
      });
    }
  }, [phase, deadlineMs, questionIndex, questions.length]);

  useEffect(() => {
    if (phase === 'PODIUM' || questions.length === 0) return;
    const interval = window.setInterval(syncClock, 250);
    const onWake = () => syncClock();
    document.addEventListener('visibilitychange', onWake);
    window.addEventListener('focus', onWake);
    window.addEventListener('pageshow', onWake);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onWake);
      window.removeEventListener('focus', onWake);
      window.removeEventListener('pageshow', onWake);
    };
  }, [syncClock, phase, questions.length]);

  // Save final score to /game_scores for non-GUEST users (score = correctCount, totalQuestions = questions.length)
  useEffect(() => {
    if (phase !== 'PODIUM' || isGuest || savedScoreRef.current || questions.length === 0) return;
    savedScoreRef.current = true;
    const elapsedSec = Math.max(1, Math.round((Date.now() - startMsRef.current) / 1000));
    void saveGameScore({
      quizId: quiz.id,
      quizTitle: quiz.title,
      account,
      score: correctCount,
      totalQuestions: Math.max(1, questions.length),
      timeTakenSeconds: elapsedSec,
    });
  }, [phase, isGuest, quiz.id, quiz.title, account, correctCount, questions.length]);

  const remainingSec = clampRemainingSeconds(
    deadlineMs,
    nowMs,
    phase === 'INTERMISSION' ? state.intermissionSeconds : perQuestionSeconds
  );

  const standings = useMemo(
    () =>
      buildSoloSimulatedStandings({
        userName: displayName,
        userScore: totalPoints,
        questionIndex,
        peerScores,
      }),
    [displayName, totalPoints, questionIndex, peerScores]
  );

  const myRank = standings.findIndex((s) => s.isCurrentUser) + 1;

  if (questions.length === 0) {
    return (
      <div className="fixed inset-0 z-[45] overflow-y-auto overscroll-contain bg-[#0F172A] text-white flex flex-col items-center justify-center p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))] text-center space-y-4">
        <h2 className="font-display text-lg font-extrabold">{quiz.title}</h2>
        <p className="text-sm text-[#94A3B8]">
          No valid questions were found in this scripture quiz.
        </p>
        <button
          type="button"
          onClick={onExit}
          className="min-h-[44px] px-6 rounded-xl bg-[#E11D48] text-white text-sm font-extrabold"
        >
          Return to Fellowship Games Hub
        </button>
      </div>
    );
  }

  // PODIUM -> LiveGamePodiumView
  if (phase === 'PODIUM') {
    const first = standings[0];
    const second = standings[1];
    const third = standings[2];

    return (
      <div className="fixed inset-0 z-[45] overflow-y-auto overscroll-contain bg-[#0B0F19] text-white flex flex-col pt-[env(safe-area-inset-top)] pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <div className="max-w-2xl w-full mx-auto px-4 py-6 space-y-5">
          <div className="text-center space-y-1">
            <span className="text-xs font-extrabold uppercase tracking-widest text-[#F59E0B]">
              {quiz.title}
            </span>
            <h2 className="font-display text-2xl font-extrabold">
              🏆 Final Podium &amp; Results
            </h2>
          </div>

          {/* 100px / 140px / 80px podium pillars */}
          <div className="rounded-2xl bg-[#111827] border border-[#1E293B] p-5">
            <div className="grid grid-cols-3 items-end gap-2 sm:gap-4 pt-3">
              <div className="flex flex-col items-center text-center">
                <span className="text-xs font-bold truncate max-w-full">{second?.name}</span>
                <span className="text-[11px] font-mono text-[#94A3B8] mb-2">
                  {second?.score ?? 0} pts
                </span>
                <div className="w-full h-[100px] rounded-t-xl bg-[#334155] border-t-4 border-[#CBD5E1] flex items-center justify-center font-extrabold text-sm">
                  #2
                </div>
              </div>

              <div className="flex flex-col items-center text-center">
                <Trophy className="w-6 h-6 text-[#F59E0B] mb-1" />
                <span className="text-xs sm:text-sm font-extrabold truncate max-w-full">
                  {first?.name}
                </span>
                <span className="text-xs font-mono font-bold text-[#FCD34D] mb-2">
                  {first?.score ?? 0} pts
                </span>
                <div className="w-full h-[140px] rounded-t-xl bg-gradient-to-b from-[#F59E0B] to-[#D97706] text-[#0F172A] flex items-center justify-center font-extrabold text-base">
                  #1 👑
                </div>
              </div>

              <div className="flex flex-col items-center text-center">
                <span className="text-xs font-bold truncate max-w-full">{third?.name}</span>
                <span className="text-[11px] font-mono text-[#94A3B8] mb-2">
                  {third?.score ?? 0} pts
                </span>
                <div className="w-full h-[80px] rounded-t-xl bg-[#78350F] border-t-4 border-[#F97316] flex items-center justify-center font-extrabold text-sm">
                  #3
                </div>
              </div>
            </div>
          </div>

          {/* Individual Standing & Role Callout */}
          <div className="rounded-2xl bg-[#111827] border border-[#E11D48]/50 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#F59E0B]">
                  YOUR FINAL STANDING
                </span>
                <p className="text-base font-extrabold">
                  Rank #{myRank} • {correctCount} / {questions.length} Correct
                </p>
              </div>
              <span className="text-xl font-extrabold font-mono text-[#F59E0B]">
                {totalPoints} pts
              </span>
            </div>
            <p className="text-xs text-[#CBD5E1]">
              {isGuest
                ? 'Guest reminder: Sign up as a Youth Member to save scores to the fellowship leaderboard!'
                : 'Great effort! Your score has been synced to the Youth Global Leaderboard.'}
            </p>
          </div>

          {/* Final Top 5 */}
          <div className="rounded-2xl bg-[#111827] border border-[#1E293B] p-4 space-y-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#94A3B8]">
              Final Top 5 Standings
            </h3>
            {standings.slice(0, 5).map((entry, idx) => (
              <div
                key={entry.id}
                className={`rounded-xl px-3.5 py-2.5 flex items-center justify-between ${
                  entry.isCurrentUser
                    ? 'bg-[#E11D48]/20 border border-[#E11D48]/60'
                    : 'bg-[#1F2937]/70'
                }`}
              >
                <span className="text-sm font-bold">
                  #{idx + 1} {entry.name} {entry.isCurrentUser ? '★ YOU' : ''}
                </span>
                <span className="text-sm font-extrabold font-mono">{entry.score} pts</span>
              </div>
            ))}
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

  // INTERMISSION -> LiveIntermissionLeaderboardView
  if (phase === 'INTERMISSION') {
    const isLast = questionIndex + 1 >= questions.length;
    const revealedQ = questions[lastOutcome.questionIndex] || currentQ;
    return (
      <div className="fixed inset-0 z-[45] overflow-y-auto overscroll-contain bg-[#0F172A] text-white flex flex-col pt-[env(safe-area-inset-top)] pb-[calc(2rem+env(safe-area-inset-bottom))]">
        <div className="max-w-2xl w-full mx-auto px-4 py-5 space-y-4">
          <div className="rounded-2xl bg-[#111827] border border-[#1E293B] p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-extrabold text-[#F59E0B]">SCOREBOARD</span>
              <p className="text-xs text-[#94A3B8]">
                Question {questionIndex + 1} of {questions.length}
              </p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-[#E11D48] flex items-center justify-center font-mono text-2xl font-extrabold tabular-nums">
              {remainingSec}
            </div>
          </div>

          {/* Answer Reveal Card */}
          {lastOutcome.answered ? (
            lastOutcome.isCorrect ? (
              <div className="rounded-2xl bg-[#065F46]/40 border border-[#10B981] p-4 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-[#34D399] shrink-0" />
                <div>
                  <p className="text-sm font-extrabold text-[#34D399]">
                    Correct! +{lastOutcome.pointsAwarded} pts
                  </p>
                  <p className="text-xs text-[#CBD5E1]">
                    Answer: {revealedQ?.options[revealedQ.correctAnswerIndex]}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-[#9F1239]/40 border border-[#FB7185] p-4 flex items-center gap-3">
                <XCircle className="w-6 h-6 text-[#FB7185] shrink-0" />
                <div>
                  <p className="text-sm font-extrabold text-[#FDA4AF]">Incorrect</p>
                  <p className="text-xs text-[#CBD5E1]">
                    Correct Answer: {revealedQ?.options[revealedQ.correctAnswerIndex]}
                  </p>
                </div>
              </div>
            )
          ) : (
            <div className="rounded-2xl bg-[#78350F]/40 border border-[#F59E0B] p-4 flex items-center gap-3">
              <Clock className="w-6 h-6 text-[#FCD34D] shrink-0" />
              <div>
                <p className="text-sm font-extrabold text-[#FCD34D]">Time&apos;s Up!</p>
                <p className="text-xs text-[#CBD5E1]">
                  Correct Answer: {revealedQ?.options[revealedQ.correctAnswerIndex]}
                </p>
              </div>
            </div>
          )}

          {revealedQ?.scriptureRef && (
            <span className="inline-block px-3 py-1 rounded-full bg-[#F59E0B]/20 text-[#FCD34D] text-xs font-bold">
              📖 Scripture Insight: {revealedQ.scriptureRef}
            </span>
          )}

          {/* Top 5 Rows */}
          <div className="rounded-2xl bg-[#111827] border border-[#1E293B] p-4 space-y-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#94A3B8]">
              Top 5 Standings
            </h3>
            {standings.slice(0, 5).map((entry, idx) => (
              <div
                key={entry.id}
                className={`rounded-xl px-3.5 py-2.5 flex items-center justify-between transition-all ${
                  entry.isCurrentUser
                    ? 'bg-[#E11D48]/20 border border-[#E11D48]/60'
                    : 'bg-[#1F2937]/70'
                }`}
              >
                <span className="text-sm font-bold">
                  #{idx + 1} {entry.name}
                </span>
                <span className="text-sm font-extrabold font-mono">{entry.score} pts</span>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-[#0B0F19] border border-[#334155] p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#94A3B8]">
                YOUR STANDING
              </span>
              <p className="text-sm font-extrabold">
                Rank #{myRank} of {standings.length}
              </p>
            </div>
            <span className="text-lg font-extrabold font-mono text-[#F59E0B]">
              {totalPoints} pts
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              const now = Date.now();
              setNowMs(now);
              dispatch({
                type: 'ADVANCE_FROM_INTERMISSION',
                questionIndex,
                nowMs: now,
                force: true,
              });
            }}
            className="w-full min-h-[46px] rounded-xl bg-[#F59E0B] text-[#0F172A] text-sm font-extrabold inline-flex items-center justify-center gap-2"
          >
            <FastForward className="w-4 h-4" />
            <span>
              {isLast
                ? `See Final Results (${remainingSec}s) 🏆`
                : `Next Question (${remainingSec}s)`}
            </span>
          </button>
        </div>
      </div>
    );
  }

  // QUESTION PHASE (Kahoot-style 4 cards)
  return (
    <div className="fixed inset-0 z-[45] overflow-hidden bg-[#0F172A] text-white flex flex-col pt-[env(safe-area-inset-top)]">
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

          <div className="text-center">
            <span className="text-[11px] font-bold text-[#F59E0B] block">
              Question {questionIndex + 1} of {questions.length}
            </span>
            <h2 className="text-xs font-bold truncate max-w-[180px] sm:max-w-xs">
              {quiz.title}
            </h2>
          </div>

          <span
            className={`px-3 py-1 rounded-xl font-mono text-sm font-extrabold tabular-nums inline-flex items-center gap-1 ${
              remainingSec <= 5 ? 'bg-[#E11D48] text-white' : 'bg-[#F59E0B] text-[#0F172A]'
            }`}
          >
            <Timer className="w-3.5 h-3.5" />
            <span>{remainingSec}s</span>
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pt-5 pb-[calc(2rem+env(safe-area-inset-bottom))] max-w-2xl w-full mx-auto space-y-4 flex flex-col justify-center">
        {currentQ && (
          <>
            <div className="rounded-2xl bg-[#111827] border border-[#1E293B] p-5 space-y-2 text-center">
              {currentQ.scriptureRef && (
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-[#F59E0B]/20 text-[#FCD34D] text-[11px] font-bold">
                  {currentQ.scriptureRef}
                </span>
              )}
              <h3 className="text-base sm:text-xl font-extrabold leading-snug text-white">
                {currentQ.question}
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {currentQ.options.slice(0, 4).map((opt, idx) => {
                const style = KAHOOT_STYLES[idx] || KAHOOT_STYLES[0];

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      const now = Date.now();
                      setNowMs(now);
                      dispatch({
                        type: 'SELECT_ANSWER',
                        questionIndex,
                        optionIndex: idx,
                        correctAnswerIndex: currentQ.correctAnswerIndex,
                        nowMs: now,
                      });
                    }}
                    className={`min-h-[72px] rounded-2xl p-4 text-left text-white font-extrabold flex items-center gap-3 transition-all touch-manipulation shadow-md ${style.bg} hover:brightness-110`}
                  >
                    <span className="w-9 h-9 rounded-xl bg-black/25 flex items-center justify-center text-base shrink-0">
                      {style.shape}
                    </span>
                    <span className="text-sm sm:text-base break-words">{opt}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
