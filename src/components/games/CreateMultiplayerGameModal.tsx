import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Edit3,
  Eye,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  PresetGameSessions,
  buildLocalizedSessionTitles,
} from '../../data/presetGameSessions';
import {
  publishMultiplayerSession,
  saveDraftMultiplayerSession,
} from '../../services/fellowshipService';
import { formatActionErrorMessage } from '../../utils/fellowshipLogic';
import {
  getGameTypeDefaultTimer,
  parseMultiplayerQuestions,
  scrambleVerse,
} from '../../utils/gamesLogic';
import { BiblePickerModal } from '../BiblePickerModal';
import {
  QuestionPreviewModal,
  TailoredQuestionEditorModal,
} from './TailoredQuestionEditorModal';
import type { BibleVerseItem } from '../../data/bibleData';
import type {
  DailyScriptureDoc,
  FellowshipAccount,
  GameType,
  LanguageCode,
  MultiplayerQuestion,
  QuizSession,
  UploadedBibleDoc,
} from '../../types/fellowship';

interface CreateMultiplayerGameModalProps {
  isOpen: boolean;
  account: FellowshipAccount;
  language: LanguageCode;
  uploadedBibles: UploadedBibleDoc[];
  scriptureDocs: DailyScriptureDoc[];
  initialDraftSession?: QuizSession | null;
  initialSelectedVerse?: (BibleVerseItem & { translation?: string }) | null;
  initialGameType?: GameType;
  onClose: () => void;
  onSavedDraft?: (session: QuizSession) => void;
  onLaunchedSession?: (session: QuizSession) => void;
  onScheduledSession?: (session: QuizSession) => void;
}

const GAME_TYPES: {
  id: GameType;
  emoji: string;
  title: string;
  sub: string;
}[] = [
  { id: 'TRIVIA_CHALLENGE', emoji: '⚡', title: 'Trivia Challenge', sub: '4 Options & Speed' },
  { id: 'WHO_AM_I', emoji: '🕵️', title: 'Who Am I?', sub: 'Progressive Clues' },
  { id: 'SCRIPTURE_SCRAMBLE', emoji: '🧩', title: 'Scripture Scramble', sub: 'Verse Scramble' },
];

const SCHEDULE_OPTIONS = [
  { minutes: 0, label: '🚀 Start Now' },
  { minutes: 2, label: '2 mins' },
  { minutes: 5, label: '5 mins' },
  { minutes: 15, label: '15 mins' },
] as const;

const TIMER_OPTIONS = [15, 20, 30, 45] as const;
const BASE_SCORE_OPTIONS = [50, 100, 200] as const;

export const CreateMultiplayerGameModal: React.FC<
  CreateMultiplayerGameModalProps
> = ({
  isOpen,
  account,
  language,
  uploadedBibles,
  scriptureDocs,
  initialDraftSession = null,
  initialSelectedVerse = null,
  initialGameType,
  onClose,
  onSavedDraft,
  onLaunchedSession,
  onScheduledSession,
}) => {
  const [titleEn, setTitleEn] = useState('');
  const [description, setDescription] = useState('');
  const [gameType, setGameType] = useState<GameType>('TRIVIA_CHALLENGE');
  const [delayMinutes, setDelayMinutes] = useState<number>(0);
  const [timerSeconds, setTimerSeconds] = useState<number>(20);
  const [baseScore, setBaseScore] = useState<number>(100);
  const [speedBonusEnabled, setSpeedBonusEnabled] = useState<boolean>(true);
  const [questions, setQuestions] = useState<MultiplayerQuestion[]>([]);
  const [hasCustomEdits, setHasCustomEdits] = useState(false);
  const [pendingModeSwitch, setPendingModeSwitch] = useState<GameType | null>(null);

  const [editingQuestionIdx, setEditingQuestionIdx] = useState<number | null>(null);
  const [showQuestionEditor, setShowQuestionEditor] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<{
    q: MultiplayerQuestion;
    idx: number;
  } | null>(null);
  const [showBiblePicker, setShowBiblePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setPendingModeSwitch(null);

    if (initialDraftSession) {
      const gt = initialDraftSession.gameType || 'TRIVIA_CHALLENGE';
      const parsed = parseMultiplayerQuestions(initialDraftSession.questionsJson);
      setTitleEn(initialDraftSession.titleEn || initialDraftSession.title || '');
      setDescription(initialDraftSession.description || '');
      setGameType(gt);
      setDelayMinutes(0); // Editing a DRAFT defaults delay to 0 (Start Now)
      setTimerSeconds(
        initialDraftSession.timeLimitPerQuestionSeconds || getGameTypeDefaultTimer(gt)
      );
      setBaseScore(initialDraftSession.baseScorePerQuestion || 100);
      setSpeedBonusEnabled(initialDraftSession.speedBonusEnabled !== false);
      setQuestions(
        parsed.length > 0 ? parsed : PresetGameSessions.getPresetQuestions(gt, language)
      );
      setHasCustomEdits(true);
      return;
    }

    if (initialSelectedVerse) {
      const gt: GameType = 'SCRIPTURE_SCRAMBLE';
      setGameType(gt);
      setTitleEn(`Scripture Scramble: ${initialSelectedVerse.reference}`);
      setDescription('Reconstruct the scripture verse as fast as you can');
      setDelayMinutes(0);
      setTimerSeconds(30);
      setBaseScore(100);
      setSpeedBonusEnabled(true);
      setQuestions([
        {
          id: `mq_verse_${Date.now()}`,
          gameType: 'SCRIPTURE_SCRAMBLE',
          prompt: 'Reconstruct the scrambled scripture in exact order',
          options: [],
          correctAnswer: initialSelectedVerse.text,
          clues: [],
          scrambledWords: scrambleVerse(initialSelectedVerse.text),
          scriptureReference: initialSelectedVerse.reference,
          translation: initialSelectedVerse.translation || 'KJV',
          timerSeconds: 30,
          points: 100,
          explanation: `${initialSelectedVerse.reference} (${initialSelectedVerse.translation || 'KJV'})`,
        },
      ]);
      setHasCustomEdits(true);
      return;
    }

    const startType: GameType = initialGameType || 'TRIVIA_CHALLENGE';
    const titles = buildLocalizedSessionTitles(startType);
    setGameType(startType);
    setTitleEn(titles.titleEn);
    setDescription('Live Youth Alive Fellowship Bible Showdown');
    setDelayMinutes(0);
    setTimerSeconds(getGameTypeDefaultTimer(startType));
    setBaseScore(100);
    setSpeedBonusEnabled(true);
    setQuestions(PresetGameSessions.getPresetQuestions(startType, language));
    setHasCustomEdits(false);
  }, [isOpen, initialDraftSession, initialSelectedVerse, initialGameType, language]);

  if (!isOpen) return null;

  const applyModeSwitch = (nextType: GameType) => {
    setGameType(nextType);
    setTimerSeconds(getGameTypeDefaultTimer(nextType));
    setQuestions(PresetGameSessions.getPresetQuestions(nextType, language));
    if (!initialDraftSession) {
      const titles = buildLocalizedSessionTitles(nextType);
      setTitleEn(titles.titleEn);
    }
    setHasCustomEdits(false);
    setPendingModeSwitch(null);
  };

  const handleSelectGameType = (nextType: GameType) => {
    if (nextType === gameType) return;
    if (hasCustomEdits && questions.length > 0) {
      setPendingModeSwitch(nextType);
    } else {
      applyModeSwitch(nextType);
    }
  };

  const handleAppendBibleVerse = (verse: BibleVerseItem & { translation?: string }) => {
    if (gameType === 'SCRIPTURE_SCRAMBLE') {
      const newQ: MultiplayerQuestion = {
        id: `mq_db_${Date.now()}`,
        gameType: 'SCRIPTURE_SCRAMBLE',
        prompt: 'Reconstruct the scrambled scripture in exact order',
        options: [],
        correctAnswer: verse.text,
        clues: [],
        scrambledWords: scrambleVerse(verse.text),
        scriptureReference: verse.reference,
        translation: verse.translation || 'KJV',
        timerSeconds,
        points: baseScore,
        explanation: `${verse.reference} — ${verse.text}`,
      };
      setQuestions((prev) => [...prev, newQ]);
      setHasCustomEdits(true);
      return;
    }

    if (gameType === 'TRIVIA_CHALLENGE') {
      const newQ: MultiplayerQuestion = {
        id: `mq_db_${Date.now()}`,
        gameType: 'TRIVIA_CHALLENGE',
        prompt: `What is the core declaration of ${verse.reference}?`,
        options: [
          verse.text.slice(0, 75),
          'The race is solely to the swift',
          'Walk only by human understanding',
          'Keep silent in the day of battle',
        ],
        correctAnswer: verse.text.slice(0, 75),
        clues: [],
        scrambledWords: [],
        scriptureReference: verse.reference,
        translation: verse.translation || 'KJV',
        timerSeconds,
        points: baseScore,
        explanation: `${verse.reference}: "${verse.text}"`,
      };
      setQuestions((prev) => [...prev, newQ]);
      setHasCustomEdits(true);
      return;
    }

    const newQ: MultiplayerQuestion = {
      id: `mq_db_${Date.now()}`,
      gameType: 'WHO_AM_I',
      prompt: 'Who or what does this Scripture speak about?',
      options: [],
      correctAnswer: verse.book,
      clues: [
        `Referenced in ${verse.reference}`,
        `Key phrase: "${verse.text.slice(0, 65)}..."`,
        `Theme: ${verse.theme}`,
      ],
      scrambledWords: [],
      scriptureReference: verse.reference,
      translation: verse.translation || 'KJV',
      timerSeconds,
      points: baseScore,
      explanation: `${verse.reference}: "${verse.text}"`,
    };
    setQuestions((prev) => [...prev, newQ]);
    setHasCustomEdits(true);
  };

  const handleSaveDraft = async () => {
    setErrorMsg(null);
    if (!titleEn.trim()) {
      setErrorMsg('Please enter a showdown title.');
      return;
    }
    if (questions.length === 0) {
      setErrorMsg('Please add at least 1 question or round.');
      return;
    }
    setSubmitting(true);
    try {
      const saved = await saveDraftMultiplayerSession({
        existingSessionId: initialDraftSession?.id,
        existingSession: initialDraftSession,
        host: account,
        titleEn: titleEn.trim(),
        description: description.trim(),
        gameType,
        timeLimitPerQuestionSeconds: timerSeconds,
        baseScorePerQuestion: baseScore,
        speedBonusEnabled,
        maxSpeedBonus: 50,
        questions,
      });
      onSavedDraft?.(saved);
      onClose();
    } catch (err) {
      setErrorMsg(formatActionErrorMessage(err, 'Unable to save draft.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublishOrLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!titleEn.trim()) {
      setErrorMsg('Please enter a showdown title.');
      return;
    }
    if (questions.length === 0) {
      setErrorMsg('Please add at least 1 question or round.');
      return;
    }
    setSubmitting(true);
    try {
      const session = await publishMultiplayerSession({
        existingSessionId: initialDraftSession?.id,
        existingSession: initialDraftSession,
        host: account,
        titleEn: titleEn.trim(),
        description: description.trim(),
        gameType,
        delayMinutes,
        timeLimitPerQuestionSeconds: timerSeconds,
        baseScorePerQuestion: baseScore,
        speedBonusEnabled,
        maxSpeedBonus: 50,
        questions,
      });
      if (delayMinutes === 0) {
        onLaunchedSession?.(session);
      } else {
        onScheduledSession?.(session);
      }
      onClose();
    } catch (err) {
      setErrorMsg(formatActionErrorMessage(err, 'Unable to publish multiplayer game.'));
    } finally {
      setSubmitting(false);
    }
  };

  const moveQuestion = (idx: number, delta: -1 | 1) => {
    const target = idx + delta;
    if (target < 0 || target >= questions.length) return;
    setQuestions((prev) => {
      const copy = [...prev];
      const tmp = copy[idx];
      copy[idx] = copy[target];
      copy[target] = tmp;
      return copy;
    });
    setHasCustomEdits(true);
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-mp-game-title"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 sm:p-6 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
      >
        <form
          onSubmit={handlePublishOrLaunch}
          className="w-full max-w-2xl max-h-[90dvh] flex flex-col rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-[#0F172A] text-white px-5 py-4 flex items-center justify-between gap-2 shrink-0">
            <div className="min-w-0">
              {initialDraftSession && (
                <span className="inline-block mb-1 px-2 py-0.5 rounded bg-[#F59E0B] text-[#0F172A] text-[10px] font-extrabold tracking-wider">
                  EDITING SAVED DRAFT
                </span>
              )}
              <h3 id="create-mp-game-title" className="font-display text-base font-bold truncate">
                {initialDraftSession ? 'Edit Multiplayer Showdown' : 'Create / Schedule Multiplayer Game'}
              </h3>
            </div>
            <button
              type="button"
              aria-label="Close multiplayer game creator"
              onClick={onClose}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#94A3B8] hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Form Body */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4">
            {errorMsg && (
              <div
                role="alert"
                className="rounded-xl bg-[#FFF1F2] dark:bg-[#9F1239]/25 border border-[#E11D48]/40 px-3 py-2 text-xs font-semibold text-[#9F1239] dark:text-[#FECDD3]"
              >
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="mp-title-input"
                  className="block text-xs font-semibold mb-1 text-[#334155] dark:text-[#CBD5E1]"
                >
                  Showdown Title *
                </label>
                <input
                  id="mp-title-input"
                  type="text"
                  required
                  value={titleEn}
                  onChange={(e) => setTitleEn(e.target.value)}
                  placeholder="Sunday Youth Bible Showdown"
                  className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm text-[#0F172A] dark:text-white"
                />
              </div>
              <div>
                <label
                  htmlFor="mp-desc-input"
                  className="block text-xs font-semibold mb-1 text-[#334155] dark:text-[#CBD5E1]"
                >
                  Description (optional)
                </label>
                <input
                  id="mp-desc-input"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional theme or instructions"
                  className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm text-[#0F172A] dark:text-white"
                />
              </div>
            </div>

            {/* Game Type Cards */}
            <div className="space-y-1.5">
              <span className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1]">
                Game Mode
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {GAME_TYPES.map((gt) => (
                  <button
                    key={gt.id}
                    type="button"
                    onClick={() => handleSelectGameType(gt.id)}
                    className={`p-3 rounded-xl border text-left transition-all touch-manipulation ${
                      gameType === gt.id
                        ? 'bg-[#FFF1F2] dark:bg-[#E11D48]/20 border-[#E11D48] ring-1 ring-[#E11D48]'
                        : 'bg-[#F8FAFC] dark:bg-[#1F2937] border-[#E2E8F0] dark:border-[#374151]'
                    }`}
                  >
                    <div className="text-base">{gt.emoji}</div>
                    <div className="text-xs font-extrabold text-[#0F172A] dark:text-white mt-0.5">
                      {gt.title}
                    </div>
                    <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">{gt.sub}</div>
                  </button>
                ))}
              </div>

              {pendingModeSwitch && (
                <div className="rounded-xl bg-[#FEF3C7] dark:bg-[#F59E0B]/20 border border-[#F59E0B]/60 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-[#92400E] dark:text-[#FEF3C7]">
                    Switching to {GAME_TYPES.find((g) => g.id === pendingModeSwitch)?.title} will replace your current edited questions with presets.
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setPendingModeSwitch(null)}
                      className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#1F2937] font-bold text-[#0F172A] dark:text-white"
                    >
                      Keep Current
                    </button>
                    <button
                      type="button"
                      onClick={() => applyModeSwitch(pendingModeSwitch)}
                      className="px-2.5 py-1 rounded-lg bg-[#E11D48] text-white font-bold"
                    >
                      Replace &amp; Switch
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Schedule, Timer, Base Score & Speed Bonus */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="block text-xs font-semibold mb-1.5 text-[#334155] dark:text-[#CBD5E1]">
                  Start Schedule ({delayMinutes === 0 ? 'Launches Now' : `In ${delayMinutes}m`})
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {SCHEDULE_OPTIONS.map((opt) => (
                    <button
                      key={opt.minutes}
                      type="button"
                      onClick={() => setDelayMinutes(opt.minutes)}
                      className={`min-h-[36px] px-3 rounded-xl text-xs font-bold border touch-manipulation ${
                        delayMinutes === opt.minutes
                          ? 'bg-[#E11D48] text-white border-[#E11D48]'
                          : 'bg-[#F8FAFC] dark:bg-[#1F2937] text-[#334155] dark:text-[#CBD5E1] border-[#E2E8F0] dark:border-[#374151]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-xs font-semibold mb-1.5 text-[#334155] dark:text-[#CBD5E1]">
                  Question Timer
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {TIMER_OPTIONS.map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setTimerSeconds(sec)}
                      className={`min-h-[36px] px-3 rounded-xl text-xs font-bold border touch-manipulation ${
                        timerSeconds === sec
                          ? 'bg-[#0F172A] dark:bg-[#F59E0B] text-white dark:text-[#0F172A] border-transparent'
                          : 'bg-[#F8FAFC] dark:bg-[#1F2937] text-[#334155] dark:text-[#CBD5E1] border-[#E2E8F0] dark:border-[#374151]'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="block text-xs font-semibold mb-1.5 text-[#334155] dark:text-[#CBD5E1]">
                  Base Score
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {BASE_SCORE_OPTIONS.map((pts) => (
                    <button
                      key={pts}
                      type="button"
                      onClick={() => setBaseScore(pts)}
                      className={`min-h-[36px] px-3 rounded-xl text-xs font-bold border touch-manipulation ${
                        baseScore === pts
                          ? 'bg-[#F59E0B] text-[#0F172A] border-[#F59E0B]'
                          : 'bg-[#F8FAFC] dark:bg-[#1F2937] text-[#334155] dark:text-[#CBD5E1] border-[#E2E8F0] dark:border-[#374151]'
                      }`}
                    >
                      {pts}p
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] px-3.5 py-2.5">
                <div>
                  <span className="text-xs font-bold text-[#0F172A] dark:text-white block">
                    Speed Bonus (+50 max)
                  </span>
                  <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                    Reward faster accurate answers
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={speedBonusEnabled}
                  aria-label="Toggle speed bonus"
                  onClick={() => setSpeedBonusEnabled((v) => !v)}
                  className={`w-12 h-7 rounded-full transition-colors p-1 shrink-0 ${
                    speedBonusEnabled ? 'bg-[#10B981]' : 'bg-[#CBD5E1] dark:bg-[#475569]'
                  }`}
                >
                  <span
                    className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      speedBonusEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Questions & Rounds Header */}
            <div className="pt-2 border-t border-[#E2E8F0] dark:border-[#374151] space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
                  QUESTIONS &amp; ROUNDS ({questions.length})
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingQuestionIdx(null);
                      setShowQuestionEditor(true);
                    }}
                    className="min-h-[36px] px-3 rounded-xl bg-[#E11D48] text-white text-xs font-bold inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Question</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBiblePicker(true)}
                    className="min-h-[36px] px-3 rounded-xl bg-[#FEF3C7] dark:bg-[#F59E0B]/20 text-[#92400E] dark:text-[#FCD34D] text-xs font-bold inline-flex items-center gap-1"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Bible DB</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setQuestions(PresetGameSessions.getPresetQuestions(gameType, language));
                      setHasCustomEdits(false);
                    }}
                    className="min-h-[36px] px-3 rounded-xl bg-[#F1F5F9] dark:bg-[#1F2937] text-[#0F172A] dark:text-white text-xs font-bold inline-flex items-center gap-1"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#F59E0B]" />
                    <span>Load Presets</span>
                  </button>
                </div>
              </div>

              {/* QuestionAdminCard list */}
              {questions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#CBD5E1] dark:border-[#374151] p-6 text-center text-xs text-[#64748B]">
                  No rounds added yet. Click “Add Question”, “Bible DB”, or “Load Presets”.
                </div>
              ) : (
                <div className="space-y-2">
                  {questions.map((q, idx) => (
                    <div
                      key={q.id}
                      className="rounded-xl border border-[#E2E8F0] dark:border-[#374151] bg-[#F8FAFC] dark:bg-[#1F2937] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                          <span className="font-extrabold text-[#E11D48]">Round {idx + 1}</span>
                          {q.scriptureReference && (
                            <>
                              <span>•</span>
                              <span className="font-semibold text-[#F59E0B]">
                                {q.scriptureReference}
                              </span>
                            </>
                          )}
                          <span>•</span>
                          <span>{q.timerSeconds > 0 ? q.timerSeconds : timerSeconds}s</span>
                          <span>•</span>
                          <span>{q.points > 0 ? q.points : baseScore}p</span>
                        </div>
                        <p className="text-xs font-bold text-[#0F172A] dark:text-white truncate mt-0.5">
                          {q.gameType === 'SCRIPTURE_SCRAMBLE'
                            ? q.correctAnswer
                            : q.gameType === 'WHO_AM_I'
                            ? `${q.correctAnswer} (${q.clues.length} clues)`
                            : q.prompt}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          aria-label={`Move round ${idx + 1} up`}
                          onClick={() => moveQuestion(idx, -1)}
                          className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] disabled:opacity-35"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === questions.length - 1}
                          aria-label={`Move round ${idx + 1} down`}
                          onClick={() => moveQuestion(idx, 1)}
                          className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] disabled:opacity-35"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Preview round ${idx + 1}`}
                          onClick={() => setPreviewTarget({ q, idx })}
                          className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] text-[#3B82F6]"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Edit round ${idx + 1}`}
                          onClick={() => {
                            setEditingQuestionIdx(idx);
                            setShowQuestionEditor(true);
                          }}
                          className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] text-[#F59E0B]"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete round ${idx + 1}`}
                          onClick={() => {
                            setQuestions((prev) => prev.filter((_, i) => i !== idx));
                            setHasCustomEdits(true);
                          }}
                          className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] text-[#E11D48]"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sticky Bottom Action Bar (flex-wrap for 320px-390px safety) */}
          <div className="px-4 sm:px-5 py-3.5 bg-[#F8FAFC] dark:bg-[#0B0F19] border-t border-[#E2E8F0] dark:border-[#374151] flex flex-wrap items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] px-4 rounded-xl bg-white dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-xs font-bold text-[#0F172A] dark:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submitting || !titleEn.trim() || questions.length === 0}
              onClick={handleSaveDraft}
              className="min-h-[42px] px-4 rounded-xl bg-[#F59E0B] text-[#0F172A] text-xs font-extrabold disabled:opacity-50"
            >
              Save Draft
            </button>
            <button
              type="submit"
              disabled={submitting || !titleEn.trim() || questions.length === 0}
              className="min-h-[42px] px-5 rounded-xl bg-[#E11D48] text-white text-xs sm:text-sm font-extrabold disabled:opacity-50"
            >
              {submitting
                ? 'Syncing...'
                : delayMinutes === 0
                ? 'Launch Showdown Now'
                : 'Publish & Schedule Game'}
            </button>
          </div>
        </form>
      </div>

      <TailoredQuestionEditorModal
        isOpen={showQuestionEditor}
        gameType={gameType}
        initialQuestion={editingQuestionIdx !== null ? questions[editingQuestionIdx] : null}
        defaultTimerSeconds={timerSeconds}
        defaultPoints={baseScore}
        account={account}
        uploadedBibles={uploadedBibles}
        scriptureDocs={scriptureDocs}
        onClose={() => {
          setShowQuestionEditor(false);
          setEditingQuestionIdx(null);
        }}
        onSave={(savedQ) => {
          setHasCustomEdits(true);
          if (editingQuestionIdx !== null) {
            setQuestions((prev) =>
              prev.map((q, i) => (i === editingQuestionIdx ? savedQ : q))
            );
          } else {
            setQuestions((prev) => [...prev, savedQ]);
          }
        }}
      />

      <QuestionPreviewModal
        question={previewTarget?.q || null}
        index={previewTarget?.idx || 0}
        onClose={() => setPreviewTarget(null)}
      />

      <BiblePickerModal
        isOpen={showBiblePicker}
        onClose={() => setShowBiblePicker(false)}
        uploadedBibles={uploadedBibles}
        scriptureDocs={scriptureDocs}
        account={account}
        pickerMode={true}
        onPickVerse={handleAppendBibleVerse}
      />
    </>
  );
};
