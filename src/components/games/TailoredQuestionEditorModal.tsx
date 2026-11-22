import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Eye, Plus, Trash2, X } from 'lucide-react';
import { BiblePickerModal } from '../BiblePickerModal';
import {
  getGameTypeDefaultTimer,
  getGameTypeDisplayName,
  scrambleVerse,
} from '../../utils/gamesLogic';
import type {
  DailyScriptureDoc,
  FellowshipAccount,
  GameType,
  MultiplayerQuestion,
  UploadedBibleDoc,
} from '../../types/fellowship';

interface TailoredQuestionEditorModalProps {
  isOpen: boolean;
  gameType: GameType;
  initialQuestion?: MultiplayerQuestion | null;
  defaultTimerSeconds: number;
  defaultPoints: number;
  account: FellowshipAccount;
  uploadedBibles: UploadedBibleDoc[];
  scriptureDocs: DailyScriptureDoc[];
  onClose: () => void;
  onSave: (question: MultiplayerQuestion) => void;
}

export const TailoredQuestionEditorModal: React.FC<
  TailoredQuestionEditorModalProps
> = ({
  isOpen,
  gameType,
  initialQuestion,
  defaultTimerSeconds,
  defaultPoints,
  account,
  uploadedBibles,
  scriptureDocs,
  onClose,
  onSave,
}) => {
  const [prompt, setPrompt] = useState('');
  const [scriptureReference, setScriptureReference] = useState('');
  const [translation, setTranslation] = useState('KJV');
  const [options, setOptions] = useState<string[]>(['', '', '', '']);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [targetAnswer, setTargetAnswer] = useState('');
  const [clues, setClues] = useState<string[]>(['', '']);
  const [explanation, setExplanation] = useState('');
  const [timerSeconds, setTimerSeconds] = useState(defaultTimerSeconds);
  const [points, setPoints] = useState(defaultPoints);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showBiblePicker, setShowBiblePicker] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    if (initialQuestion) {
      setPrompt(initialQuestion.prompt || '');
      setScriptureReference(initialQuestion.scriptureReference || '');
      setTranslation(initialQuestion.translation || 'KJV');
      const opts =
        initialQuestion.options && initialQuestion.options.length >= 4
          ? initialQuestion.options.slice(0, 4)
          : ['', '', '', ''];
      setOptions(opts);
      const foundIdx = opts.findIndex(
        (o) => o.trim().toLowerCase() === (initialQuestion.correctAnswer || '').trim().toLowerCase()
      );
      setCorrectIndex(foundIdx >= 0 ? foundIdx : 0);
      setTargetAnswer(initialQuestion.correctAnswer || '');
      setClues(
        initialQuestion.clues && initialQuestion.clues.length >= 2
          ? initialQuestion.clues.slice(0, 4)
          : ['', '']
      );
      setExplanation(initialQuestion.explanation || '');
      setTimerSeconds(
        initialQuestion.timerSeconds > 0
          ? initialQuestion.timerSeconds
          : defaultTimerSeconds || getGameTypeDefaultTimer(gameType)
      );
      setPoints(initialQuestion.points > 0 ? initialQuestion.points : defaultPoints);
    } else {
      setPrompt('');
      setScriptureReference('');
      setTranslation('KJV');
      setOptions(['', '', '', '']);
      setCorrectIndex(0);
      setTargetAnswer('');
      setClues(['', '']);
      setExplanation('');
      setTimerSeconds(defaultTimerSeconds || getGameTypeDefaultTimer(gameType));
      setPoints(defaultPoints || 100);
    }
  }, [isOpen, initialQuestion, gameType, defaultTimerSeconds, defaultPoints]);

  const scrambledPreview = useMemo(() => {
    if (gameType !== 'SCRIPTURE_SCRAMBLE' || !targetAnswer.trim()) return [];
    return scrambleVerse(targetAnswer.trim());
  }, [gameType, targetAnswer]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (gameType === 'TRIVIA_CHALLENGE') {
      const cleanOpts = options.map((o) => o.trim());
      if (!prompt.trim()) {
        setErrorMsg('Please enter the Trivia question prompt.');
        return;
      }
      if (cleanOpts.some((o) => !o)) {
        setErrorMsg('Please fill all 4 options (A, B, C, D).');
        return;
      }
      onSave({
        id: initialQuestion?.id || `mq_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        gameType,
        prompt: prompt.trim(),
        options: cleanOpts,
        correctAnswer: cleanOpts[correctIndex] || cleanOpts[0],
        clues: [],
        scrambledWords: [],
        scriptureReference: scriptureReference.trim(),
        translation: translation.trim() || 'KJV',
        timerSeconds: Math.max(5, Number(timerSeconds) || defaultTimerSeconds),
        points: Math.max(10, Number(points) || defaultPoints),
        explanation: explanation.trim(),
      });
      onClose();
      return;
    }

    if (gameType === 'WHO_AM_I') {
      const cleanClues = clues.map((c) => c.trim()).filter(Boolean);
      if (!targetAnswer.trim()) {
        setErrorMsg('Please enter the Target Bible Character / Answer.');
        return;
      }
      if (cleanClues.length < 2) {
        setErrorMsg('Please provide at least 2 progressive clues.');
        return;
      }
      onSave({
        id: initialQuestion?.id || `mq_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        gameType,
        prompt: prompt.trim() || 'Who Am I in Scripture?',
        options: [],
        correctAnswer: targetAnswer.trim(),
        clues: cleanClues.slice(0, 4),
        scrambledWords: [],
        scriptureReference: scriptureReference.trim(),
        translation: translation.trim() || 'KJV',
        timerSeconds: Math.max(5, Number(timerSeconds) || defaultTimerSeconds),
        points: Math.max(10, Number(points) || defaultPoints),
        explanation: explanation.trim(),
      });
      onClose();
      return;
    }

    // SCRIPTURE_SCRAMBLE
    const cleanVerse = targetAnswer.trim();
    if (!cleanVerse) {
      setErrorMsg('Please enter or select the full Bible verse text to scramble.');
      return;
    }
    const scrambledWords = scrambleVerse(cleanVerse);
    onSave({
      id: initialQuestion?.id || `mq_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      gameType,
      prompt: prompt.trim() || 'Reconstruct the scrambled scripture in exact order',
      options: [],
      correctAnswer: cleanVerse,
      clues: [],
      scrambledWords,
      scriptureReference: scriptureReference.trim() || 'Scripture',
      translation: translation.trim() || 'KJV',
      timerSeconds: Math.max(5, Number(timerSeconds) || defaultTimerSeconds),
      points: Math.max(10, Number(points) || defaultPoints),
      explanation: explanation.trim(),
    });
    onClose();
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tailored-q-editor-title"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 sm:p-6 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
      >
        <form
          onSubmit={handleSave}
          className="w-full max-w-lg max-h-[90dvh] overflow-y-auto overscroll-contain rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-5 space-y-4 shadow-2xl"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3
                id="tailored-q-editor-title"
                className="font-display text-base font-bold text-[#0F172A] dark:text-white"
              >
                {initialQuestion ? 'Edit' : 'Add'} {getGameTypeDisplayName(gameType)} Round
              </h3>
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                Tailored round builder for synchronized multiplayer
              </p>
            </div>
            <button
              type="button"
              aria-label="Close question editor"
              onClick={onClose}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#64748B] hover:text-[#0F172A] dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl bg-[#FFF1F2] dark:bg-[#9F1239]/25 border border-[#E11D48]/40 px-3 py-2 text-xs font-semibold text-[#9F1239] dark:text-[#FECDD3]"
            >
              {errorMsg}
            </div>
          )}

          {/* Scripture Reference + Bible DB quick fill */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="tq-scripture-ref"
                className="text-xs font-semibold text-[#334155] dark:text-[#CBD5E1]"
              >
                Scripture Reference
              </label>
              <button
                type="button"
                onClick={() => setShowBiblePicker(true)}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#E11D48] hover:underline"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Bible DB</span>
              </button>
            </div>
            <input
              id="tq-scripture-ref"
              type="text"
              value={scriptureReference}
              onChange={(e) => setScriptureReference(e.target.value)}
              placeholder="e.g. Judges 6:12"
              className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm text-[#0F172A] dark:text-white"
            />
          </div>

          {gameType === 'TRIVIA_CHALLENGE' && (
            <>
              <div>
                <label
                  htmlFor="tq-trivia-prompt"
                  className="block text-xs font-semibold mb-1 text-[#334155] dark:text-[#CBD5E1]"
                >
                  Question Prompt *
                </label>
                <textarea
                  id="tq-trivia-prompt"
                  rows={2}
                  required
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Enter Bible trivia question..."
                  className="w-full p-3 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm text-[#0F172A] dark:text-white"
                />
              </div>

              <div className="space-y-2">
                <span className="block text-xs font-semibold text-[#334155] dark:text-[#CBD5E1]">
                  Options (A–D) — tap radio to mark Correct Answer
                </span>
                {(['A', 'B', 'C', 'D'] as const).map((letter, idx) => (
                  <div key={letter} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="tq-correct-opt"
                      aria-label={`Mark option ${letter} correct`}
                      checked={correctIndex === idx}
                      onChange={() => setCorrectIndex(idx)}
                      className="w-4 h-4 accent-[#E11D48] shrink-0"
                    />
                    <span className="w-6 text-xs font-extrabold text-[#64748B]">{letter}.</span>
                    <input
                      type="text"
                      required
                      value={options[idx] || ''}
                      onChange={(e) =>
                        setOptions((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))
                      }
                      placeholder={`Option ${letter}`}
                      className="flex-1 min-h-[40px] px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm text-[#0F172A] dark:text-white"
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {gameType === 'WHO_AM_I' && (
            <>
              <div>
                <label
                  htmlFor="tq-whoami-target"
                  className="block text-xs font-semibold mb-1 text-[#334155] dark:text-[#CBD5E1]"
                >
                  Target Bible Character / Answer *
                </label>
                <input
                  id="tq-whoami-target"
                  type="text"
                  required
                  value={targetAnswer}
                  onChange={(e) => setTargetAnswer(e.target.value)}
                  placeholder="e.g. Gideon"
                  className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm text-[#0F172A] dark:text-white"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#334155] dark:text-[#CBD5E1]">
                    Progressive Clues (2–4, Hardest → Easiest)
                  </span>
                  {clues.length < 4 && (
                    <button
                      type="button"
                      onClick={() => setClues((prev) => [...prev, ''])}
                      className="inline-flex items-center gap-1 text-xs font-bold text-[#E11D48]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Clue</span>
                    </button>
                  )}
                </div>
                {clues.map((clue, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-[#64748B] w-14 shrink-0">
                      Clue {idx + 1}
                    </span>
                    <input
                      type="text"
                      required={idx < 2}
                      value={clue}
                      onChange={(e) =>
                        setClues((prev) => prev.map((c, i) => (i === idx ? e.target.value : c)))
                      }
                      placeholder={
                        idx === 0
                          ? 'Clue 1 (150% pts — hardest)...'
                          : idx === 1
                          ? 'Clue 2 (125% pts)...'
                          : `Clue ${idx + 1} (standard pts)...`
                      }
                      className="flex-1 min-h-[40px] px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm text-[#0F172A] dark:text-white"
                    />
                    {clues.length > 2 && (
                      <button
                        type="button"
                        aria-label={`Remove clue ${idx + 1}`}
                        onClick={() => setClues((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-2 text-[#64748B] hover:text-[#E11D48]"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {gameType === 'SCRIPTURE_SCRAMBLE' && (
            <>
              <div>
                <label
                  htmlFor="tq-scramble-verse"
                  className="block text-xs font-semibold mb-1 text-[#334155] dark:text-[#CBD5E1]"
                >
                  Exact Verse Text to Reconstruct *
                </label>
                <textarea
                  id="tq-scramble-verse"
                  rows={3}
                  required
                  value={targetAnswer}
                  onChange={(e) => setTargetAnswer(e.target.value)}
                  placeholder="Enter exact Bible verse text or click Bible DB above..."
                  className="w-full p-3 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm text-[#0F172A] dark:text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="tq-translation"
                  className="block text-xs font-semibold mb-1 text-[#334155] dark:text-[#CBD5E1]"
                >
                  Translation
                </label>
                <input
                  id="tq-translation"
                  type="text"
                  value={translation}
                  onChange={(e) => setTranslation(e.target.value)}
                  placeholder="KJV"
                  className="w-full min-h-[40px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm text-[#0F172A] dark:text-white"
                />
              </div>

              {scrambledPreview.length > 0 && (
                <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] p-3 space-y-1.5">
                  <span className="block text-[11px] font-bold text-[#64748B] dark:text-[#94A3B8]">
                    Live Scrambled Word Tiles ({scrambledPreview.length} tokens)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {scrambledPreview.map((tok, i) => (
                      <span
                        key={`${tok}-${i}`}
                        className="px-2 py-1 rounded-lg bg-white dark:bg-[#0F172A] border border-[#CBD5E1] dark:border-[#334155] text-xs font-semibold text-[#0F172A] dark:text-white"
                      >
                        {tok}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div>
            <label
              htmlFor="tq-explanation"
              className="block text-xs font-semibold mb-1 text-[#334155] dark:text-[#CBD5E1]"
            >
              Biblical Explanation
            </label>
            <textarea
              id="tq-explanation"
              rows={2}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Shown during leaderboard reveal..."
              className="w-full p-3 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm text-[#0F172A] dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="tq-timer-sec"
                className="block text-xs font-semibold mb-1 text-[#334155] dark:text-[#CBD5E1]"
              >
                Timer (seconds)
              </label>
              <input
                id="tq-timer-sec"
                type="number"
                min={5}
                max={300}
                value={timerSeconds}
                onChange={(e) => setTimerSeconds(Number(e.target.value))}
                className="w-full min-h-[40px] px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm text-[#0F172A] dark:text-white"
              />
            </div>
            <div>
              <label
                htmlFor="tq-points"
                className="block text-xs font-semibold mb-1 text-[#334155] dark:text-[#CBD5E1]"
              >
                Points
              </label>
              <input
                id="tq-points"
                type="number"
                min={10}
                max={1000}
                value={points}
                onChange={(e) => setPoints(Number(e.target.value))}
                className="w-full min-h-[40px] px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm text-[#0F172A] dark:text-white"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-w-[100px] min-h-[44px] rounded-xl bg-[#F1F5F9] dark:bg-[#1F2937] text-xs font-bold text-[#0F172A] dark:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 min-w-[130px] min-h-[44px] rounded-xl bg-[#E11D48] text-white text-sm font-bold"
            >
              Save Round
            </button>
          </div>
        </form>
      </div>

      <BiblePickerModal
        isOpen={showBiblePicker}
        onClose={() => setShowBiblePicker(false)}
        uploadedBibles={uploadedBibles}
        scriptureDocs={scriptureDocs}
        account={account}
        pickerMode={true}
        onPickVerse={(v) => {
          setScriptureReference(v.reference);
          if (v.translation) setTranslation(v.translation);
          if (gameType === 'SCRIPTURE_SCRAMBLE') {
            setTargetAnswer(v.text);
          } else if (gameType === 'TRIVIA_CHALLENGE' && !prompt.trim()) {
            setPrompt(`According to ${v.reference}, what does Scripture teach?`);
          }
          if (!explanation.trim()) {
            setExplanation(`${v.reference}: "${v.text}"`);
          }
        }}
      />
    </>
  );
};

interface QuestionPreviewModalProps {
  question: MultiplayerQuestion | null;
  index: number;
  onClose: () => void;
}

export const QuestionPreviewModal: React.FC<QuestionPreviewModalProps> = ({
  question,
  index,
  onClose,
}) => {
  if (!question) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="q-preview-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 sm:p-6"
    >
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-[#F59E0B]" />
            <h3 id="q-preview-title" className="text-sm font-bold text-[#0F172A] dark:text-white">
              Preview Round {index + 1} • {getGameTypeDisplayName(question.gameType)}
            </h3>
          </div>
          <button
            type="button"
            aria-label="Close round preview"
            onClick={onClose}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-[#64748B]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {question.scriptureReference && (
          <span className="inline-block px-2.5 py-1 rounded-full bg-[#FEF3C7] dark:bg-[#F59E0B]/20 text-[#92400E] dark:text-[#FCD34D] text-[11px] font-bold">
            {question.scriptureReference} {question.translation ? `• ${question.translation}` : ''}
          </span>
        )}

        <p className="text-sm font-bold text-[#0F172A] dark:text-white">{question.prompt}</p>

        {question.gameType === 'TRIVIA_CHALLENGE' && (
          <div className="space-y-1.5">
            {question.options.map((opt, i) => {
              const isCorrect =
                opt.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();
              return (
                <div
                  key={i}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border ${
                    isCorrect
                      ? 'bg-[#DCFCE7] dark:bg-[#10B981]/20 border-[#10B981] text-[#065F46] dark:text-[#6EE7B7]'
                      : 'bg-[#F8FAFC] dark:bg-[#1F2937] border-[#E2E8F0] dark:border-[#374151] text-[#334155] dark:text-[#CBD5E1]'
                  }`}
                >
                  {String.fromCharCode(65 + i)}. {opt} {isCorrect ? '✓' : ''}
                </div>
              );
            })}
          </div>
        )}

        {question.gameType === 'WHO_AM_I' && (
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-[#10B981]">
              Answer: {question.correctAnswer}
            </p>
            {question.clues.map((c, i) => (
              <div
                key={i}
                className="px-3 py-2 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-xs text-[#334155] dark:text-[#E2E8F0]"
              >
                <span className="font-bold text-[#F59E0B]">Clue {i + 1}:</span> {c}
              </div>
            ))}
          </div>
        )}

        {question.gameType === 'SCRIPTURE_SCRAMBLE' && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#10B981]">
              Exact Answer: “{question.correctAnswer}”
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(question.scrambledWords.length > 0
                ? question.scrambledWords
                : scrambleVerse(question.correctAnswer)
              ).map((w, i) => (
                <span
                  key={`${w}-${i}`}
                  className="px-2 py-1 rounded-lg bg-[#F1F5F9] dark:bg-[#1F2937] border border-[#CBD5E1] dark:border-[#374151] text-xs font-semibold"
                >
                  {w}
                </span>
              ))}
            </div>
          </div>
        )}

        {question.explanation && (
          <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B0F19] border border-[#E2E8F0] dark:border-[#374151] p-3 text-xs text-[#475569] dark:text-[#94A3B8]">
            <span className="font-bold text-[#0F172A] dark:text-white">Explanation: </span>
            {question.explanation}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="w-full min-h-[42px] rounded-xl bg-[#0F172A] dark:bg-[#E11D48] text-white text-xs font-bold"
        >
          Close Preview
        </button>
      </div>
    </div>
  );
};
