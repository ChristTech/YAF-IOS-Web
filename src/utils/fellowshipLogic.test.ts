import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_SECRETARIAT_ADDRESS,
  DAY_MS,
  DEFAULT_MINISTRY_AUTHOR,
  SAFE_FIRESTORE_DOC_BYTES,
  applyAccountBrandMigration,
  buildAttendanceCsv,
  buildCsvContent,
  buildFinancesCsv,
  buildNewAccountFirestoreDoc,
  buildPassMailtoHref,
  buildProgrammeIcsContent,
  buildReminderSchedule,
  buildRosterCsv,
  buildWhatsAppChatUrl,
  calculateRegistrationProgress,
  canManageFellowship,
  chunkStringForFirestore,
  classifyFirestoreConnectionCheckError,
  computeProgrammeEndDateMillis,
  endOfDayMillis,
  estimatePayloadBytes,
  extractScriptureOfTheDay,
  filterActiveAccounts,
  filterActiveProgrammes,
  filterAndSortForumPosts,
  filterProgrammesByEventCategory,
  formatActionErrorMessage,
  formatAuditDateTime,
  formatNGN,
  formatNGNDecimal,
  formatRegistrantsSummary,
  generateGivingReference,
  generateOfficialPassCode,
  generatePassCode,
  generateQrPassCode,
  getAttendanceTotalCount,
  getDepartmentDisplayName,
  getDisplayNameForAccount,
  getRoleLabel,
  isClientOfflineFirestoreError,
  isEventDatePassed,
  isForumPostExpired,
  isPendingApprovalStatus,
  isTuesdayDate,
  isUserRegisteredForProgramme,
  isValidFirebaseClientConfig,
  isWithinFirestoreDocLimit,
  normalizeAccountRoleForFirestore,
  normalizeDepartmentType,
  normalizeForumCategory,
  normalizeInquiryStatus,
  normalizeLanguageForFirestore,
  parseJsonArray,
  parseLineOrJsonBibleVerses,
  resolveMigratedAccountAddress,
  sanitizeChurchBrandText,
  scrambleWord,
  serializeCommentsWithinLimit,
  sortProgrammesAscending,
  startOfDayMillis,
  sumCompletedGiving,
  sumGivingRecords,
} from './fellowshipLogic';
import type {
  AttendanceRecord,
  CommunityPost,
  DailyScriptureDoc,
  FellowshipAccount,
  GivingRecord,
  PostComment,
  Programme,
} from '../types/fellowship';

test('filterActiveAccounts excludes PURGED accounts', () => {
  const accounts: FellowshipAccount[] = [
    {
      id: 'user-admin-01',
      fellowshipId: 'GIDEONITES',
      fullName: 'Admin',
      email: 'admin@youthalive.org',
      role: 'ADMINISTRATOR',
      status: 'APPROVED',
      department: 'Executive',
      preferredLanguage: 'EN',
      createdAt: 1000,
    },
    {
      id: 'u-purged',
      fellowshipId: 'GIDEONITES',
      fullName: 'Old Member',
      email: 'old@example.com',
      role: 'MEMBER',
      status: 'PURGED',
      department: 'Choir & Music',
      preferredLanguage: 'EN',
      createdAt: 1000,
    },
  ];
  const active = filterActiveAccounts(accounts);
  assert.equal(active.length, 1);
  assert.equal(active[0].id, 'user-admin-01');
});

test('isForumPostExpired enforces 3-day Work/Skills TTL, 7-day standard TTL, and non-expiring announcements', () => {
  const now = 1_700_000_000_000;
  assert.equal(
    isForumPostExpired({ category: 'Work/Skills', createdAt: now - 2 * DAY_MS }, now),
    false
  );
  assert.equal(
    isForumPostExpired({ category: 'Spiritual Growth', createdAt: now - 4 * DAY_MS }, now),
    true
  );
  assert.equal(
    isForumPostExpired({ category: 'work & skills', createdAt: now - 4 * DAY_MS }, now),
    true
  );
  assert.equal(
    isForumPostExpired({ category: 'Prayer Requests', createdAt: now - 5 * DAY_MS }, now),
    false
  );
  assert.equal(
    isForumPostExpired({ category: 'Discussion', createdAt: now - 8 * DAY_MS }, now),
    true
  );
  assert.equal(
    isForumPostExpired({ category: 'ANNOUNCEMENT_URGENT', createdAt: now - 30 * DAY_MS }, now),
    false
  );
  assert.equal(
    isForumPostExpired({ category: 'announcement_normal', createdAt: now - 30 * DAY_MS }, now),
    false
  );
});

test('CommunityHub forum normalization, sorting, search, Tuesday gate, WhatsApp URL, and comment serialization', () => {
  assert.equal(normalizeForumCategory('Faith & Career'), 'Discussion');
  assert.equal(normalizeForumCategory('Spiritual Growth'), 'Work/Skills');
  assert.equal(normalizeForumCategory('work_skills'), 'Work/Skills');

  // Nov 17, 2026 is Tuesday (local getDay() === 2); Nov 16, 2026 is Monday (getDay() === 1)
  assert.equal(isTuesdayDate(new Date(2026, 10, 17, 10, 0)), true);
  assert.equal(isTuesdayDate(new Date(2026, 10, 16, 10, 0)), false);

  const now = 1_700_000_000_000;
  const posts: CommunityPost[] = [
    {
      id: 'p-hidden',
      fellowshipId: 'GIDEONITES',
      authorId: 'u1',
      authorName: 'Hidden',
      authorRole: 'MEMBER',
      category: 'Discussion',
      content: 'Should not show',
      likesCount: 0,
      commentsJson: '[]',
      isHidden: true,
      createdAt: now - 1000,
    },
    {
      id: 'p-ann',
      fellowshipId: 'GIDEONITES',
      authorId: 'u1',
      authorName: 'Admin',
      authorRole: 'ADMINISTRATOR',
      category: 'announcement_urgent',
      content: 'Announcement belongs elsewhere',
      likesCount: 0,
      commentsJson: '[]',
      createdAt: now - 500,
    },
    {
      id: 'p-pinned',
      fellowshipId: 'GIDEONITES',
      authorId: 'u2',
      authorName: 'Chidi',
      authorRole: 'YOUTH_EXECUTIVE',
      category: 'Faith & Career',
      title: 'CV Clinic',
      content: 'Join Saturday review',
      likesCount: 2,
      commentsJson: '[]',
      isPinned: true,
      isFlagged: false,
      createdAt: now - 10_000,
    },
    {
      id: 'p-newer-flagged',
      fellowshipId: 'GIDEONITES',
      authorId: 'u3',
      authorName: 'Ada',
      authorRole: 'MEMBER',
      category: 'Spiritual Growth',
      title: 'UI/UX Design',
      content: 'Landing pages & mobile apps',
      whatsappContact: '08031234567',
      likesCount: 1,
      commentsJson: '[]',
      isPinned: false,
      isFlagged: true,
      createdAt: now - 2_000,
    },
  ];

  const feed = filterAndSortForumPosts(posts, { nowMs: now, filterChip: 'All', searchQuery: '' });
  assert.equal(feed.length, 2);
  assert.equal(feed[0].id, 'p-pinned'); // Pinned first even if older
  assert.equal(feed[1].id, 'p-newer-flagged');

  const workSearch = filterAndSortForumPosts(posts, {
    nowMs: now,
    filterChip: 'Work/Skills',
    searchQuery: '0803123',
  });
  assert.equal(workSearch.length, 1);
  assert.equal(workSearch[0].id, 'p-newer-flagged');

  const flaggedLeadership = filterAndSortForumPosts(posts, {
    nowMs: now,
    filterChip: 'Flagged',
    isLeadership: true,
  });
  assert.equal(flaggedLeadership.length, 1);
  assert.equal(flaggedLeadership[0].id, 'p-newer-flagged');

  const waPhone = buildWhatsAppChatUrl('08031234567', 'UI/UX Design');
  assert.equal(
    waPhone,
    `https://wa.me/2348031234567?text=${encodeURIComponent('Hello from The Gideonites Youth Forum regarding "UI/UX Design"')}`
  );
  assert.equal(buildWhatsAppChatUrl('wa.me/2348011111111', 'Test'), 'https://wa.me/2348011111111');
  assert.equal(buildWhatsAppChatUrl('https://chat.whatsapp.com/abc', 'Test'), 'https://chat.whatsapp.com/abc');

  const hugeComments: PostComment[] = Array.from({ length: 120 }, (_, i) => ({
    id: `c-${i}`,
    postId: 'p1',
    authorId: 'u1',
    authorName: 'Member',
    authorRole: 'MEMBER',
    authorAvatarUri: 'data:image/jpeg;base64,' + 'A'.repeat(3000),
    content: `Comment #${i}`,
    createdAt: now + i,
  }));
  const serialized = serializeCommentsWithinLimit(hugeComments, 340_000);
  assert.ok(serialized.length <= 340_000);
  assert.equal(serialized.includes('authorAvatarUri'), false);
});

test('Executive inquiry, Department normalization, QR pass codes, and attendance totals', () => {
  assert.equal(normalizeInquiryStatus('OPEN'), 'PENDING');
  assert.equal(normalizeInquiryStatus('ANSWERED'), 'RESOLVED');
  assert.equal(normalizeInquiryStatus('IN_PROGRESS'), 'IN_PROGRESS');

  assert.equal(normalizeDepartmentType('Choir & Music'), 'CHOIR');
  assert.equal(normalizeDepartmentType('Media & Technical Team'), 'MEDIA');
  assert.equal(normalizeDepartmentType('HOSPITALITY'), 'HOSPITALITY');
  assert.equal(getDepartmentDisplayName('USHERING'), 'Ushering & Protocol');

  const qr = generateQrPassCode(0.5);
  assert.match(qr, /^CYP-\d{4}$/);

  const att: AttendanceRecord[] = [
    {
      id: 'a1',
      fellowshipId: 'GIDEONITES',
      userId: 'u1',
      userName: 'Exco',
      department: 'GENERAL',
      verificationCode: 'LEADER',
      serviceTitle: 'Sunday Youth Service',
      meetingTitle: 'Sunday Youth Service',
      totalAttendees: 55,
      maleCount: 25,
      femaleCount: 30,
      firstTimersCount: 3,
      checkedInBy: 'Admin',
      createdAt: 1000,
    },
    {
      id: 'a2',
      fellowshipId: 'GIDEONITES',
      userId: 'u2',
      userName: 'Member',
      department: 'CHOIR',
      verificationCode: 'CYP-2026',
      serviceTitle: 'Sunday Youth Service',
      checkedInBy: 'Member',
      createdAt: 2000,
    },
  ];
  assert.equal(getAttendanceTotalCount(att), 56);
});

test('registration progress, NGN formatting, pass code, and CSV export work cleanly', () => {
  const prog = calculateRegistrationProgress(45, 100);
  assert.equal(prog.percentage, 45);
  assert.equal(prog.spotsLeft, 55);
  assert.equal(prog.isFull, false);

  assert.equal(formatNGN(25000), '₦25,000');

  const records: GivingRecord[] = [
    {
      id: 'g1',
      fellowshipId: 'GIDEONITES',
      userId: 'u1',
      donorName: 'Peace',
      category: 'Tithe',
      amountNgn: 15000,
      referenceNote: 'Monthly tithe',
      status: 'VERIFIED',
      createdAt: 1000,
    },
    {
      id: 'g2',
      fellowshipId: 'GIDEONITES',
      userId: 'u2',
      donorName: 'David',
      category: 'Offering',
      amountNgn: 5000,
      referenceNote: 'Sunday',
      status: 'RECORDED',
      createdAt: 2000,
    },
  ];
  assert.equal(sumGivingRecords(records), 20000);

  const pass = generatePassCode('user-1', 'prog-1');
  assert.match(pass, /^GID-\d{6}$/);

  const officialPass = generateOfficialPassCode('prog_ab12', 'user_cd34');
  assert.equal(officialPass, '#GID-AB12-CD34');

  const csv = buildCsvContent(['Name', 'Note'], [['Peace', 'Tithe, October']]);
  assert.equal(csv, 'Name,Note\nPeace,"Tithe, October"');

  assert.equal(
    getDisplayNameForAccount({ id: 'user-admin-01', role: 'ADMINISTRATOR', fullName: 'Something Else' }),
    'Admin'
  );
  assert.equal(canManageFellowship('YOUTH_EXECUTIVE'), true);
  assert.equal(getRoleLabel('YOUTH_EXECUTIVE'), 'Youth Executive');
  assert.notEqual(scrambleWord('GIDEON', 1), 'GIDEON');
  assert.deepEqual(parseJsonArray('invalid', [1]), [1]);
});

test('estimatePayloadBytes and isWithinFirestoreDocLimit enforce safe Firestore document sizing', () => {
  const smallPayload = { id: 'p1', content: 'Hello Gideonites' };
  assert.ok(estimatePayloadBytes(smallPayload) < 200);
  assert.equal(isWithinFirestoreDocLimit(smallPayload), true);

  const oversizedPayload = { id: 'p2', photoUrl: 'x'.repeat(SAFE_FIRESTORE_DOC_BYTES + 1000) };
  assert.equal(isWithinFirestoreDocLimit(oversizedPayload), false);
  assert.equal(isWithinFirestoreDocLimit({ text: 'hello' }, 5), false);
});

test('formatActionErrorMessage translates Firestore JSON errors into readable alerts', () => {
  const permJson = JSON.stringify({
    error: 'Missing or insufficient permissions.',
    operationType: 'update',
    path: 'community_posts/post_1',
  });
  assert.match(formatActionErrorMessage(new Error(permJson)), /Permission denied/i);

  const unauthPermJson = JSON.stringify({
    error: 'Missing or insufficient permissions.',
    operationType: 'create',
    path: 'community_posts/post-1',
    authInfo: { userId: null },
  });
  assert.match(formatActionErrorMessage(new Error(unauthPermJson)), /Sign in with Google/i);

  const sizeJson = JSON.stringify({
    error: 'Document exceeds the maximum allowed size of 1,048,576 bytes.',
    operationType: 'create',
    path: 'community_posts/post-1',
  });
  assert.match(formatActionErrorMessage(new Error(sizeJson)), /too large/i);
  assert.equal(formatActionErrorMessage(new Error('Custom validation error')), 'Custom validation error');
});

test('extractScriptureOfTheDay filters Bible packs/sermons, picks newest publishedAt, and auto-localizes presets', () => {
  const docs: DailyScriptureDoc[] = [
    {
      id: 'scripture_bibledoc_1',
      fellowshipId: 'GIDEONITES',
      referenceEn: 'KJV PDF',
      verseTextEn: 'KJV',
      prayerPromptEn: '{}',
      createdAt: 5000,
    },
    {
      id: 'scripture_res_1',
      fellowshipId: 'GIDEONITES',
      type: 'SERMON',
      referenceEn: 'Acts 1:8',
      verseTextEn: 'Power From On High',
      prayerPromptEn: JSON.stringify({ kind: 'SERMON', title: 'Power' }),
      createdAt: 6000,
    },
    {
      id: 'scripture_older',
      fellowshipId: 'GIDEONITES',
      referenceEn: 'Joshua 1:9',
      verseTextEn: 'Be strong and of a good courage.',
      prayerPromptEn: JSON.stringify({ category: 'SCRIPTURE_OF_THE_DAY', publishedAt: 1000 }),
      authorName: 'Exec A',
      createdAt: 9000,
    },
    {
      id: 'scripture_latest',
      fellowshipId: 'GIDEONITES',
      referenceEn: 'Daniel 11:32b',
      verseTextEn: 'But the people that do know their God shall be strong, and do exploits.',
      reflectionEn:
        'But the people that do know their God shall be strong, and do exploits.\n\nGideonites Youth Charge:\nStand boldly for Christ!',
      prayerPromptEn: JSON.stringify({ category: 'SCRIPTURE_OF_THE_DAY', publishedAt: 2000 }),
      authorName: 'Admin',
      createdAt: 4000,
    },
  ];

  const en = extractScriptureOfTheDay(docs, 'EN');
  assert.equal(en.id, 'scripture_latest');
  assert.equal(en.reference, 'Daniel 11:32b');
  assert.equal(en.chargeText, 'Stand boldly for Christ!');

  const yo = extractScriptureOfTheDay(docs, 'YO');
  assert.match(yo.verseText, /Ọlọ́run/);

  const fallback = extractScriptureOfTheDay([], 'EN');
  assert.equal(fallback.reference, 'Judges 6:12');
  assert.equal(fallback.authorName, 'Living Faith Church Youth Ministry');
});

test('programmes sort ascending by startDateMillis, filter by EventCategory, and generate reminder ICS/mailto', () => {
  const pLater: Programme = {
    id: 'prog_9999',
    fellowshipId: 'GIDEONITES',
    titleEn: 'Prayer Vigil',
    category: 'PRAYER_MEETING',
    venue: 'Main Altar',
    participantLimit: 100,
    startDateMillis: 1_800_000_000_000,
    registrationsJson: JSON.stringify([
      { userId: 'u1', userName: 'Ada', registeredAt: 100 },
      { userId: 'u2', userName: 'Bola', registeredAt: 200 },
      { userId: 'u3', userName: 'Chidi', registeredAt: 300 },
      { userId: 'u4', userName: 'Dapo', registeredAt: 400 },
    ]),
    createdAt: 100,
  };
  const pSooner: Programme = {
    id: 'prog_1111',
    fellowshipId: 'GIDEONITES',
    titleEn: 'Sunday Youth Alive',
    category: 'Youth Service', // legacy format compatibility
    venue: 'Youth Chapel',
    participantLimit: 200,
    startDateMillis: 1_750_000_000_000,
    createdAt: 200,
  };

  const sorted = sortProgrammesAscending([pLater, pSooner]);
  assert.equal(sorted[0].id, 'prog_1111');
  assert.equal(sorted[1].id, 'prog_9999');

  const youthOnly = filterProgrammesByEventCategory(sorted, 'YOUTH_SERVICE');
  assert.equal(youthOnly.length, 1);
  assert.equal(youthOnly[0].id, 'prog_1111');

  assert.equal(isUserRegisteredForProgramme(pLater, { id: 'u2' }), true);
  assert.equal(isUserRegisteredForProgramme(pLater, { id: 'other', userId: 'u3' }), true);
  assert.equal(formatRegistrantsSummary(parseJsonArray(pLater.registrationsJson, [])), 'Registered: Ada, Bola, Chidi +1 more');

  const reminders = buildReminderSchedule(1_800_000_000_000);
  assert.equal(reminders.fiveDaysBefore, 1_800_000_000_000 - 5 * DAY_MS);
  assert.equal(reminders.oneDayBefore, 1_800_000_000_000 - DAY_MS);

  const ics = buildProgrammeIcsContent(pLater, '#GID-9999-USR1');
  assert.match(ics, /TRIGGER:-P5D/);
  assert.match(ics, /TRIGGER:-P1D/);
  assert.match(ics, /#GID-9999-USR1/);

  const mailto = buildPassMailtoHref(pLater, 'Ada', 'ada@youthalive.org', '#GID-9999-USR1');
  assert.match(mailto, /^mailto:ada%40youthalive\.org/);
  assert.match(mailto, /%23GID-9999-USR1/);
});

test('Giving helpers format NGN decimals, generate CYP refs, and sum only COMPLETED/VERIFIED entries', () => {
  assert.equal(formatNGNDecimal(0), '₦0.00');
  assert.equal(formatNGNDecimal(12500.5), '₦12,500.50');

  const ref = generateGivingReference(1794795123456, 0.5);
  assert.equal(ref, 'CYP-123456-550');

  const ledger: GivingRecord[] = [
    {
      id: 'g1',
      fellowshipId: 'GIDEONITES',
      userId: 'u1',
      donorName: 'Peace',
      userName: 'Peace',
      category: 'TITHE',
      amountNgn: 10000,
      amount: 10000,
      referenceNote: 'Monthly',
      status: 'COMPLETED',
      createdAt: 1000,
    },
    {
      id: 'g2',
      fellowshipId: 'GIDEONITES',
      userId: 'u1',
      donorName: 'Peace',
      userName: 'Peace',
      category: 'PLEDGE',
      amountNgn: 25000,
      amount: 25000,
      referenceNote: 'Youth Camp Pledge',
      status: 'PLEDGED',
      createdAt: 2000,
    },
    {
      id: 'g3',
      fellowshipId: 'GIDEONITES',
      userId: 'u2',
      donorName: 'Bola',
      userName: 'Bola',
      category: 'OFFERING',
      amountNgn: 3500,
      amount: 3500,
      referenceNote: 'Sunday',
      status: 'VERIFIED',
      createdAt: 3000,
    },
  ];

  assert.equal(sumCompletedGiving(ledger), 13500);
  assert.equal(sumCompletedGiving(ledger, 'u1'), 10000);
  assert.equal(sumCompletedGiving(ledger, 'u2'), 3500);
});

test('CSV export builders, Firestore text chunking, Bible verse parser, approval status, and audit time formatter', () => {
  const financesCsv = buildFinancesCsv([
    {
      id: 'g1',
      fellowshipId: 'GIDEONITES',
      userId: 'u1',
      donorName: 'Peace',
      userName: 'Peace',
      category: 'TITHE',
      amountNgn: 5000,
      amount: 5000,
      paymentMethod: 'BANK_TRANSFER',
      referenceCode: 'CYP-123456-901',
      referenceNote: 'Opay #123',
      purposeOrNotes: 'Opay #123',
      status: 'COMPLETED',
      createdAt: 1_700_000_000_000,
    },
  ]);
  assert.match(financesCsv, /^Reference,User,Category,Amount,PaymentMethod,Status,Date,Notes/);
  assert.match(financesCsv, /CYP-123456-901,Peace,Tithe,5000,Bank Transfer,COMPLETED/);

  const attendanceCsv = buildAttendanceCsv([
    {
      id: 'a1',
      fellowshipId: 'GIDEONITES',
      userId: 'u1',
      userName: 'Admin',
      department: 'CHOIR',
      verificationCode: 'CYP-2026',
      serviceTitle: 'Sunday Youth Alive',
      meetingTitle: 'Sunday Youth Alive',
      totalAttendees: 48,
      maleCount: 22,
      femaleCount: 26,
      firstTimersCount: 4,
      checkedInBy: 'Admin',
      createdAt: 1_700_000_000_000,
    },
  ]);
  assert.match(attendanceCsv, /^MeetingTitle,Department,Date,TotalAttendees,Male,Female,FirstTimers,Notes/);
  assert.match(attendanceCsv, /Sunday Youth Alive,Choir & Music Ministry,.*,48,22,26,4/);

  const rosterCsv = buildRosterCsv([
    {
      id: 'user-admin-01',
      fellowshipId: 'GIDEONITES',
      fullName: 'Anything',
      email: 'admin@youthalive.org',
      phone: '+2348011223344',
      role: 'ADMINISTRATOR',
      status: 'APPROVED',
      department: 'GENERAL',
      preferredLanguage: 'EN',
      xpPoints: 120,
      createdAt: 1000,
    },
  ]);
  assert.match(rosterCsv, /^FullName,Email,Phone,Role,Status,Department,XP/);
  assert.match(rosterCsv, /Admin,admin@youthalive\.org,\+2348011223344,Admin,APPROVED/);

  const chunks = chunkStringForFirestore('A'.repeat(6500), 4, 3000);
  assert.equal(chunks.length, 4);
  assert.equal(chunks[0].length, 3000);
  assert.equal(chunks[1].length, 3000);
  assert.equal(chunks[2].length, 500);
  assert.equal(chunks[3], '');

  const lineVerses = parseLineOrJsonBibleVerses(
    'John 3:16 | For God so loved the world\n1 John 4:8 - God is love',
    'LINE',
    'KJV'
  );
  assert.equal(lineVerses.length, 2);
  assert.equal(lineVerses[0].reference, 'John 3:16');
  assert.equal(lineVerses[1].book, '1 John');

  const jsonVerses = parseLineOrJsonBibleVerses(
    JSON.stringify([{ book: 'Judges', chapter: 6, verse: 12, text: 'Thou mighty man of valour.' }]),
    'JSON',
    'NKJV'
  );
  assert.equal(jsonVerses.length, 1);
  assert.equal(jsonVerses[0].translation, 'NKJV');
  assert.equal(jsonVerses[0].reference, 'Judges 6:12');

  assert.equal(isPendingApprovalStatus('PENDING_APPROVAL'), true);
  assert.equal(isPendingApprovalStatus('PENDING'), true);
  assert.equal(isPendingApprovalStatus('APPROVED'), false);

  assert.match(formatAuditDateTime(1_700_000_000_000), /^[A-Z][a-z]{2} \d{2}, \d{2}:\d{2}$/);
});

test('isEventDatePassed keeps same-day events visible until midnight, expires yesterday events, and computes endOfDayMillis', () => {
  const nov20Midday = new Date(2026, 10, 20, 14, 30, 0, 0).getTime();
  const nov20Morning = new Date(2026, 10, 20, 9, 0, 0, 0).getTime();
  const nov19Late = new Date(2026, 10, 19, 23, 59, 0, 0).getTime();
  const nov21Morning = new Date(2026, 10, 21, 9, 0, 0, 0).getTime();

  assert.equal(startOfDayMillis(nov20Midday), new Date(2026, 10, 20, 0, 0, 0, 0).getTime());
  assert.equal(endOfDayMillis(nov20Morning), new Date(2026, 10, 20, 23, 59, 59, 999).getTime());
  assert.equal(computeProgrammeEndDateMillis(nov20Morning), endOfDayMillis(nov20Morning));

  assert.equal(isEventDatePassed(nov20Morning, nov20Midday), false);
  assert.equal(isEventDatePassed(nov19Late, nov20Midday), true);
  assert.equal(isEventDatePassed(nov21Morning, nov20Midday), false);

  const programmes: Programme[] = [
    {
      id: 'prog_past',
      fellowshipId: 'GIDEONITES',
      titleEn: 'Yesterday Event',
      category: 'YOUTH_SERVICE',
      venue: 'Hall',
      participantLimit: 50,
      startDateMillis: nov19Late,
      createdAt: nov19Late,
    },
    {
      id: 'prog_today',
      fellowshipId: 'GIDEONITES',
      titleEn: 'Today Event',
      category: 'YOUTH_SERVICE',
      venue: 'Hall',
      participantLimit: 50,
      startDateMillis: nov20Morning,
      createdAt: nov20Morning,
    },
  ];
  const active = filterActiveProgrammes(programmes, nov20Midday);
  assert.equal(active.length, 1);
  assert.equal(active[0].id, 'prog_today');
});

test('buildNewAccountFirestoreDoc enforces Android fellowship_accounts schema parity', () => {
  assert.equal(normalizeAccountRoleForFirestore('MEMBER'), 'YOUTH_MEMBER');
  assert.equal(normalizeAccountRoleForFirestore('EXECUTIVE'), 'YOUTH_EXECUTIVE');
  assert.equal(normalizeAccountRoleForFirestore('GUEST'), 'GUEST');
  assert.equal(normalizeLanguageForFirestore('YO'), 'yo');
  assert.equal(normalizeLanguageForFirestore('EN'), 'en');

  const doc = buildNewAccountFirestoreDoc({
    userId: 'user-test-123',
    fullName: '  Samuel Adeyemi  ',
    email: '  Samuel@Example.com ',
    phone: ' 08012345678 ',
    salt: 'salt123==',
    passwordHash: 'hash456=',
    role: 'EXECUTIVE',
    department: 'Media & Technical Team',
    preferredLanguage: 'YO',
    createdAt: 1000,
    updatedAt: 1000,
  });

  assert.equal(doc.userId, 'user-test-123');
  assert.equal(doc.fellowshipId, 'GIDEONITES');
  assert.equal(doc.fullName, 'Samuel Adeyemi');
  assert.equal(doc.email, 'samuel@example.com');
  assert.equal(doc.phone, '08012345678');
  assert.equal(doc.salt, 'salt123==');
  assert.equal(doc.passwordHash, 'hash456=');
  assert.equal(doc.role, 'YOUTH_EXECUTIVE');
  assert.equal(doc.status, 'PENDING');
  assert.equal(doc.department, 'MEDIA');
  assert.equal(doc.preferredLanguage, 'yo');
  assert.equal(doc.englishOverride, false);
  assert.equal(doc.xpPoints, 0);
  assert.equal('id' in doc, false);
  assert.equal('phoneNumber' in doc, false);
  assert.equal('password' in doc, false);
  assert.equal('passwordSalt' in doc, false);
  assert.equal('avatarUrl' in doc, false);
});

test('Church brand migration updates ECWA strings, Admin secretariat address, and guards write loops', () => {
  assert.equal(DEFAULT_MINISTRY_AUTHOR, 'Living Faith Church Youth Ministry');
  assert.equal(
    ADMIN_SECRETARIAT_ADDRESS,
    'Living Faith Church Youth Alive Fellowship Secretariat'
  );
  assert.equal(
    sanitizeChurchBrandText('ECWA Youth Hall, ecwa District'),
    'Living Faith Church Youth Hall, Living Faith Church District'
  );

  // Admin with blank address migrates to Living Faith Church Secretariat
  const adminBlank: FellowshipAccount = {
    id: 'user-admin-01',
    userId: 'user-admin-01',
    fellowshipId: 'GIDEONITES',
    fullName: 'Admin',
    email: 'admin@youthalive.org',
    role: 'ADMINISTRATOR',
    status: 'APPROVED',
    department: 'GENERAL',
    preferredLanguage: 'EN',
    createdAt: 1000,
  };
  const adminBlankMig = applyAccountBrandMigration(adminBlank);
  assert.equal(adminBlankMig.changed, true);
  assert.equal(adminBlankMig.account.address, ADMIN_SECRETARIAT_ADDRESS);

  // Admin already migrated -> changed: false (loop guard)
  const adminSecondPass = applyAccountBrandMigration(adminBlankMig.account);
  assert.equal(adminSecondPass.changed, false);

  // Admin with legacy ECWA address -> migrates cleanly
  const adminEcwa = resolveMigratedAccountAddress({
    id: 'other-id',
    email: 'admin@youthalive.org',
    role: 'ADMINISTRATOR',
    address: 'ECWA Youth Alive Fellowship Secretariat',
  });
  assert.equal(adminEcwa.changed, true);
  assert.equal(adminEcwa.address, ADMIN_SECRETARIAT_ADDRESS);

  // Member with ECWA in residential address -> sanitized cleanly
  const memberEcwa = resolveMigratedAccountAddress({
    id: 'user-member-1',
    email: 'member@youthalive.org',
    role: 'YOUTH_MEMBER',
    address: 'Behind ECWA Goodnews Church, Jos',
  });
  assert.equal(memberEcwa.changed, true);
  assert.equal(memberEcwa.address, 'Behind Living Faith Church Goodnews Church, Jos');

  // Member without ECWA -> untouched
  const memberClean = resolveMigratedAccountAddress({
    id: 'user-member-2',
    email: 'clean@youthalive.org',
    role: 'YOUTH_MEMBER',
    address: '14 Canaanland Way',
  });
  assert.equal(memberClean.changed, false);
});

test('Firebase config validation and client-offline connection classification behave cleanly', () => {
  assert.equal(
    isValidFirebaseClientConfig({
      projectId: 'gen-lang-client-0477394918',
      apiKey: 'AIzaSyTest',
      appId: '1:742042240421:web:487e',
    }),
    true
  );
  assert.equal(
    isValidFirebaseClientConfig({
      projectId: 'remixed-project-id',
      apiKey: 'AIzaSyTest',
      appId: '1:123',
    }),
    false
  );
  assert.equal(
    isValidFirebaseClientConfig({ projectId: '', apiKey: 'k', appId: 'a' }),
    false
  );

  const offlineErr = new Error('Failed to get document because the client is offline.');
  const permissionErr = Object.assign(new Error('Missing or insufficient permissions.'), {
    code: 'permission-denied',
  });

  assert.equal(isClientOfflineFirestoreError(offlineErr), true);
  assert.equal(isClientOfflineFirestoreError(permissionErr), false);

  assert.equal(
    classifyFirestoreConnectionCheckError({
      error: permissionErr,
      isNavigatorOnline: true,
      isConfigValid: true,
    }),
    'reachable'
  );
  assert.equal(
    classifyFirestoreConnectionCheckError({
      error: offlineErr,
      isNavigatorOnline: false,
      isConfigValid: true,
    }),
    'offline_expected'
  );
  assert.equal(
    classifyFirestoreConnectionCheckError({
      error: offlineErr,
      isNavigatorOnline: true,
      isConfigValid: true,
      isRetryAttempt: false,
    }),
    'retry_network'
  );
  assert.equal(
    classifyFirestoreConnectionCheckError({
      error: offlineErr,
      isNavigatorOnline: true,
      isConfigValid: true,
      isRetryAttempt: true,
    }),
    'offline_expected'
  );
  assert.equal(
    classifyFirestoreConnectionCheckError({
      error: offlineErr,
      isNavigatorOnline: true,
      isConfigValid: false,
    }),
    'invalid_config'
  );

  assert.match(
    formatActionErrorMessage(offlineErr),
    /offline or on an unstable network/i
  );
});


