import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NON_HOST_GRACE_MS,
  SOLO_INTERMISSION_SECONDS,
  buildSoloSimulatedStandings,
  clampRemainingSeconds,
  compareSessionProgress,
  computeMultiplayerPoints,
  computeNextSessionState,
  computeRankMovements,
  computeSoloPerQuestionSeconds,
  computeSoloPoints,
  createInitialSoloQuizState,
  decodeBibleEditionSections,
  encodeCompactBibleSectionsChunks,
  encodeCompactVersePackChunk,
  evaluateMultiplayerAnswerSubmission,
  getClueMultiplier,
  getClueProgress,
  getGamesHeaderBannerMeta,
  getMemberProgressStats,
  getSessionTitle,
  isGamesAdmin,
  isGamesExecutive,
  isGamesGuest,
  isGamesLeadership,
  isMultiplayerAnswerCorrect,
  kingdomRankTitle,
  mergeParticipantsJson,
  normalizeGamesRole,
  normalizeSessionStatus,
  normalizeWords,
  parseMultiplayerQuestions,
  parseMultiplayerSessionDoc,
  parseSoloQuizQuestions,
  reconcileMultiplayerSession,
  reduceSoloQuizState,
  scrambleVerse,
  sortMultiplayerParticipants,
} from './gamesLogic';
import { PresetGameSessions, buildLocalizedSessionTitles } from '../data/presetGameSessions';
import { extractScriptureOfTheDay, parseLineOrJsonBibleVerses } from './fellowshipLogic';
import {
  extractBiblePackVerses,
  extractScriptureOfTheDayResources,
  extractSpiritualMemoryVerse,
} from './spiritualLogic';
import {
  getNotificationTargetTab,
  synthesizeNotificationFromFirestoreChange,
} from './notificationLogic';
import type {
  DailyScriptureDoc,
  GameScore,
  MultiplayerParticipant,
  MultiplayerQuestion,
  QuizSession,
} from '../types/fellowship';

test('role normalization and Admin vs Youth Executive asymmetries match specification', () => {
  assert.equal(normalizeGamesRole('ADMIN'), 'ADMINISTRATOR');
  assert.equal(normalizeGamesRole('EXECUTIVE'), 'YOUTH_EXECUTIVE');
  assert.equal(normalizeGamesRole('EXCO'), 'YOUTH_EXECUTIVE');
  assert.equal(normalizeGamesRole('MEMBER'), 'YOUTH_MEMBER');
  assert.equal(normalizeGamesRole('GUEST'), 'GUEST');

  assert.equal(isGamesAdmin('ADMINISTRATOR'), true);
  assert.equal(isGamesAdmin('EXECUTIVE'), false);
  assert.equal(isGamesExecutive('EXECUTIVE'), true);
  assert.equal(isGamesLeadership('EXECUTIVE'), true);
  assert.equal(isGamesLeadership('MEMBER'), false);
  assert.equal(isGamesGuest('GUEST'), true);

  const adminBanner = getGamesHeaderBannerMeta('ADMINISTRATOR');
  assert.equal(adminBanner.accentHex, '#E11D48');
  assert.match(adminBanner.title, /Game Command/);

  const execBanner = getGamesHeaderBannerMeta('YOUTH_EXECUTIVE');
  assert.equal(execBanner.accentHex, '#F59E0B');

  const memberBanner = getGamesHeaderBannerMeta('YOUTH_MEMBER');
  assert.equal(memberBanner.accentHex, '#10B981');

  const guestBanner = getGamesHeaderBannerMeta('GUEST');
  assert.equal(guestBanner.accentHex, '#3B82F6');
});

test('kingdomRankTitle preserves dual-range score & correct-count scales', () => {
  assert.equal(kingdomRankTitle(350), 'Kingdom Giant 👑');
  assert.equal(kingdomRankTitle(10), 'Kingdom Giant 👑');
  assert.equal(kingdomRankTitle(180), 'Bible Scholar 📜');
  assert.equal(kingdomRankTitle(6), 'Bible Scholar 📜');
  assert.equal(kingdomRankTitle(80), 'Faith Seeker 🌱');
  assert.equal(kingdomRankTitle(3), 'Faith Seeker 🌱');
  assert.equal(kingdomRankTitle(0), 'Bible Explorer 🧭');
  assert.equal(kingdomRankTitle(1), 'Bible Explorer 🧭');
  assert.equal(kingdomRankTitle(55), 'Bible Explorer 🧭');
});

test('scrambleVerse strips punctuation, forces changed order, and normalizeWords grades flexibly', () => {
  // Deterministic RNG returning 0.99 would normally keep order during Fisher-Yates -> reversed fallback triggers
  const identicalRng = () => 0.999;
  const words = scrambleVerse('The LORD, is with thee!', identicalRng);
  assert.deepEqual(words, ['thee', 'with', 'is', 'LORD', 'The']);

  assert.equal(normalizeWords('  The   LORD, is WITH thee! '), 'the lord is with thee');

  const q: MultiplayerQuestion = {
    id: 'q1',
    gameType: 'SCRIPTURE_SCRAMBLE',
    prompt: 'Reconstruct Judges 6:12',
    options: [],
    correctAnswer: 'The LORD is with thee, thou mighty man of valour!',
    clues: [],
    scrambledWords: words,
    scriptureReference: 'Judges 6:12',
    translation: 'KJV',
    timerSeconds: 30,
    points: 120,
    explanation: '',
  };
  assert.equal(isMultiplayerAnswerCorrect(q, 'the lord is with thee thou mighty man of valour'), true);
  assert.equal(isMultiplayerAnswerCorrect(q, 'the lord is with me'), false);
});

test('WHO_AM_I progressive clue unlock and multiplier formulas', () => {
  assert.equal(getClueMultiplier(0), 1.5);
  assert.equal(getClueMultiplier(1), 1.25);
  assert.equal(getClueMultiplier(2), 1.0);
  assert.equal(getClueMultiplier(3), 1.0);

  const deadline = 100_000;
  // 30s question, 3 clues -> 10_000ms per clue; start at 70_000
  const atStart = getClueProgress(30, deadline, 71_000, 3);
  assert.equal(atStart.currentClueIndex, 0);
  assert.equal(atStart.clueMultiplier, 1.5);

  const atMid = getClueProgress(30, deadline, 82_000, 3);
  assert.equal(atMid.currentClueIndex, 1);
  assert.equal(atMid.clueMultiplier, 1.25);

  const atEnd = getClueProgress(30, deadline, 95_000, 3);
  assert.equal(atEnd.currentClueIndex, 2);
  assert.equal(atEnd.clueMultiplier, 1.0);
});

test('computeMultiplayerPoints calculates adjustedBase + speedBonus and incorrect penalty', () => {
  const question: MultiplayerQuestion = {
    id: 'q-wai',
    gameType: 'WHO_AM_I',
    prompt: 'Who am I?',
    options: [],
    correctAnswer: 'Gideon',
    clues: ['Clue 1', 'Clue 2', 'Clue 3'],
    scrambledWords: [],
    scriptureReference: 'Judges 6',
    translation: 'KJV',
    timerSeconds: 30,
    points: 100,
    explanation: '',
  };
  const session = {
    baseScorePerQuestion: 100,
    speedBonusEnabled: true,
    maxSpeedBonus: 50,
    penaltyForIncorrect: true,
    timeLimitPerQuestionSeconds: 30,
  };

  // Answered immediately 3s into 30s round (27s remaining -> ratio 0.9, clue 1 -> 1.5x)
  const fast = computeMultiplayerPoints({
    question,
    session,
    isCorrect: true,
    submissionTimeMs: 73_000,
    currentQuestionDeadlineMs: 100_000,
  });
  assert.equal(fast.clueMultiplier, 1.5);
  assert.equal(fast.adjustedBase, 150);
  assert.equal(fast.speedBonus, 45);
  assert.equal(fast.pointsAwarded, 195);

  const wrong = computeMultiplayerPoints({
    question,
    session,
    isCorrect: false,
    submissionTimeMs: 75_000,
    currentQuestionDeadlineMs: 100_000,
  });
  assert.equal(wrong.pointsAwarded, -20);
});

test('evaluateMultiplayerAnswerSubmission enforces late-entry, duplicate-answer, and deadline checks', () => {
  const session: QuizSession = {
    id: 'quiz_1',
    hostId: 'host-1',
    hostName: 'Admin',
    fellowshipId: 'GIDEONITES',
    roomPin: '123456',
    titleEn: 'Test Showdown',
    gameType: 'TRIVIA_CHALLENGE',
    status: 'ACTIVE',
    scheduledStartTime: 0,
    timeLimitPerQuestionSeconds: 20,
    leaderboardDurationSeconds: 8,
    currentQuestionIndex: 1,
    totalQuestions: 4,
    currentSubstate: 'QUESTION_OPEN',
    currentQuestionDeadline: 200_000,
    leaderboardDeadline: 0,
    baseScorePerQuestion: 100,
    speedBonusEnabled: true,
    maxSpeedBonus: 50,
    penaltyForIncorrect: false,
    questionsJson: '[]',
    participantsJson: '[]',
    participantCount: 1,
    createdAt: 100_000,
  };

  const question: MultiplayerQuestion = {
    id: 'q2',
    gameType: 'TRIVIA_CHALLENGE',
    prompt: 'How many men with Gideon?',
    options: ['3,000', '300', '1,000', '120'],
    correctAnswer: '300',
    clues: [],
    scrambledWords: [],
    scriptureReference: 'Judges 7:7',
    translation: 'KJV',
    timerSeconds: 20,
    points: 100,
    explanation: '',
  };

  const lateJoiner: MultiplayerParticipant = {
    id: 'u1',
    userId: 'u1',
    userName: 'Ada',
    userRole: 'YOUTH_MEMBER',
    joinedAt: 150_000,
    joinedAtQuestionIndex: 1,
    currentScore: 0,
    lastQuestionPoints: 0,
    lastAnswerTimestamp: 0,
    answeredQuestionsCount: 0,
  };

  const missed = evaluateMultiplayerAnswerSubmission({
    session,
    question,
    questionIndex: 0,
    participant: lateJoiner,
    submittedAnswer: '300',
    submissionTimeMs: 190_000,
    alreadyAnsweredLedger: new Set(),
  });
  assert.equal(missed.status, 'MissedQuestion');

  const duplicate = evaluateMultiplayerAnswerSubmission({
    session,
    question,
    questionIndex: 1,
    participant: lateJoiner,
    submittedAnswer: '300',
    submissionTimeMs: 190_000,
    alreadyAnsweredLedger: new Set(['quiz_1::1::u1']),
  });
  assert.equal(duplicate.status, 'DuplicateRejected');

  const expired = evaluateMultiplayerAnswerSubmission({
    session,
    question,
    questionIndex: 1,
    participant: lateJoiner,
    submittedAnswer: '300',
    submissionTimeMs: 200_500,
    alreadyAnsweredLedger: new Set(),
  });
  assert.equal(expired.status, 'DeadlineExpired');

  const scored = evaluateMultiplayerAnswerSubmission({
    session,
    question,
    questionIndex: 1,
    participant: lateJoiner,
    submittedAnswer: '300',
    submissionTimeMs: 190_000, // 10s remaining of 20s -> speedBonus 25
    alreadyAnsweredLedger: new Set(),
  });
  assert.equal(scored.status, 'Scored');
  assert.equal(scored.isCorrect, true);
  assert.equal(scored.pointsAwarded, 125);
  assert.equal(scored.newTotalScore, 125);
});

test('mergeParticipantsJson strips peer- entries and keeps max scores, while sort tie-breaks correctly', () => {
  const existingJson = JSON.stringify([
    {
      id: 'peer-1',
      userId: 'peer-1',
      userName: 'Fake Peer',
      userRole: 'YOUTH_MEMBER',
      currentScore: 999,
      lastAnswerTimestamp: 100,
    },
    {
      id: 'u1',
      userId: 'u1',
      userName: 'Bola',
      userRole: 'YOUTH_MEMBER',
      joinedAt: 1000,
      joinedAtQuestionIndex: 0,
      currentScore: 250,
      lastQuestionPoints: 120,
      lastAnswerTimestamp: 5000,
      answeredQuestionsCount: 2,
    },
  ]);

  const merged = mergeParticipantsJson(existingJson, [
    {
      id: 'u1',
      userId: 'u1',
      userName: 'Bola',
      userRole: 'YOUTH_MEMBER',
      joinedAt: 2000,
      joinedAtQuestionIndex: 1,
      currentScore: 180, // stale lower score shouldn't overwrite 250
      lastQuestionPoints: 100,
      lastAnswerTimestamp: 4000,
      answeredQuestionsCount: 1,
    },
    {
      id: 'u2',
      userId: 'u2',
      userName: 'Ada',
      userRole: 'YOUTH_EXECUTIVE',
      joinedAt: 1100,
      joinedAtQuestionIndex: 0,
      currentScore: 250, // tied score, earlier timestamp -> ranks #1
      lastQuestionPoints: 130,
      lastAnswerTimestamp: 4200,
      answeredQuestionsCount: 2,
    },
  ]);

  assert.equal(merged.participantCount, 2);
  assert.equal(merged.mergedList.some((p) => p.userId.startsWith('peer-')), false);

  const sorted = sortMultiplayerParticipants(merged.mergedList);
  assert.equal(sorted[0].userId, 'u2'); // 250 @ 4200ms beats 250 @ 5000ms
  assert.equal(sorted[1].userId, 'u1');
  assert.equal(sorted[1].currentScore, 250);

  const prevRanks = new Map<string, number>([
    ['u1', 1],
    ['u2', 3],
  ]);
  const ranked = computeRankMovements(sorted, prevRanks);
  assert.equal(ranked[0].rank, 1);
  assert.equal(ranked[0].rankMovement, 2); // ▲ +2
  assert.equal(ranked[1].rank, 2);
  assert.equal(ranked[1].rankMovement, -1); // ▼ -1
});

test('computeNextSessionState enforces NON_HOST_GRACE_MS (1500ms) and full state transitions', () => {
  const q1 = PresetGameSessions.getPresetQuestions('TRIVIA_CHALLENGE', 'EN')[0];
  const q2 = PresetGameSessions.getPresetQuestions('TRIVIA_CHALLENGE', 'EN')[1];

  const scheduled: QuizSession = {
    id: 'quiz_test_state',
    hostId: 'host-1',
    hostName: 'Admin',
    fellowshipId: 'GIDEONITES',
    roomPin: '445566',
    titleEn: 'State Machine',
    gameType: 'TRIVIA_CHALLENGE',
    status: 'SCHEDULED',
    scheduledStartTime: 50_000,
    timeLimitPerQuestionSeconds: 20,
    leaderboardDurationSeconds: 8,
    currentQuestionIndex: 0,
    totalQuestions: 2,
    currentSubstate: 'WAITING_TO_START',
    currentQuestionDeadline: 0,
    leaderboardDeadline: 0,
    baseScorePerQuestion: 100,
    speedBonusEnabled: true,
    maxSpeedBonus: 50,
    questionsJson: JSON.stringify([q1, q2]),
    participantsJson: '[]',
    participantCount: 0,
    createdAt: 40_000,
  };

  // Non-host 500ms past start waits for host
  const nonHostBeforeGrace = computeNextSessionState({
    session: scheduled,
    questions: [q1, q2],
    nowMs: 50_500,
    isHostDevice: false,
  });
  assert.equal(nonHostBeforeGrace.changed, false);

  // Host transitions right at scheduledStartTime
  const hostStart = computeNextSessionState({
    session: scheduled,
    questions: [q1, q2],
    nowMs: 50_000,
    isHostDevice: true,
  });
  assert.equal(hostStart.changed, true);
  assert.equal(hostStart.nextStatus, 'ACTIVE');
  assert.equal(hostStart.nextSubstate, 'QUESTION_OPEN');
  assert.equal(hostStart.nextQuestionDeadline, 70_000);

  // Non-host triggers after grace window
  const nonHostAfterGrace = computeNextSessionState({
    session: scheduled,
    questions: [q1, q2],
    nowMs: 50_000 + NON_HOST_GRACE_MS,
    isHostDevice: false,
  });
  assert.equal(nonHostAfterGrace.changed, true);

  // End of Question 2 leaderboard -> COMPLETED
  const lbFinal = computeNextSessionState({
    session: {
      ...scheduled,
      status: 'ACTIVE',
      currentSubstate: 'LEADERBOARD',
      currentQuestionIndex: 1,
      leaderboardDeadline: 100_000,
    },
    questions: [q1, q2],
    nowMs: 100_000,
    isHostDevice: true,
  });
  assert.equal(lbFinal.changed, true);
  assert.equal(lbFinal.nextStatus, 'COMPLETED');

  assert.equal(clampRemainingSeconds(125_000, 100_000, 20), 20);
  assert.equal(clampRemainingSeconds(99_000, 100_000, 20), 0);
});

test('Solo quiz formulas, NPC standings, and presets in EN/YO/HA/IG work properly', () => {
  assert.equal(computeSoloPerQuestionSeconds(90, 5), 18);
  assert.equal(computeSoloPerQuestionSeconds(12, 5), 12);
  assert.equal(computeSoloPerQuestionSeconds(2, 5), 5);

  const fastSolo = computeSoloPoints(true, 18, 18);
  assert.equal(fastSolo.speedBonus, 450);
  assert.equal(fastSolo.pointsAwarded, 1000);
  assert.equal(computeSoloPoints(false, 18, 18).pointsAwarded, 0);

  const standings = buildSoloSimulatedStandings({
    userName: 'Chidi',
    userScore: 1000,
    questionIndex: 0,
    peerScores: [900, 800, 700, 600, 500, 400],
  });
  assert.equal(standings.length, 7);
  assert.equal(standings[0].isCurrentUser, true);

  for (const lang of ['EN', 'YO', 'HA', 'IG'] as const) {
    assert.equal(PresetGameSessions.getPresetQuestions('TRIVIA_CHALLENGE', lang).length, 4);
    assert.equal(PresetGameSessions.getPresetQuestions('WHO_AM_I', lang).length, 4);
    assert.equal(PresetGameSessions.getPresetQuestions('SCRIPTURE_SCRAMBLE', lang).length, 3);
    assert.equal(PresetGameSessions.getSoloFallbackQuestions(lang).length, 5);
  }

  const titles = buildLocalizedSessionTitles('TRIVIA_CHALLENGE');
  assert.equal(getSessionTitle({ ...titles }, 'YO'), titles.titleYo);
  assert.equal(getSessionTitle({ ...titles }, 'HA'), titles.titleHa);
  assert.equal(getSessionTitle({ ...titles }, 'IG'), titles.titleIg);
});

test('Bible EDITION & PACK dateKey filtering, compact chunk encode/decode, and pipe parser', () => {
  const sections = Array.from({ length: 24 }, (_, i) => ({
    title: `Chapter ${i + 1}`,
    content: 'In the beginning God created the heaven and the earth. '.repeat(12),
  }));
  const encoded = encodeCompactBibleSectionsChunks(sections);
  const decoded = decodeBibleEditionSections(encoded);
  assert.equal(decoded.length, 24);
  assert.equal(decoded[0].title, 'Chapter 1');

  const packed = encodeCompactVersePackChunk([
    {
      reference: 'Judges 6:12',
      translation: 'KJV',
      text: 'The LORD is with thee, thou mighty man of valour.',
      theme: 'Courage & Boldness',
    },
  ]);

  const docs: DailyScriptureDoc[] = [
    {
      id: 'scripture_1700_edition',
      fellowshipId: 'GIDEONITES',
      dateKey: 'BIBLE_EDITION',
      referenceEn: 'KJV (PDF)',
      verseTextEn: 'Compact Bible',
      ...encoded,
      prayerPromptEn: JSON.stringify({ category: 'BIBLE_DOCUMENT', title: 'Compact Bible' }),
      createdAt: 99999,
    },
    {
      id: 'scripture_1700_pack',
      fellowshipId: 'GIDEONITES',
      dateKey: 'BIBLE_PACK',
      referenceEn: 'KJV Pack #1',
      verseTextEn: '1 verses',
      ...packed,
      prayerPromptEn: JSON.stringify({ category: 'BIBLE_VERSE_PACK', chunkIdx: 0 }),
      createdAt: 99999,
    },
  ];

  // Must NEVER leak into daily scripture or devotional resources
  assert.equal(extractScriptureOfTheDay(docs, 'EN').reference, 'Judges 6:12');
  assert.equal(extractSpiritualMemoryVerse(docs, 'EN').id, 'default-memory-daniel-11-32b');
  assert.equal(extractScriptureOfTheDayResources(docs).length, 0);

  // Must cleanly decode compact {r,t,v,m} pack verses
  const packVerses = extractBiblePackVerses(docs);
  assert.equal(packVerses.length, 1);
  assert.equal(packVerses[0].reference, 'Judges 6:12');
  assert.equal(packVerses[0].theme, 'Courage & Boldness');

  const pipeVerses = parseLineOrJsonBibleVerses(
    'Joshua 1:9 | Be strong and of a good courage | NKJV | Courage & Boldness',
    'LINE',
    'KJV'
  );
  assert.equal(pipeVerses.length, 1);
  assert.equal(pipeVerses[0].translation, 'NKJV');
  assert.equal(pipeVerses[0].theme, 'Courage & Boldness');
});

test('Notification routing and quiz/score parsing helpers work accurately', () => {
  assert.equal(getNotificationTargetTab('GAME_TIME'), 'games');
  assert.equal(
    synthesizeNotificationFromFirestoreChange({
      collectionName: 'quiz_sessions',
      docId: 'quiz_draft_1',
      data: { fellowshipId: 'GIDEONITES', status: 'DRAFT', titleEn: 'Hidden Draft' },
      changeType: 'added',
    }),
    null
  );
  const liveNotif = synthesizeNotificationFromFirestoreChange({
    collectionName: 'quiz_sessions',
    docId: 'quiz_live_1',
    data: { fellowshipId: 'GIDEONITES', status: 'ACTIVE', titleEn: 'Sword Drill', roomPin: '778899' },
    changeType: 'added',
  });
  assert.equal(liveNotif?.type, 'GAME_TIME');
  assert.equal(liveNotif?.targetTab, 'games');
  assert.match(liveNotif?.title || '', /Sword Drill/);

  const parsedSession = parseMultiplayerSessionDoc('quiz_abc', {
    hostId: 'h1',
    hostName: 'Admin',
    fellowshipId: 'GIDEONITES',
    roomPin: '112233',
    titleEn: 'Showdown',
    gameType: 'WHO_AM_I',
    status: 'LIVE',
    questionsJson: JSON.stringify(PresetGameSessions.getPresetQuestions('WHO_AM_I', 'EN')),
  }, 12345);
  assert.equal(normalizeSessionStatus(parsedSession.status), 'ACTIVE');
  assert.equal(parseMultiplayerQuestions(parsedSession.questionsJson).length, 4);

  const scores: GameScore[] = [
    {
      id: 'mp-score-q1-u1',
      quizId: 'q1',
      quizTitle: 'Showdown',
      userId: 'u1',
      userName: 'Ada',
      fellowshipId: 'GIDEONITES',
      score: 420,
      totalQuestions: 400,
      timeTakenSeconds: 45,
      completedAt: 1000,
      createdAt: 1000,
      updatedAt: 1000,
    },
  ];
  const stats = getMemberProgressStats(scores, { id: 'u1', userId: 'u1' });
  assert.equal(stats.quizzesCompleted, 1);
  assert.equal(stats.bestScore, 420);
  assert.equal(stats.rankTitle, 'Kingdom Giant 👑');
});

test('parseSoloQuizQuestions resolves numeric strings, answerIndex, text answers, and letter codes', () => {
  const raw = JSON.stringify([
    {
      id: 'q-str',
      question: 'Who led 300 men?',
      options: ['Moses', 'Gideon', 'Joshua', 'Samson'],
      correctAnswerIndex: '1',
      scriptureRef: 'Judges 7:7',
    },
    {
      id: 'q-text',
      question: 'Battle cry?',
      options: ['Alpha', 'The sword of the LORD, and of Gideon!', 'Omega', 'Selah'],
      correctAnswer: 'the sword of the lord, and of gideon!',
    },
    {
      id: 'q-letter',
      prompt: 'Young leader advised by Paul?',
      options: ['Silas', 'Apollos', 'Barnabas', 'Timothy'],
      answerIndex: '3',
    },
    {
      id: 'q-letter-char',
      question: 'Letter test',
      options: ['First', 'Second', 'Third', 'Fourth'],
      correctAnswer: 'C',
    },
  ]);

  const parsed = parseSoloQuizQuestions(raw);
  assert.equal(parsed.length, 4);
  assert.equal(parsed[0].correctAnswerIndex, 1);
  assert.equal(parsed[1].correctAnswerIndex, 1);
  assert.equal(parsed[2].correctAnswerIndex, 3);
  assert.equal(parsed[3].correctAnswerIndex, 2);
});

test('reduceSoloQuizState progresses monotonically without loops, double-scoring, or skipped questions', () => {
  let state = createInitialSoloQuizState({
    quizId: 'quiz_solo_1',
    totalQuestions: 2,
    perQuestionSeconds: 20,
    nowMs: 10_000,
  });

  assert.equal(state.phase, 'QUESTION');
  assert.equal(state.questionIndex, 0);
  assert.equal(state.deadlineMs, 30_000);

  // Premature timeout is a no-op
  const prematureTimeout = reduceSoloQuizState(state, {
    type: 'QUESTION_TIMEOUT',
    questionIndex: 0,
    nowMs: 15_000,
  });
  assert.equal(prematureTimeout, state);

  // Clicking correct answer immediately grades and enters INTERMISSION
  state = reduceSoloQuizState(state, {
    type: 'SELECT_ANSWER',
    questionIndex: 0,
    optionIndex: 2,
    correctAnswerIndex: 2,
    nowMs: 15_000,
  });
  assert.equal(state.phase, 'INTERMISSION');
  assert.equal(state.questionIndex, 0);
  assert.equal(state.correctCount, 1);
  assert.equal(state.lastOutcome.isCorrect, true);
  assert.ok(state.totalPoints > 550);
  assert.equal(state.deadlineMs, 15_000 + SOLO_INTERMISSION_SECONDS * 1000);

  // Duplicate answer click or timeout during INTERMISSION is a strict no-op (never double-scores)
  const dupClick = reduceSoloQuizState(state, {
    type: 'SELECT_ANSWER',
    questionIndex: 0,
    optionIndex: 2,
    correctAnswerIndex: 2,
    nowMs: 15_100,
  });
  assert.equal(dupClick, state);

  // Advance to Q2 (force click)
  state = reduceSoloQuizState(state, {
    type: 'ADVANCE_FROM_INTERMISSION',
    questionIndex: 0,
    nowMs: 16_000,
    force: true,
  });
  assert.equal(state.phase, 'QUESTION');
  assert.equal(state.questionIndex, 1);
  assert.equal(state.deadlineMs, 36_000);

  // Duplicate advance from Q0 (e.g. race condition) is ignored and never skips Q1
  const dupAdvance = reduceSoloQuizState(state, {
    type: 'ADVANCE_FROM_INTERMISSION',
    questionIndex: 0,
    nowMs: 16_050,
    force: true,
  });
  assert.equal(dupAdvance, state);
  assert.equal(state.questionIndex, 1);

  // Timeout on Q2 moves to INTERMISSION with answered=false
  state = reduceSoloQuizState(state, {
    type: 'QUESTION_TIMEOUT',
    questionIndex: 1,
    nowMs: 36_100,
  });
  assert.equal(state.phase, 'INTERMISSION');
  assert.equal(state.lastOutcome.answered, false);
  assert.equal(state.correctCount, 1);

  // Timer expires on Q2 intermission -> transitions to PODIUM
  state = reduceSoloQuizState(state, {
    type: 'ADVANCE_FROM_INTERMISSION',
    questionIndex: 1,
    nowMs: 36_100 + SOLO_INTERMISSION_SECONDS * 1000,
  });
  assert.equal(state.phase, 'PODIUM');
  assert.equal(state.correctCount, 1);
});

test('reconcileMultiplayerSession prevents stale onSnapshot regression and timer reset loops', () => {
  const base: QuizSession = {
    id: 'quiz_mp_reconcile',
    hostId: 'host-1',
    hostName: 'Admin',
    fellowshipId: 'GIDEONITES',
    roomPin: '998877',
    titleEn: 'Reconcile Test',
    gameType: 'TRIVIA_CHALLENGE',
    status: 'ACTIVE',
    scheduledStartTime: 0,
    timeLimitPerQuestionSeconds: 20,
    leaderboardDurationSeconds: 8,
    currentQuestionIndex: 0,
    totalQuestions: 4,
    currentSubstate: 'LEADERBOARD',
    currentQuestionDeadline: 50_000,
    leaderboardDeadline: 58_000,
    baseScorePerQuestion: 100,
    speedBonusEnabled: true,
    maxSpeedBonus: 50,
    questionsJson: '[]',
    participantsJson: JSON.stringify([{ id: 'u1', userId: 'u1', userName: 'Ada', currentScore: 0 }]),
    participantCount: 1,
    createdAt: 10_000,
  };

  // Remote snapshot still at QUESTION_OPEN round 0 (e.g. another player joined/submitted)
  const staleRemote: QuizSession = {
    ...base,
    currentSubstate: 'QUESTION_OPEN',
    currentQuestionIndex: 0,
    currentQuestionDeadline: 0,
    leaderboardDeadline: 0,
    participantsJson: JSON.stringify([
      { id: 'u1', userId: 'u1', userName: 'Ada', currentScore: 120 },
      { id: 'u2', userId: 'u2', userName: 'Tunde', currentScore: 0 },
    ]),
    participantCount: 2,
  };

  assert.ok(compareSessionProgress(staleRemote, base) < 0);
  const reconciled = reconcileMultiplayerSession(base, staleRemote);
  // Keeps local progressed state & deadlines while accepting latest participants
  assert.equal(reconciled.currentSubstate, 'LEADERBOARD');
  assert.equal(reconciled.leaderboardDeadline, 58_000);
  assert.equal(reconciled.participantCount, 2);

  // Same phase with remote deadline=0 does not reset positive local deadline
  const localQ1: QuizSession = {
    ...base,
    currentSubstate: 'QUESTION_OPEN',
    currentQuestionIndex: 1,
    currentQuestionDeadline: 75_000,
    leaderboardDeadline: 0,
  };
  const remoteQ1NoDeadline: QuizSession = {
    ...localQ1,
    currentQuestionDeadline: 0,
  };
  assert.equal(compareSessionProgress(remoteQ1NoDeadline, localQ1), 0);
  assert.equal(
    reconcileMultiplayerSession(localQ1, remoteQ1NoDeadline).currentQuestionDeadline,
    75_000
  );

  // Remote COMPLETED always wins
  const remoteCompleted: QuizSession = {
    ...base,
    status: 'COMPLETED',
    currentQuestionIndex: 3,
  };
  assert.ok(compareSessionProgress(remoteCompleted, localQ1) > 0);
  assert.equal(reconcileMultiplayerSession(localQ1, remoteCompleted).status, 'COMPLETED');
});

