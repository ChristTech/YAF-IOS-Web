import type {
  DailyScriptureDoc,
  FellowshipAccount,
  GameQuiz,
  GameScore,
  GameType,
  LanguageCode,
  MultiplayerParticipant,
  MultiplayerQuestion,
  QuizSession,
  SessionStatus,
  SessionSubstate,
  SoloQuizQuestion,
  UploadedBibleSection,
} from '../types/fellowship';

export const NON_HOST_GRACE_MS = 1500;
export const DEFAULT_LEADERBOARD_DURATION_SEC = 8;
export const FALLBACK_LEADERBOARD_DURATION_SEC = 6;
export const MAX_FIRESTORE_JSON_STRING_LEN = 98_000;

export type NormalizedGamesRole =
  | 'ADMINISTRATOR'
  | 'YOUTH_EXECUTIVE'
  | 'YOUTH_MEMBER'
  | 'GUEST';

export function normalizeGamesRole(role?: string | null): NormalizedGamesRole {
  const upper = (role || '').trim().toUpperCase();
  if (upper === 'ADMINISTRATOR' || upper === 'ADMIN') return 'ADMINISTRATOR';
  if (upper === 'YOUTH_EXECUTIVE' || upper === 'EXECUTIVE' || upper === 'EXCO') {
    return 'YOUTH_EXECUTIVE';
  }
  if (upper === 'GUEST') return 'GUEST';
  return 'YOUTH_MEMBER';
}

export function isGamesAdmin(role?: string | null): boolean {
  return normalizeGamesRole(role) === 'ADMINISTRATOR';
}

export function isGamesExecutive(role?: string | null): boolean {
  return normalizeGamesRole(role) === 'YOUTH_EXECUTIVE';
}

export function isGamesLeadership(role?: string | null): boolean {
  const norm = normalizeGamesRole(role);
  return norm === 'ADMINISTRATOR' || norm === 'YOUTH_EXECUTIVE';
}

export function isGamesGuest(role?: string | null): boolean {
  return normalizeGamesRole(role) === 'GUEST';
}

export interface GamesHeaderBannerMeta {
  title: string;
  subtitle: string;
  accentHex: string;
}

export function getGamesHeaderBannerMeta(role?: string | null): GamesHeaderBannerMeta {
  switch (normalizeGamesRole(role)) {
    case 'ADMINISTRATOR':
      return {
        title: 'The Gideonites - The Youth Alive Fellowship • Game Command',
        subtitle: 'Live Multiplayer Showdown',
        accentHex: '#E11D48',
      };
    case 'YOUTH_EXECUTIVE':
      return {
        title: 'The Gideonites - The Youth Alive Fellowship • Scripture Games',
        subtitle: 'Live Arena Showdowns',
        accentHex: '#F59E0B',
      };
    case 'GUEST':
      return {
        title: 'Welcome to The Gideonites - Youth Alive Games',
        subtitle: 'Live Arena Standby',
        accentHex: '#3B82F6',
      };
    default:
      return {
        title: 'The Gideonites - The Youth Alive Fellowship • Kingdom Giants',
        subtitle: 'Live Arena Showdowns',
        accentHex: '#10B981',
      };
  }
}

export function getGameTypeDisplayName(gameType: GameType | string | undefined): string {
  switch (gameType) {
    case 'WHO_AM_I':
      return 'Who Am I?';
    case 'SCRIPTURE_SCRAMBLE':
      return 'Scripture Scramble';
    default:
      return 'Trivia Challenge';
  }
}

export function getGameTypeDefaultTimer(gameType: GameType): number {
  return gameType === 'TRIVIA_CHALLENGE' ? 20 : 30;
}

export function getLanguageShortBadge(lang: LanguageCode | string | undefined): LanguageCode {
  const upper = (lang || 'EN').toUpperCase();
  if (upper === 'YO' || upper === 'HA' || upper === 'IG') return upper;
  return 'EN';
}

export function normalizeSessionStatus(status?: string | null): SessionStatus {
  const upper = (status || '').trim().toUpperCase();
  switch (upper) {
    case 'DRAFT':
      return 'DRAFT';
    case 'SCHEDULED':
    case 'LOBBY':
      return 'SCHEDULED';
    case 'ACTIVE':
    case 'LIVE':
      return 'ACTIVE';
    case 'COMPLETED':
    case 'ENDED':
      return 'COMPLETED';
    case 'CANCELLED':
      return 'CANCELLED';
    default:
      return 'COMPLETED';
  }
}

export function getSessionTitle(
  session: Pick<QuizSession, 'titleEn' | 'titleYo' | 'titleHa' | 'titleIg' | 'title'>,
  language: LanguageCode = 'EN'
): string {
  if (language === 'YO' && session.titleYo?.trim()) return session.titleYo.trim();
  if (language === 'HA' && session.titleHa?.trim()) return session.titleHa.trim();
  if (language === 'IG' && session.titleIg?.trim()) return session.titleIg.trim();
  return (session.titleEn || session.title || 'Bible Showdown').trim();
}

export function parseMultiplayerQuestions(rawJson?: string | null): MultiplayerQuestion[] {
  if (!rawJson || typeof rawJson !== 'string') return [];
  try {
    const parsed = JSON.parse(rawJson) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item, idx) => {
      const obj = (item || {}) as Record<string, unknown>;
      const rawType = String(obj.gameType || 'TRIVIA_CHALLENGE').toUpperCase();
      const gameType: GameType =
        rawType === 'WHO_AM_I' || rawType === 'SCRIPTURE_SCRAMBLE'
          ? rawType
          : 'TRIVIA_CHALLENGE';

      const options = Array.isArray(obj.options)
        ? obj.options.map((o) => String(o ?? ''))
        : [];
      const clues = Array.isArray(obj.clues) ? obj.clues.map((c) => String(c ?? '')) : [];
      const rawPrompt = String(obj.prompt || obj.question || '').trim();
      let correctAnswer = String(obj.correctAnswer || '').trim();
      const rawIdxCandidate =
        obj.correctAnswerIndex ??
        obj.correctIndex ??
        obj.answerIndex ??
        obj.correctOptionIndex;
      const parsedIdx =
        typeof rawIdxCandidate === 'number'
          ? rawIdxCandidate
          : typeof rawIdxCandidate === 'string' && /^\d+$/.test(rawIdxCandidate.trim())
          ? Number(rawIdxCandidate.trim())
          : null;
      if (!correctAnswer && parsedIdx !== null && options[parsedIdx]) {
        correctAnswer = options[parsedIdx];
      }

      const scrambledWordsRaw = Array.isArray(obj.scrambledWords)
        ? obj.scrambledWords.map((w) => String(w ?? '')).filter(Boolean)
        : [];
      const scrambledWords =
        gameType === 'SCRIPTURE_SCRAMBLE' && scrambledWordsRaw.length === 0 && correctAnswer
          ? scrambleVerse(correctAnswer)
          : scrambledWordsRaw;

      return {
        id: String(obj.id || `q-${idx + 1}`),
        gameType,
        prompt: rawPrompt,
        options,
        correctAnswer,
        clues,
        scrambledWords,
        scriptureReference: String(obj.scriptureReference || obj.scriptureRef || '').trim(),
        translation: String(obj.translation || 'KJV').trim(),
        timerSeconds: Number(obj.timerSeconds) > 0 ? Number(obj.timerSeconds) : 0,
        points: Number(obj.points) > 0 ? Number(obj.points) : 0,
        explanation: String(obj.explanation || '').trim(),
      };
    });
  } catch {
    return [];
  }
}

export function resolveSoloCorrectIndex(
  obj: Record<string, unknown>,
  options: string[]
): number {
  const maxIdx = Math.max(0, options.length - 1);
  const rawIdx =
    obj.correctAnswerIndex ??
    obj.correctIndex ??
    obj.answerIndex ??
    obj.correctOptionIndex;

  if (typeof rawIdx === 'number' && Number.isFinite(rawIdx)) {
    return clampNumber(Math.floor(rawIdx), 0, maxIdx);
  }
  if (typeof rawIdx === 'string' && /^\d+$/.test(rawIdx.trim())) {
    return clampNumber(Number(rawIdx.trim()), 0, maxIdx);
  }

  const rawAnswerText = String(obj.correctAnswer ?? obj.answer ?? '').trim();
  if (rawAnswerText) {
    const normalizedTarget = rawAnswerText.toLowerCase();
    const matchedIdx = options.findIndex(
      (opt) => opt.trim().toLowerCase() === normalizedTarget
    );
    if (matchedIdx >= 0) return matchedIdx;

    if (/^[abcd]$/i.test(rawAnswerText)) {
      const letterIdx = rawAnswerText.toUpperCase().charCodeAt(0) - 65;
      if (letterIdx >= 0 && letterIdx <= maxIdx) return letterIdx;
    }
  }

  return 0;
}

export function parseSoloQuizQuestions(rawJson?: string | null): SoloQuizQuestion[] {
  if (!rawJson || typeof rawJson !== 'string') return [];
  try {
    const parsed = JSON.parse(rawJson) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item, idx) => {
        const obj = (item || {}) as Record<string, unknown>;
        const rawOptions = Array.isArray(obj.options)
          ? obj.options.map((o) => String(o ?? '').trim()).filter((o) => o.length > 0)
          : [];
        const options =
          rawOptions.length >= 2
            ? rawOptions
            : ['Option A', 'Option B', 'Option C', 'Option D'];
        const correctIdx = resolveSoloCorrectIndex(obj, options);
        return {
          id: String(obj.id || `sq-${idx + 1}`),
          question: String(obj.question || obj.prompt || '').trim(),
          options,
          correctAnswerIndex: clampNumber(correctIdx, 0, Math.max(0, options.length - 1)),
          scriptureRef: String(obj.scriptureRef || obj.scriptureReference || '').trim(),
        };
      })
      .filter((q) => q.question.length > 0);
  } catch {
    return [];
  }
}

export function parseMultiplayerParticipants(
  rawJson?: string | null
): MultiplayerParticipant[] {
  if (!rawJson || typeof rawJson !== 'string') return [];
  try {
    const parsed = JSON.parse(rawJson) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item, idx) => {
        const obj = (item || {}) as Record<string, unknown>;
        const userId = String(obj.userId || obj.id || `u-${idx}`).trim();
        return {
          id: String(obj.id || userId),
          userId,
          userName: String(obj.userName || obj.fullName || 'Kingdom Giant').trim(),
          userRole: String(obj.userRole || 'YOUTH_MEMBER'),
          joinedAt: Number(obj.joinedAt) || 0,
          joinedAtQuestionIndex: Math.max(0, Number(obj.joinedAtQuestionIndex) || 0),
          currentScore: Math.max(
            0,
            Number(obj.currentScore ?? obj.score ?? 0) || 0
          ),
          lastQuestionPoints: Number(obj.lastQuestionPoints) || 0,
          lastAnswerTimestamp: Math.max(
            0,
            Number(obj.lastAnswerTimestamp ?? obj.lastUpdated ?? 0) || 0
          ),
          answeredQuestionsCount: Math.max(
            0,
            Number(obj.answeredQuestionsCount ?? obj.answeredCount ?? 0) || 0
          ),
          isOnline: obj.isOnline !== false,
          ...(typeof obj.lastSubmittedQuestionIndex === 'number'
            ? { lastSubmittedQuestionIndex: obj.lastSubmittedQuestionIndex }
            : {}),
          ...(typeof obj.lastSubmittedCorrect === 'boolean'
            ? { lastSubmittedCorrect: obj.lastSubmittedCorrect }
            : {}),
          ...(typeof obj.lastSubmittedLate === 'boolean'
            ? { lastSubmittedLate: obj.lastSubmittedLate }
            : {}),
        };
      })
      .filter((p) => p.userId && !p.userId.startsWith('peer-') && !p.id.startsWith('peer-'));
  } catch {
    return [];
  }
}

export function mergeParticipantsJson(
  existingJson: string | undefined | null,
  incomingList: MultiplayerParticipant[]
): {
  mergedList: MultiplayerParticipant[];
  participantsJson: string;
  participantCount: number;
} {
  const existing = parseMultiplayerParticipants(existingJson);
  const byUserId = new Map<string, MultiplayerParticipant>();

  for (const p of existing) {
    if (p.userId.startsWith('peer-') || p.id.startsWith('peer-')) continue;
    byUserId.set(p.userId, p);
  }

  for (const p of incomingList) {
    if (!p.userId || p.userId.startsWith('peer-') || p.id.startsWith('peer-')) continue;
    const prev = byUserId.get(p.userId);
    if (!prev) {
      byUserId.set(p.userId, p);
    } else {
      const nextScore = Math.max(prev.currentScore, p.currentScore);
      const nextAnswered = Math.max(
        prev.answeredQuestionsCount,
        p.answeredQuestionsCount
      );
      const useIncomingMeta =
        p.lastAnswerTimestamp >= prev.lastAnswerTimestamp ||
        p.answeredQuestionsCount > prev.answeredQuestionsCount;
      byUserId.set(p.userId, {
        ...prev,
        ...p,
        joinedAt:
          prev.joinedAt > 0
            ? Math.min(prev.joinedAt, p.joinedAt || prev.joinedAt)
            : p.joinedAt,
        joinedAtQuestionIndex: prev.joinedAtQuestionIndex,
        currentScore: nextScore,
        answeredQuestionsCount: nextAnswered,
        lastQuestionPoints: useIncomingMeta
          ? p.lastQuestionPoints
          : prev.lastQuestionPoints,
        lastAnswerTimestamp: Math.max(prev.lastAnswerTimestamp, p.lastAnswerTimestamp),
        isOnline: p.isOnline ?? prev.isOnline ?? true,
      });
    }
  }

  const mergedList = Array.from(byUserId.values());
  let participantsJson = serializeCompactParticipants(mergedList);
  if (participantsJson.length > MAX_FIRESTORE_JSON_STRING_LEN) {
    const trimmed = sortMultiplayerParticipants(mergedList).slice(0, 180);
    participantsJson = serializeCompactParticipants(trimmed);
  }

  return {
    mergedList,
    participantsJson,
    participantCount: mergedList.length,
  };
}

function serializeCompactParticipants(list: MultiplayerParticipant[]): string {
  const full = JSON.stringify(list);
  if (full.length <= MAX_FIRESTORE_JSON_STRING_LEN) return full;
  const compact = list.map((p) => ({
    id: p.id,
    userId: p.userId,
    userName: p.userName.slice(0, 48),
    userRole: p.userRole,
    joinedAt: p.joinedAt,
    joinedAtQuestionIndex: p.joinedAtQuestionIndex,
    currentScore: p.currentScore,
    lastQuestionPoints: p.lastQuestionPoints,
    lastAnswerTimestamp: p.lastAnswerTimestamp,
    answeredQuestionsCount: p.answeredQuestionsCount,
  }));
  return JSON.stringify(compact);
}

export function serializeMultiplayerQuestions(questions: MultiplayerQuestion[]): string {
  const full = JSON.stringify(questions);
  if (full.length <= MAX_FIRESTORE_JSON_STRING_LEN) return full;
  let trimmed = questions.map((q) => ({
    ...q,
    explanation: q.explanation.slice(0, 220),
  }));
  while (trimmed.length > 1 && JSON.stringify(trimmed).length > MAX_FIRESTORE_JSON_STRING_LEN) {
    trimmed = trimmed.slice(0, trimmed.length - 1);
  }
  return JSON.stringify(trimmed);
}

export function clampNumber(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

export function kingdomRankTitle(bestScore: number): string {
  if (bestScore >= 300 || (bestScore >= 8 && bestScore <= 50)) {
    return 'Kingdom Giant 👑';
  }
  if (bestScore >= 180 || (bestScore >= 5 && bestScore <= 7)) {
    return 'Bible Scholar 📜';
  }
  if (bestScore >= 80 || (bestScore >= 2 && bestScore <= 4)) {
    return 'Faith Seeker 🌱';
  }
  return 'Bible Explorer 🧭';
}

export function scrambleVerse(
  verse: string,
  randomFn: () => number = Math.random
): string[] {
  const tokens = (verse || '')
    .replace(/[,.;:!?"'()—[\]]/g, '')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (tokens.length <= 1) return tokens;

  const shuffled = [...tokens];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(clampNumber(randomFn(), 0, 0.999999) * (i + 1));
    const tmp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = tmp;
  }

  const unchanged = shuffled.every((w, i) => w === tokens[i]);
  if (unchanged) {
    return [...tokens].reverse();
  }
  return shuffled;
}

export function normalizeWords(input: string): string {
  return (input || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ClueProgressResult {
  currentClueIndex: number;
  clueMultiplier: number;
  clueBannerLabel: string;
}

export function getClueMultiplier(clueIndex: number): number {
  if (clueIndex === 0) return 1.5;
  if (clueIndex === 1) return 1.25;
  return 1.0;
}

export function getClueBannerLabel(clueIndex: number): string {
  if (clueIndex === 0) return '🌟 150% Clue 1 Max Points!';
  if (clueIndex === 1) return '⚡ 125% Clue 2 Points';
  return 'Standard Points';
}

export function getClueProgress(
  qTimeLimitSeconds: number,
  currentQuestionDeadlineMs: number,
  nowMs: number,
  numClues: number
): ClueProgressResult {
  const safeClues = Math.max(1, numClues);
  const totalWindowMs = Math.max(1000, qTimeLimitSeconds * 1000);
  const questionStartMs = currentQuestionDeadlineMs - totalWindowMs;
  const timeElapsedMs = Math.max(0, nowMs - questionStartMs);
  const clueIntervalMs = Math.max(Math.floor(totalWindowMs / safeClues), 1000);
  const currentClueIndex = clampNumber(
    Math.floor(timeElapsedMs / clueIntervalMs),
    0,
    safeClues - 1
  );
  return {
    currentClueIndex,
    clueMultiplier: getClueMultiplier(currentClueIndex),
    clueBannerLabel: getClueBannerLabel(currentClueIndex),
  };
}

export function isMultiplayerAnswerCorrect(
  question: MultiplayerQuestion,
  submittedAnswer: string
): boolean {
  if (question.gameType === 'SCRIPTURE_SCRAMBLE') {
    return normalizeWords(submittedAnswer) === normalizeWords(question.correctAnswer);
  }
  const cleanSubmitted = submittedAnswer.trim().replace(/\s+/g, ' ').toLowerCase();
  const cleanExpected = question.correctAnswer.trim().replace(/\s+/g, ' ').toLowerCase();
  return cleanSubmitted === cleanExpected;
}

export function computeMultiplayerPoints(params: {
  question: MultiplayerQuestion;
  session: Pick<
    QuizSession,
    | 'baseScorePerQuestion'
    | 'speedBonusEnabled'
    | 'maxSpeedBonus'
    | 'penaltyForIncorrect'
    | 'timeLimitPerQuestionSeconds'
  >;
  isCorrect: boolean;
  submissionTimeMs: number;
  currentQuestionDeadlineMs: number;
}): {
  pointsAwarded: number;
  speedBonus: number;
  adjustedBase: number;
  clueMultiplier: number;
} {
  const { question, session, isCorrect, submissionTimeMs, currentQuestionDeadlineMs } =
    params;
  const timeLimitSec =
    question.timerSeconds > 0
      ? question.timerSeconds
      : session.timeLimitPerQuestionSeconds || 20;
  const base =
    question.points > 0 ? question.points : session.baseScorePerQuestion || 100;

  let clueMultiplier = 1.0;
  if (question.gameType === 'WHO_AM_I') {
    const numClues = Math.max(1, question.clues.length || 2);
    clueMultiplier = getClueProgress(
      timeLimitSec,
      currentQuestionDeadlineMs,
      submissionTimeMs,
      numClues
    ).clueMultiplier;
  }

  const adjustedBase = Math.floor(base * clueMultiplier);
  const maxSpeed = session.maxSpeedBonus ?? 50;
  const speedRatio =
    timeLimitSec > 0
      ? clampNumber(
          (currentQuestionDeadlineMs - submissionTimeMs) / (timeLimitSec * 1000),
          0,
          1
        )
      : 0;
  const speedBonus =
    session.speedBonusEnabled && timeLimitSec > 0 && isCorrect
      ? Math.floor(speedRatio * maxSpeed)
      : 0;

  const pointsAwarded = isCorrect
    ? adjustedBase + speedBonus
    : session.penaltyForIncorrect
    ? -20
    : 0;

  return { pointsAwarded, speedBonus, adjustedBase, clueMultiplier };
}

export type AnswerSubmissionStatus =
  | 'Scored'
  | 'MissedQuestion'
  | 'DuplicateRejected'
  | 'DeadlineExpired';

export interface AnswerSubmissionResult {
  status: AnswerSubmissionStatus;
  isCorrect: boolean;
  pointsAwarded: number;
  speedBonus: number;
  newTotalScore: number;
}

export function evaluateMultiplayerAnswerSubmission(params: {
  session: QuizSession;
  question: MultiplayerQuestion;
  questionIndex: number;
  participant: MultiplayerParticipant;
  submittedAnswer: string;
  submissionTimeMs: number;
  alreadyAnsweredLedger: Set<string>;
}): AnswerSubmissionResult {
  const {
    session,
    question,
    questionIndex,
    participant,
    submittedAnswer,
    submissionTimeMs,
    alreadyAnsweredLedger,
  } = params;

  if (questionIndex < participant.joinedAtQuestionIndex) {
    return {
      status: 'MissedQuestion',
      isCorrect: false,
      pointsAwarded: 0,
      speedBonus: 0,
      newTotalScore: participant.currentScore,
    };
  }

  const ledgerKey = `${session.id}::${questionIndex}::${participant.userId}`;
  if (alreadyAnsweredLedger.has(ledgerKey)) {
    return {
      status: 'DuplicateRejected',
      isCorrect: false,
      pointsAwarded: 0,
      speedBonus: 0,
      newTotalScore: participant.currentScore,
    };
  }

  const deadlineMs = session.currentQuestionDeadline || 0;
  if (deadlineMs > 0 && submissionTimeMs > deadlineMs) {
    return {
      status: 'DeadlineExpired',
      isCorrect: false,
      pointsAwarded: 0,
      speedBonus: 0,
      newTotalScore: participant.currentScore,
    };
  }

  const isCorrect = isMultiplayerAnswerCorrect(question, submittedAnswer);
  const { pointsAwarded, speedBonus } = computeMultiplayerPoints({
    question,
    session,
    isCorrect,
    submissionTimeMs,
    currentQuestionDeadlineMs: deadlineMs || submissionTimeMs,
  });

  const newTotalScore = Math.max(0, participant.currentScore + pointsAwarded);
  return {
    status: 'Scored',
    isCorrect,
    pointsAwarded,
    speedBonus,
    newTotalScore,
  };
}

export function sortMultiplayerParticipants(
  participants: MultiplayerParticipant[]
): MultiplayerParticipant[] {
  return [...participants].sort((a, b) => {
    if (b.currentScore !== a.currentScore) {
      return b.currentScore - a.currentScore;
    }
    const aTs =
      a.lastAnswerTimestamp > 0 ? a.lastAnswerTimestamp : Number.MAX_SAFE_INTEGER;
    const bTs =
      b.lastAnswerTimestamp > 0 ? b.lastAnswerTimestamp : Number.MAX_SAFE_INTEGER;
    if (aTs !== bTs) {
      return aTs - bTs;
    }
    return a.userName.localeCompare(b.userName);
  });
}

export interface RankedMultiplayerParticipant extends MultiplayerParticipant {
  rank: number;
  rankMovement: number;
}

export function computeRankMovements(
  sortedParticipants: MultiplayerParticipant[],
  previousRankMap: Map<string, number>
): RankedMultiplayerParticipant[] {
  return sortedParticipants.map((p, idx) => {
    const newRank = idx + 1;
    const prevRank = previousRankMap.get(p.userId);
    const rankMovement = prevRank !== undefined ? prevRank - newRank : 0;
    return {
      ...p,
      rank: newRank,
      rankMovement,
    };
  });
}

export function getEffectiveQuestionTimeLimit(
  session: Pick<QuizSession, 'timeLimitPerQuestionSeconds'>,
  question?: MultiplayerQuestion | null
): number {
  const qTimer = question?.timerSeconds || 0;
  if (qTimer > 0) return qTimer;
  return session.timeLimitPerQuestionSeconds > 0
    ? session.timeLimitPerQuestionSeconds
    : 20;
}

export function clampRemainingSeconds(
  deadlineMs: number | undefined,
  nowMs: number,
  maxSeconds: number
): number {
  if (!deadlineMs || deadlineMs <= 0) return 0;
  const remMs = Math.max(0, deadlineMs - nowMs);
  const sec = Math.ceil(remMs / 1000);
  return clampNumber(sec, 0, Math.max(0, maxSeconds));
}

export interface SessionStateTransition {
  changed: boolean;
  nextStatus: SessionStatus;
  nextSubstate: SessionSubstate;
  nextQuestionIndex: number;
  nextQuestionDeadline: number;
  nextLeaderboardDeadline: number;
}

export function computeNextSessionState(params: {
  session: QuizSession;
  questions: MultiplayerQuestion[];
  nowMs: number;
  isHostDevice: boolean;
}): SessionStateTransition {
  const { session, questions, nowMs, isHostDevice } = params;
  const status = normalizeSessionStatus(session.status);
  const substate: SessionSubstate = session.currentSubstate || 'WAITING_TO_START';
  const graceMs = isHostDevice ? 0 : NON_HOST_GRACE_MS;

  const noChange: SessionStateTransition = {
    changed: false,
    nextStatus: status,
    nextSubstate: substate,
    nextQuestionIndex: session.currentQuestionIndex || 0,
    nextQuestionDeadline: session.currentQuestionDeadline || 0,
    nextLeaderboardDeadline: session.leaderboardDeadline || 0,
  };

  if (status === 'DRAFT' || status === 'COMPLETED' || status === 'CANCELLED') {
    return noChange;
  }

  if (status === 'SCHEDULED') {
    const startAt = session.scheduledStartTime || 0;
    if (startAt > 0 && nowMs >= startAt + graceMs && questions.length > 0) {
      const firstLimit = getEffectiveQuestionTimeLimit(session, questions[0]);
      return {
        changed: true,
        nextStatus: 'ACTIVE',
        nextSubstate: 'QUESTION_OPEN',
        nextQuestionIndex: 0,
        nextQuestionDeadline: nowMs + firstLimit * 1000,
        nextLeaderboardDeadline: 0,
      };
    }
    return noChange;
  }

  // status === 'ACTIVE'
  const totalQ = Math.max(session.totalQuestions || 0, questions.length);
  const qIdx = clampNumber(session.currentQuestionIndex || 0, 0, Math.max(0, totalQ - 1));

  if (substate === 'QUESTION_OPEN') {
    const qDeadline = session.currentQuestionDeadline || 0;
    if (qDeadline > 0 && nowMs >= qDeadline + graceMs) {
      const lbSec =
        session.leaderboardDurationSeconds > 0
          ? session.leaderboardDurationSeconds
          : FALLBACK_LEADERBOARD_DURATION_SEC;
      return {
        changed: true,
        nextStatus: 'ACTIVE',
        nextSubstate: 'LEADERBOARD',
        nextQuestionIndex: qIdx,
        nextQuestionDeadline: qDeadline,
        nextLeaderboardDeadline: nowMs + lbSec * 1000,
      };
    }
    return noChange;
  }

  if (substate === 'LEADERBOARD') {
    const lbDeadline = session.leaderboardDeadline || 0;
    if (lbDeadline > 0 && nowMs >= lbDeadline + graceMs) {
      if (qIdx + 1 < totalQ) {
        const nextIdx = qIdx + 1;
        const nextLimit = getEffectiveQuestionTimeLimit(session, questions[nextIdx]);
        return {
          changed: true,
          nextStatus: 'ACTIVE',
          nextSubstate: 'QUESTION_OPEN',
          nextQuestionIndex: nextIdx,
          nextQuestionDeadline: nowMs + nextLimit * 1000,
          nextLeaderboardDeadline: 0,
        };
      }
      return {
        changed: true,
        nextStatus: 'COMPLETED',
        nextSubstate: 'LEADERBOARD',
        nextQuestionIndex: qIdx,
        nextQuestionDeadline: session.currentQuestionDeadline || 0,
        nextLeaderboardDeadline: lbDeadline,
      };
    }
    return noChange;
  }

  return noChange;
}

// Solo Quiz Runner Formulas
export function computeSoloPerQuestionSeconds(
  quizTimeLimitSeconds: number,
  questionCount: number
): number {
  const qCount = Math.max(1, questionCount);
  if (quizTimeLimitSeconds >= qCount * 5) {
    return clampNumber(Math.floor(quizTimeLimitSeconds / qCount), 5, 120);
  }
  return clampNumber(quizTimeLimitSeconds, 5, 120);
}

export function computeSoloPoints(
  isCorrect: boolean,
  lockedTimeRemainingSeconds: number,
  maxQuestionSeconds: number
): { pointsAwarded: number; speedBonus: number } {
  if (!isCorrect) return { pointsAwarded: 0, speedBonus: 0 };
  const safeMax = Math.max(1, maxQuestionSeconds);
  const speedBonus = clampNumber(
    Math.floor((Math.max(lockedTimeRemainingSeconds, 1) / safeMax) * 450),
    0,
    450
  );
  return {
    pointsAwarded: 550 + speedBonus,
    speedBonus,
  };
}

export interface SoloStandingEntry {
  id: string;
  name: string;
  score: number;
  isCurrentUser: boolean;
}

export const SOLO_NPC_PEER_NAMES = [
  'Sister Grace',
  'Brother Samuel',
  'Brother David O.',
  'Sister Faith',
  'Brother Emmanuel',
  'Sister Chisom',
] as const;

export function buildSoloSimulatedStandings(params: {
  userName: string;
  userScore: number;
  questionIndex: number;
  peerScores: number[];
}): SoloStandingEntry[] {
  const { userName, userScore, peerScores } = params;
  const entries: SoloStandingEntry[] = [
    {
      id: 'current-user',
      name: userName,
      score: userScore,
      isCurrentUser: true,
    },
    ...SOLO_NPC_PEER_NAMES.map((name, i) => ({
      id: `npc-${i}`,
      name,
      score: peerScores[i] ?? 0,
      isCurrentUser: false,
    })),
  ];

  return entries.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.isCurrentUser !== b.isCurrentUser) return a.isCurrentUser ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

// Atomic Solo Quiz State Machine (strictly monotonic transitions, prevents loops/double-scoring)
export const SOLO_INTERMISSION_SECONDS = 5;

export type SoloQuizPhase = 'QUESTION' | 'INTERMISSION' | 'PODIUM';

export interface SoloQuizOutcome {
  answered: boolean;
  selectedIndex: number | null;
  isCorrect: boolean;
  pointsAwarded: number;
  questionIndex: number;
}

export interface SoloQuizState {
  quizId: string;
  phase: SoloQuizPhase;
  questionIndex: number;
  deadlineMs: number;
  totalPoints: number;
  correctCount: number;
  lastOutcome: SoloQuizOutcome;
  peerScores: number[];
  perQuestionSeconds: number;
  intermissionSeconds: number;
  totalQuestions: number;
}

export type SoloQuizAction =
  | {
      type: 'RESET';
      quizId: string;
      totalQuestions: number;
      perQuestionSeconds: number;
      intermissionSeconds?: number;
      nowMs: number;
    }
  | {
      type: 'SELECT_ANSWER';
      questionIndex: number;
      optionIndex: number;
      correctAnswerIndex: number;
      nowMs: number;
    }
  | {
      type: 'QUESTION_TIMEOUT';
      questionIndex: number;
      nowMs: number;
    }
  | {
      type: 'ADVANCE_FROM_INTERMISSION';
      questionIndex: number;
      nowMs: number;
      force?: boolean;
    };

function advanceSoloPeerScores(peerScores: number[], questionIndex: number): number[] {
  return peerScores.map((sc, idx) => {
    const solved = (questionIndex + idx) % 3 !== 0;
    const speedAdd = solved ? 620 + ((idx * 53 + questionIndex * 41) % 310) : 0;
    return sc + speedAdd;
  });
}

export function createInitialSoloQuizState(params: {
  quizId: string;
  totalQuestions: number;
  perQuestionSeconds: number;
  intermissionSeconds?: number;
  nowMs: number;
}): SoloQuizState {
  const intermissionSeconds = params.intermissionSeconds ?? SOLO_INTERMISSION_SECONDS;
  const totalQuestions = Math.max(0, Math.floor(params.totalQuestions));
  const perQuestionSeconds = Math.max(5, Math.floor(params.perQuestionSeconds));
  return {
    quizId: params.quizId,
    phase: 'QUESTION',
    questionIndex: 0,
    deadlineMs:
      totalQuestions > 0 ? params.nowMs + perQuestionSeconds * 1000 : params.nowMs,
    totalPoints: 0,
    correctCount: 0,
    lastOutcome: {
      answered: false,
      selectedIndex: null,
      isCorrect: false,
      pointsAwarded: 0,
      questionIndex: 0,
    },
    peerScores: SOLO_NPC_PEER_NAMES.map(() => 0),
    perQuestionSeconds,
    intermissionSeconds,
    totalQuestions,
  };
}

export function reduceSoloQuizState(
  state: SoloQuizState,
  action: SoloQuizAction
): SoloQuizState {
  switch (action.type) {
    case 'RESET':
      return createInitialSoloQuizState(action);

    case 'SELECT_ANSWER': {
      if (
        state.phase !== 'QUESTION' ||
        state.totalQuestions <= 0 ||
        action.questionIndex !== state.questionIndex
      ) {
        return state;
      }
      const remainingSec = clampRemainingSeconds(
        state.deadlineMs,
        action.nowMs,
        state.perQuestionSeconds
      );
      const isCorrect = action.optionIndex === action.correctAnswerIndex;
      const { pointsAwarded } = computeSoloPoints(
        isCorrect,
        remainingSec,
        state.perQuestionSeconds
      );
      return {
        ...state,
        phase: 'INTERMISSION',
        deadlineMs: action.nowMs + state.intermissionSeconds * 1000,
        correctCount: state.correctCount + (isCorrect ? 1 : 0),
        totalPoints: state.totalPoints + pointsAwarded,
        lastOutcome: {
          answered: true,
          selectedIndex: action.optionIndex,
          isCorrect,
          pointsAwarded,
          questionIndex: state.questionIndex,
        },
        peerScores: advanceSoloPeerScores(state.peerScores, state.questionIndex),
      };
    }

    case 'QUESTION_TIMEOUT': {
      if (
        state.phase !== 'QUESTION' ||
        state.totalQuestions <= 0 ||
        action.questionIndex !== state.questionIndex ||
        action.nowMs < state.deadlineMs
      ) {
        return state;
      }
      return {
        ...state,
        phase: 'INTERMISSION',
        deadlineMs: action.nowMs + state.intermissionSeconds * 1000,
        lastOutcome: {
          answered: false,
          selectedIndex: null,
          isCorrect: false,
          pointsAwarded: 0,
          questionIndex: state.questionIndex,
        },
        peerScores: advanceSoloPeerScores(state.peerScores, state.questionIndex),
      };
    }

    case 'ADVANCE_FROM_INTERMISSION': {
      if (
        state.phase !== 'INTERMISSION' ||
        action.questionIndex !== state.questionIndex
      ) {
        return state;
      }
      if (!action.force && action.nowMs < state.deadlineMs) {
        return state;
      }
      if (state.questionIndex + 1 < state.totalQuestions) {
        return {
          ...state,
          phase: 'QUESTION',
          questionIndex: state.questionIndex + 1,
          deadlineMs: action.nowMs + state.perQuestionSeconds * 1000,
        };
      }
      return {
        ...state,
        phase: 'PODIUM',
        deadlineMs: 0,
      };
    }

    default:
      return state;
  }
}

// Monotonic Multiplayer Session Progress Comparison & Snapshot Reconciliation
export function getSessionProgressTuple(
  session: Pick<QuizSession, 'status' | 'currentQuestionIndex' | 'currentSubstate'>
): [number, number, number] {
  const status = normalizeSessionStatus(session.status);
  if (status === 'DRAFT') return [0, 0, 0];
  if (status === 'SCHEDULED') return [1, 0, 0];
  if (status === 'ACTIVE') {
    const qIdx = Math.max(0, Number(session.currentQuestionIndex) || 0);
    const subRank =
      session.currentSubstate === 'LEADERBOARD'
        ? 2
        : session.currentSubstate === 'QUESTION_OPEN'
        ? 1
        : 0;
    return [2, qIdx, subRank];
  }
  return [3, Math.max(0, Number(session.currentQuestionIndex) || 0), 99];
}

export function compareSessionProgress(
  a: Pick<QuizSession, 'status' | 'currentQuestionIndex' | 'currentSubstate'>,
  b: Pick<QuizSession, 'status' | 'currentQuestionIndex' | 'currentSubstate'>
): number {
  const ta = getSessionProgressTuple(a);
  const tb = getSessionProgressTuple(b);
  for (let i = 0; i < 3; i++) {
    if (ta[i] !== tb[i]) return ta[i] - tb[i];
  }
  return 0;
}

export function reconcileMultiplayerSession(
  local: QuizSession,
  remote: QuizSession
): QuizSession {
  if (local.id !== remote.id) return remote;
  const cmp = compareSessionProgress(remote, local);

  // Remote is strictly behind local fallback state -> preserve local state progression
  // while still accepting participant/score updates from Firestore.
  if (cmp < 0) {
    return {
      ...remote,
      status: local.status,
      currentSubstate: local.currentSubstate,
      currentQuestionIndex: local.currentQuestionIndex,
      currentQuestionDeadline: local.currentQuestionDeadline,
      leaderboardDeadline: local.leaderboardDeadline,
    };
  }

  // Same phase & round -> avoid resetting an initialized positive local deadline to 0
  if (cmp === 0) {
    const remoteQDeadline = remote.currentQuestionDeadline ?? 0;
    const remoteLbDeadline = remote.leaderboardDeadline ?? 0;
    return {
      ...remote,
      currentQuestionDeadline:
        remoteQDeadline > 0
          ? remoteQDeadline
          : (local.currentQuestionDeadline ?? 0),
      leaderboardDeadline:
        remoteLbDeadline > 0
          ? remoteLbDeadline
          : (local.leaderboardDeadline ?? 0),
    };
  }

  // Remote strictly ahead -> accept authoritative remote state
  return remote;
}

// Compute member quizzesCompleted and bestScore strictly from real /game_scores
export function getMemberProgressStats(
  scores: GameScore[],
  account: Pick<FellowshipAccount, 'id' | 'userId'>
): {
  quizzesCompleted: number;
  bestScore: number;
  rankTitle: string;
} {
  const ids = new Set(
    [account.id, account.userId].filter(
      (v): v is string => typeof v === 'string' && v.trim().length > 0
    )
  );
  const myScores = scores.filter((s) => ids.has(s.userId));
  const bestScore = myScores.reduce((max, s) => Math.max(max, s.score || 0), 0);
  return {
    quizzesCompleted: myScores.length,
    bestScore,
    rankTitle: kingdomRankTitle(bestScore),
  };
}

// Format GameQuiz from Firestore data safely
export function normalizeGameQuizDoc(
  id: string,
  data: Record<string, unknown>,
  createdAtMs: number
): GameQuiz {
  const questionsJson = String(data.questionsJson || '[]');
  const parsedQs = parseSoloQuizQuestions(questionsJson);
  const updatedRaw = data.updatedAt;
  let updatedAt = createdAtMs;
  if (typeof updatedRaw === 'number') updatedAt = updatedRaw;
  else if (
    updatedRaw &&
    typeof (updatedRaw as { toMillis?: () => number }).toMillis === 'function'
  ) {
    updatedAt = (updatedRaw as { toMillis: () => number }).toMillis();
  }

  return {
    id,
    createdById: String(data.createdById || ''),
    fellowshipId: String(data.fellowshipId || 'GIDEONITES'),
    title: String(data.title || 'Bible Quiz'),
    description: typeof data.description === 'string' ? data.description : undefined,
    category: String(data.category || 'BIBLE_TRIVIA'),
    questionsJson,
    totalQuestions: Math.max(1, Number(data.totalQuestions) || parsedQs.length || 1),
    timeLimitSeconds: Math.max(10, Number(data.timeLimitSeconds) || 90),
    difficulty: String(data.difficulty || 'Medium'),
    createdAt: createdAtMs,
    updatedAt,
  };
}

// Compact Android Bible Edition & Verse Pack serializers & readers (6-field & 4-field chunking)
export interface CompactBibleSection {
  t: string;
  b: string;
  c: string;
  x: number;
}

export function encodeCompactBibleSectionsChunks(
  sections: UploadedBibleSection[]
): {
  reflectionEn: string;
  reflectionYo?: string;
  reflectionHa?: string;
  reflectionIg?: string;
  verseTextYo?: string;
  verseTextHa?: string;
} {
  let compact: CompactBibleSection[] = sections.slice(0, 30).map((sec, idx) => ({
    t: (sec.title || `Section ${idx + 1}`).slice(0, 100),
    b: '',
    c: (sec.content || '').slice(0, 700),
    x: idx + 1,
  }));

  let rawJson = JSON.stringify(compact);
  if (rawJson.length > 16_000) {
    // First proportionally reduce content length to preserve as many chapters as possible
    const perCap = Math.max(120, Math.floor(14_000 / Math.max(1, compact.length)) - 60);
    compact = compact.map((s) => ({ ...s, c: s.c.slice(0, perCap) }));
    rawJson = JSON.stringify(compact);
    while (compact.length > 1 && rawJson.length > 16_000) {
      compact.pop();
      rawJson = JSON.stringify(compact);
    }
  }

  const c1 = rawJson.slice(0, 3000);
  const c2 = rawJson.slice(3000, 6000);
  const c3 = rawJson.slice(6000, 9000);
  const c4 = rawJson.slice(9000, 12000);
  const c5 = rawJson.slice(12000, 14000);
  const c6 = rawJson.slice(14000, 16000);

  return {
    reflectionEn: c1,
    ...(c2 ? { reflectionYo: c2 } : {}),
    ...(c3 ? { reflectionHa: c3 } : {}),
    ...(c4 ? { reflectionIg: c4 } : {}),
    ...(c5 ? { verseTextYo: c5 } : {}),
    ...(c6 ? { verseTextHa: c6 } : {}),
  };
}

export function decodeBibleEditionSections(
  doc: Pick<
    DailyScriptureDoc,
    | 'reflectionEn'
    | 'reflectionYo'
    | 'reflectionHa'
    | 'reflectionIg'
    | 'verseTextYo'
    | 'verseTextHa'
  >
): UploadedBibleSection[] {
  const joined = [
    doc.reflectionEn,
    doc.reflectionYo,
    doc.reflectionHa,
    doc.reflectionIg,
    doc.verseTextYo,
    doc.verseTextHa,
  ]
    .filter((s): s is string => typeof s === 'string' && s.length > 0)
    .join('');

  if (!joined.trim().startsWith('[')) {
    return joined ? [{ title: 'Edition Content', content: joined }] : [];
  }

  try {
    const parsed = JSON.parse(joined) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item, idx) => {
        const obj = (item || {}) as Record<string, unknown>;
        const title = String(obj.title || obj.t || `Section ${idx + 1}`).trim();
        const content = String(obj.content || obj.c || '').trim();
        return { title, content };
      })
      .filter((s) => s.content.length > 0);
  } catch {
    return [];
  }
}

export interface CompactVersePackEntry {
  r: string;
  t: string;
  v: string;
  m: string;
}

export function encodeCompactVersePackChunk(
  verses: { reference: string; translation: string; text: string; theme?: string }[]
): {
  reflectionEn: string;
  reflectionYo?: string;
  reflectionHa?: string;
  reflectionIg?: string;
} {
  const compact: CompactVersePackEntry[] = verses.slice(0, 35).map((item) => ({
    r: item.reference,
    t: item.translation || 'KJV',
    v: item.text,
    m: item.theme || 'Uploaded Bible Edition',
  }));
  let raw = JSON.stringify(compact);
  while (compact.length > 1 && raw.length > 12_000) {
    compact.pop();
    raw = JSON.stringify(compact);
  }
  const c1 = raw.slice(0, 3000);
  const c2 = raw.slice(3000, 6000);
  const c3 = raw.slice(6000, 9000);
  const c4 = raw.slice(9000, 12000);
  return {
    reflectionEn: c1,
    ...(c2 ? { reflectionYo: c2 } : {}),
    ...(c3 ? { reflectionHa: c3 } : {}),
    ...(c4 ? { reflectionIg: c4 } : {}),
  };
}

export function parseMultiplayerSessionDoc(
  id: string,
  data: Record<string, unknown>,
  createdAtMs: number
): QuizSession {
  const questionsJson = String(data.questionsJson || '[]');
  const parsedQs = parseMultiplayerQuestions(questionsJson);
  const rawGameType = String(
    data.gameType || parsedQs[0]?.gameType || 'TRIVIA_CHALLENGE'
  ).toUpperCase();
  const gameType: GameType =
    rawGameType === 'WHO_AM_I' || rawGameType === 'SCRIPTURE_SCRAMBLE'
      ? rawGameType
      : 'TRIVIA_CHALLENGE';
  const participantsJson = String(data.participantsJson || '[]');
  const parsedParts = parseMultiplayerParticipants(participantsJson);

  return {
    id,
    hostId: String(data.hostId || ''),
    hostName: String(data.hostName || 'Host'),
    fellowshipId: String(data.fellowshipId || 'GIDEONITES'),
    roomPin: String(data.roomPin || '000000'),
    titleEn: String(data.titleEn || data.title || 'Bible Showdown'),
    title: typeof data.title === 'string' ? data.title : undefined,
    titleYo: typeof data.titleYo === 'string' ? data.titleYo : undefined,
    titleHa: typeof data.titleHa === 'string' ? data.titleHa : undefined,
    titleIg: typeof data.titleIg === 'string' ? data.titleIg : undefined,
    description: typeof data.description === 'string' ? data.description : undefined,
    gameType,
    status: normalizeSessionStatus(String(data.status || 'COMPLETED')),
    scheduledStartTime: Number(data.scheduledStartTime) || 0,
    timeLimitPerQuestionSeconds:
      Number(data.timeLimitPerQuestionSeconds) || getGameTypeDefaultTimer(gameType),
    leaderboardDurationSeconds: Number(data.leaderboardDurationSeconds) || 8,
    currentQuestionIndex: Math.max(0, Number(data.currentQuestionIndex) || 0),
    totalQuestions: Math.max(1, Number(data.totalQuestions) || parsedQs.length || 1),
    currentSubstate:
      (data.currentSubstate as SessionSubstate) ||
      (normalizeSessionStatus(String(data.status)) === 'ACTIVE'
        ? 'QUESTION_OPEN'
        : 'WAITING_TO_START'),
    currentQuestionDeadline: Number(data.currentQuestionDeadline) || 0,
    leaderboardDeadline: Number(data.leaderboardDeadline) || 0,
    baseScorePerQuestion: Number(data.baseScorePerQuestion) || 100,
    speedBonusEnabled: data.speedBonusEnabled !== false,
    maxSpeedBonus:
      typeof data.maxSpeedBonus === 'number' ? data.maxSpeedBonus : 50,
    penaltyForIncorrect: data.penaltyForIncorrect === true,
    questionsJson,
    participantsJson,
    participantCount: Math.max(
      Number(data.participantCount) || 0,
      parsedParts.length
    ),
    scriptureFocus:
      typeof data.scriptureFocus === 'string' ? data.scriptureFocus : undefined,
    createdAt: createdAtMs,
    updatedAt: Number(data.updatedAt) || createdAtMs,
  };
}
