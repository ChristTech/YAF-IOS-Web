import React, { useEffect, useState } from 'react';
import { BookOpen, Plus, Trash2, X } from 'lucide-react';
import { BiblePickerModal } from '../BiblePickerModal';
import { createSoloGameQuiz } from '../../services/fellowshipService';
import { formatActionErrorMessage } from '../../utils/fellowshipLogic';
import type {
  DailyScriptureDoc,
  FellowshipAccount,
  GameQuiz,
  SoloQuizCategory,
  SoloQuizQuestion,
  UploadedBibleDoc,
} from '../../types/fellowship';

interface CreateSoloQuizModalProps {
  isOpen: boolean;
  account: FellowshipAccount;
  uploadedBibles: UploadedBibleDoc[];
  scriptureDocs: DailyScriptureDoc[];
  onClose: () => void;
  onCreated?: (quiz: GameQuiz) => void;
}

const EMPTY_SOLO_Q = (idx: number): SoloQuizQuestion => ({
  id: `sq_${Date.now()}_${idx}`,
  question: '',
  options: ['', '', '', ''],
  correctAnswerIndex: 0,
  scriptureRef: '',
});

export const CreateSoloQuizModal: React.FC<CreateSoloQuizModalProps> = ({
  isOpen,
  account,
  uploadedBibles,
  scriptureDocs,
  onClose,
  onCreated,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<SoloQuizCategory>('BIBLE_TRIVIA');
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Medium');
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(90);
  const [questions, setQuestions] = useState<SoloQuizQuestion[]>([EMPTY_SOLO_Q(1)]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pickerTargetIdx, setPickerTargetIdx] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDescription('');
      setCategory('BIBLE_TRIVIA');
      setDifficulty('Medium');
      setTimeLimitSeconds(90);
      setQuestions([EMPTY_SOLO_Q(1)]);
      setErrorMsg(null);
      setPickerTargetIdx(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!title.trim()) {
      setErrorMsg('Quiz title is required.');
      return;
    }
    const validQuestions = questions
      .map((q) => ({
        ...q,
        question: q.question.trim(),
        options: q.options.map((o) => o.trim()),
        scriptureRef: q.scriptureRef.trim(),
      }))
      .filter((q) => q.question && q.options.every(Boolean));

    if (validQuestions.length === 0) {
      setErrorMsg('Please complete at least 1 question with 4 non-empty options.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await createSoloGameQuiz({
        author: account,
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        difficulty,
        timeLimitSeconds: Math.max(10, Math.min(7200, Number(timeLimitSeconds) || 90)),
        questions: validQuestions,
      });
      onCreated?.(created);
      onClose();
    } catch (err) {
      setErrorMsg(formatActionErrorMessage(err, 'Unable to publish solo scripture quiz.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-solo-quiz-title"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 sm:p-6 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
      >
        <form
          onSubmit={handlePublish}
          className="w-full max-w-xl max-h-[90dvh] overflow-y-auto overscroll-contain rounded-2xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] p-5 space-y-4 shadow-2xl"
        >
          <div className="flex items-center justify-between gap-2">
            <h3
              id="create-solo-quiz-title"
              className="font-display text-base font-bold text-[#0F172A] dark:text-white"
            >
              Create Solo Scripture Quiz
            </h3>
            <button
              type="button"
              aria-label="Close solo quiz creator"
              onClick={onClose}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#64748B]"
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

          <div>
            <label
              htmlFor="solo-quiz-title-input"
              className="block text-xs font-semibold mb-1 text-[#334155] dark:text-[#CBD5E1]"
            >
              Quiz Title *
            </label>
            <input
              id="solo-quiz-title-input"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Heroes of Faith Challenge"
              className="w-full min-h-[42px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm text-[#0F172A] dark:text-white"
            />
          </div>

          <div>
            <label
              htmlFor="solo-quiz-desc-input"
              className="block text-xs font-semibold mb-1 text-[#334155] dark:text-[#CBD5E1]"
            >
              Short Description (optional)
            </label>
            <input
              id="solo-quiz-desc-input"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Focused scripture challenge for Gideonites youth"
              className="w-full min-h-[40px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm text-[#0F172A] dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="solo-quiz-category"
                className="block text-xs font-semibold mb-1 text-[#334155] dark:text-[#CBD5E1]"
              >
                Category
              </label>
              <select
                id="solo-quiz-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as SoloQuizCategory)}
                className="w-full min-h-[40px] px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-xs font-semibold text-[#0F172A] dark:text-white"
              >
                <option value="BIBLE_TRIVIA">BIBLE_TRIVIA</option>
                <option value="SCRIPTURE_MEMORY">SCRIPTURE_MEMORY</option>
                <option value="CHURCH_DOCTRINE">CHURCH_DOCTRINE</option>
                <option value="YOUTH_HISTORY">YOUTH_HISTORY</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="solo-quiz-difficulty"
                className="block text-xs font-semibold mb-1 text-[#334155] dark:text-[#CBD5E1]"
              >
                Difficulty
              </label>
              <select
                id="solo-quiz-difficulty"
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as 'Easy' | 'Medium' | 'Hard')}
                className="w-full min-h-[40px] px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-xs font-semibold text-[#0F172A] dark:text-white"
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="solo-quiz-timelimit"
                className="block text-xs font-semibold mb-1 text-[#334155] dark:text-[#CBD5E1]"
              >
                Time Limit (sec)
              </label>
              <input
                id="solo-quiz-timelimit"
                type="number"
                min={10}
                max={7200}
                value={timeLimitSeconds}
                onChange={(e) => setTimeLimitSeconds(Number(e.target.value))}
                className="w-full min-h-[40px] px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#1F2937] border border-[#E2E8F0] dark:border-[#374151] text-sm text-[#0F172A] dark:text-white"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8]">
              Questions ({questions.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPickerTargetIdx(-1)}
                className="min-h-[36px] px-3 rounded-xl bg-[#FEF3C7] dark:bg-[#F59E0B]/20 text-[#92400E] dark:text-[#FCD34D] text-xs font-bold inline-flex items-center gap-1"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>From Bible</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  setQuestions((prev) => [...prev, EMPTY_SOLO_Q(prev.length + 1)])
                }
                className="min-h-[36px] px-3 rounded-xl bg-[#E11D48] text-white text-xs font-bold inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Question</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {questions.map((q, qIdx) => (
              <div
                key={q.id}
                className="rounded-xl border border-[#E2E8F0] dark:border-[#374151] bg-[#F8FAFC] dark:bg-[#1F2937] p-3.5 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-[#E11D48]">
                    Question {qIdx + 1}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPickerTargetIdx(qIdx)}
                      className="text-xs font-bold text-[#F59E0B] hover:underline inline-flex items-center gap-1"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Bible DB</span>
                    </button>
                    {questions.length > 1 && (
                      <button
                        type="button"
                        aria-label={`Remove question ${qIdx + 1}`}
                        onClick={() =>
                          setQuestions((prev) => prev.filter((_, idx) => idx !== qIdx))
                        }
                        className="p-1.5 text-[#64748B] hover:text-[#E11D48]"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <input
                  type="text"
                  required
                  value={q.question}
                  onChange={(e) =>
                    setQuestions((prev) =>
                      prev.map((item, idx) =>
                        idx === qIdx ? { ...item, question: e.target.value } : item
                      )
                    )
                  }
                  placeholder="Enter question text..."
                  className="w-full min-h-[40px] px-3 rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] text-sm"
                />

                <input
                  type="text"
                  value={q.scriptureRef}
                  onChange={(e) =>
                    setQuestions((prev) =>
                      prev.map((item, idx) =>
                        idx === qIdx ? { ...item, scriptureRef: e.target.value } : item
                      )
                    )
                  }
                  placeholder="Scripture Reference (e.g. Hebrews 11:1)"
                  className="w-full min-h-[38px] px-3 rounded-xl bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] text-xs"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(['A', 'B', 'C', 'D'] as const).map((letter, optIdx) => (
                    <div key={letter} className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        name={`solo-correct-${q.id}`}
                        aria-label={`Question ${qIdx + 1} option ${letter} correct`}
                        checked={q.correctAnswerIndex === optIdx}
                        onChange={() =>
                          setQuestions((prev) =>
                            prev.map((item, idx) =>
                              idx === qIdx ? { ...item, correctAnswerIndex: optIdx } : item
                            )
                          )
                        }
                        className="w-4 h-4 accent-[#E11D48] shrink-0"
                      />
                      <input
                        type="text"
                        required
                        value={q.options[optIdx] || ''}
                        onChange={(e) =>
                          setQuestions((prev) =>
                            prev.map((item, idx) =>
                              idx === qIdx
                                ? {
                                    ...item,
                                    options: item.options.map((o, oi) =>
                                      oi === optIdx ? e.target.value : o
                                    ),
                                  }
                                : item
                            )
                          )
                        }
                        placeholder={`Option ${letter}`}
                        className="flex-1 min-h-[38px] px-2.5 rounded-lg bg-white dark:bg-[#111827] border border-[#E2E8F0] dark:border-[#374151] text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-w-[110px] min-h-[44px] rounded-xl bg-[#F1F5F9] dark:bg-[#1F2937] text-xs font-bold text-[#0F172A] dark:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 min-w-[140px] min-h-[44px] rounded-xl bg-[#0F172A] dark:bg-[#E11D48] text-white text-sm font-bold disabled:opacity-60"
            >
              {submitting ? 'Publishing...' : 'Publish Quiz'}
            </button>
          </div>
        </form>
      </div>

      <BiblePickerModal
        isOpen={pickerTargetIdx !== null}
        onClose={() => setPickerTargetIdx(null)}
        uploadedBibles={uploadedBibles}
        scriptureDocs={scriptureDocs}
        account={account}
        pickerMode={true}
        onPickVerse={(v) => {
          if (pickerTargetIdx === null) return;
          if (pickerTargetIdx === -1) {
            const newQ: SoloQuizQuestion = {
              id: `sq_${Date.now()}_${questions.length + 1}`,
              question: `Which Bible verse says: "${v.text.slice(0, 120)}${v.text.length > 120 ? '...' : ''}"?`,
              options: [v.reference, 'Psalm 23:1', 'Romans 8:28', 'John 14:6'].map((opt, i) =>
                i > 0 && opt.toLowerCase() === v.reference.toLowerCase()
                  ? 'Genesis 1:1'
                  : opt
              ),
              correctAnswerIndex: 0,
              scriptureRef: v.reference,
            };
            setQuestions((prev) => [...prev, newQ]);
          } else {
            setQuestions((prev) =>
              prev.map((item, idx) =>
                idx === pickerTargetIdx
                  ? {
                      ...item,
                      scriptureRef: v.reference,
                      question:
                        item.question.trim() ||
                        `According to ${v.reference}, complete the key teaching:`,
                    }
                  : item
              )
            );
          }
        }}
      />
    </>
  );
};
