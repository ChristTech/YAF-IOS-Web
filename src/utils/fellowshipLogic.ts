import { SCRIPTURE_OF_THE_DAY_PRESETS } from '../data/bibleData';
import type {
  AttendanceRecord,
  CommunityPost,
  DailyScriptureDoc,
  DepartmentType,
  EventCategory,
  ExecutiveInquiry,
  FellowshipAccount,
  GivingRecord,
  InquiryStatus,
  LanguageCode,
  PostComment,
  Programme,
  ProgrammeCategory,
  ProgrammeRegistration,
  QuizQuestion,
} from '../types/fellowship';

export const DAY_MS = 24 * 60 * 60 * 1000;
export const FIVE_DAYS_MS = 5 * DAY_MS;
export const WORK_SKILLS_TTL_MS = 3 * DAY_MS;
export const FORUM_POST_TTL_MS = 7 * DAY_MS;

export interface EventCategoryMeta {
  value: EventCategory;
  label: string;
}

export const EVENT_CATEGORY_ITEMS: EventCategoryMeta[] = [
  { value: 'YOUTH_SERVICE', label: 'Youth Service' },
  { value: 'WORKSHOP', label: 'Skills & Workshop' },
  { value: 'RETREAT', label: 'Spiritual Retreat' },
  { value: 'SOCIAL', label: 'Social & Hangout' },
  { value: 'OUTREACH', label: 'Evangelism & Outreach' },
  { value: 'BIBLE_STUDY', label: 'Bible Study' },
  { value: 'PRAYER_MEETING', label: 'Prayer Meeting' },
];

export function normalizeEventCategory(raw?: string | null): EventCategory {
  const clean = (raw || '').trim().toUpperCase();
  switch (clean) {
    case 'YOUTH_SERVICE':
    case 'YOUTH SERVICE':
      return 'YOUTH_SERVICE';
    case 'WORKSHOP':
    case 'SKILLS & WORKSHOP':
    case 'SKILLS_AND_WORKSHOP':
      return 'WORKSHOP';
    case 'RETREAT':
    case 'SPIRITUAL RETREAT':
      return 'RETREAT';
    case 'SOCIAL':
    case 'SOCIAL & HANGOUT':
      return 'SOCIAL';
    case 'OUTREACH':
    case 'EVANGELISM & OUTREACH':
      return 'OUTREACH';
    case 'BIBLE_STUDY':
    case 'BIBLE STUDY':
      return 'BIBLE_STUDY';
    case 'PRAYER_MEETING':
    case 'PRAYER MEETING':
      return 'PRAYER_MEETING';
    default:
      return 'YOUTH_SERVICE';
  }
}

export function getEventCategoryLabel(raw?: string | null): string {
  const normalized = normalizeEventCategory(raw);
  const found = EVENT_CATEGORY_ITEMS.find((item) => item.value === normalized);
  return found ? found.label : 'Youth Service';
}

export function parseJsonArray<T>(jsonStr: string | undefined | null, fallback: T[] = []): T[] {
  if (!jsonStr || typeof jsonStr !== 'string') return fallback;
  try {
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

export function filterActiveAccounts(accounts: FellowshipAccount[]): FellowshipAccount[] {
  return accounts.filter((acc) => acc.status !== 'PURGED');
}

export const MAX_COMMENTS_JSON_CHARS = 340_000;
export const MAX_ATTACHMENT_DATA_URL_CHARS = 260_000;

export function isAnnouncementCategory(category?: string | null): boolean {
  return (category || '').trim().toUpperCase().startsWith('ANNOUNCEMENT');
}

export function isWorkSkillsCategory(category?: string | null): boolean {
  const clean = (category || '').trim().toLowerCase();
  return (
    clean === 'work/skills' ||
    clean === 'work & skills' ||
    clean === 'work_skills' ||
    clean === 'spiritual growth'
  );
}

export function normalizeForumCategory(raw?: string | null): string {
  const clean = (raw || '').trim();
  const lower = clean.toLowerCase();
  if (!clean) return 'Discussion';
  if (lower === 'faith & career' || lower === 'discussion') return 'Discussion';
  if (lower === 'spiritual growth' || lower === 'work/skills' || lower === 'work & skills' || lower === 'work_skills') {
    return 'Work/Skills';
  }
  if (lower === 'testimonies' || lower === 'testimony') return 'Testimonies';
  if (lower === 'prayer requests' || lower === 'prayer request') return 'Prayer Requests';
  if (lower === 'q&a' || lower === 'q & a' || lower === 'questions') return 'Q&A';
  return clean;
}

export function isTuesdayDate(dateOrMs: Date | number = Date.now()): boolean {
  const d = typeof dateOrMs === 'number' ? new Date(dateOrMs) : dateOrMs;
  return d.getDay() === 2;
}

export function isForumPostExpired(post: Pick<CommunityPost, 'category' | 'createdAt'>, nowMs: number): boolean {
  if (isAnnouncementCategory(post.category)) {
    return false;
  }
  const age = nowMs - (post.createdAt || 0);
  if (isWorkSkillsCategory(post.category)) {
    return age > WORK_SKILLS_TTL_MS;
  }
  return age > FORUM_POST_TTL_MS;
}

export function getPostExpiryDaysRemaining(
  post: Pick<CommunityPost, 'category' | 'createdAt'>,
  nowMs: number
): number | null {
  if (isAnnouncementCategory(post.category)) {
    return null;
  }
  const ttl = isWorkSkillsCategory(post.category) ? WORK_SKILLS_TTL_MS : FORUM_POST_TTL_MS;
  const remaining = ttl - (nowMs - (post.createdAt || 0));
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / DAY_MS);
}

export function getPostContact(post: Pick<CommunityPost, 'whatsappContact' | 'whatsappNumber'>): string {
  return (post.whatsappContact || post.whatsappNumber || '').trim();
}

export function getPostPhoto(post: Pick<CommunityPost, 'attachmentPhotoUri' | 'photoUrl'>): string {
  return (post.attachmentPhotoUri || post.photoUrl || '').trim();
}

export function getPostCommentsCount(post: Pick<CommunityPost, 'commentsCount' | 'commentsJson'>): number {
  const parsed = parseJsonArray<PostComment>(post.commentsJson, []);
  if (typeof post.commentsCount === 'number' && post.commentsCount >= 0) {
    return Math.max(post.commentsCount, parsed.length);
  }
  return parsed.length;
}

export function filterAndSortForumPosts(
  posts: CommunityPost[],
  options: {
    nowMs?: number;
    filterChip?: string;
    searchQuery?: string;
    isLeadership?: boolean;
  } = {}
): CommunityPost[] {
  const nowMs = options.nowMs ?? Date.now();
  const chip = (options.filterChip || 'All').trim();
  const q = (options.searchQuery || '').trim().toLowerCase();

  return posts
    .filter((p) => p.isHidden !== true)
    .filter((p) => !isAnnouncementCategory(p.category))
    .filter((p) => !isForumPostExpired(p, nowMs))
    .filter((p) => {
      const cat = normalizeForumCategory(p.category);
      if (chip === 'All') return true;
      if (chip === 'Pinned') return p.isPinned === true;
      if (chip === 'Flagged') return options.isLeadership ? p.isFlagged === true : false;
      return cat === chip;
    })
    .filter((p) => {
      if (!q) return true;
      const cat = normalizeForumCategory(p.category).toLowerCase();
      const contact = getPostContact(p).toLowerCase();
      return (
        (p.title || '').toLowerCase().includes(q) ||
        (p.content || '').toLowerCase().includes(q) ||
        (p.authorName || '').toLowerCase().includes(q) ||
        cat.includes(q) ||
        contact.includes(q)
      );
    })
    .sort((a, b) => {
      const pinDiff = (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0);
      if (pinDiff !== 0) return pinDiff;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
}

export function buildWhatsAppChatUrl(contactRaw: string, postTitleOrSnippet?: string): string {
  const trimmed = (contactRaw || '').trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  if (/^(wa\.me|chat\.whatsapp\.com)\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = `234${digits.slice(1)}`;
  }
  const ref = (postTitleOrSnippet || 'your post').trim().slice(0, 80);
  const greeting = `Hello from The Gideonites Youth Forum regarding "${ref}"`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(greeting)}`;
}

export function serializeCommentsWithinLimit(
  comments: PostComment[],
  maxChars: number = MAX_COMMENTS_JSON_CHARS
): string {
  let json = JSON.stringify(comments);
  if (json.length <= maxChars) return json;

  const strippedAvatars = comments.map(({ authorAvatarUri: _drop, ...rest }) => rest);
  json = JSON.stringify(strippedAvatars);
  if (json.length <= maxChars) return json;

  const trimmed = [...strippedAvatars];
  while (trimmed.length > 1 && JSON.stringify(trimmed).length > maxChars) {
    trimmed.shift();
  }
  return JSON.stringify(trimmed);
}

export function normalizeInquiryStatus(status?: InquiryStatus | string | null): 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' {
  const upper = (status || '').trim().toUpperCase();
  if (upper === 'RESOLVED' || upper === 'ANSWERED') return 'RESOLVED';
  if (upper === 'IN_PROGRESS' || upper === 'IN PROGRESS') return 'IN_PROGRESS';
  return 'PENDING';
}

export function getInquiryTopic(inq: Pick<ExecutiveInquiry, 'topic' | 'subject'>): string {
  return (inq.topic || inq.subject || 'Youth Inquiry').trim();
}

export function getInquiryMessage(inq: Pick<ExecutiveInquiry, 'message' | 'question'>): string {
  return (inq.message || inq.question || '').trim();
}

export function getInquiryResponse(inq: Pick<ExecutiveInquiry, 'responseMessage' | 'response'>): string {
  return (inq.responseMessage || inq.response || '').trim();
}

export function normalizeDepartmentType(raw?: string | null): DepartmentType {
  const upper = (raw || '').trim().toUpperCase();
  if (!upper) return 'GENERAL';
  if (upper === 'CHOIR' || upper.includes('CHOIR') || upper.includes('MUSIC')) return 'CHOIR';
  if (upper === 'DRAMA' || upper.includes('DRAMA') || upper.includes('CREATIVE')) return 'DRAMA';
  if (upper === 'MEDIA' || upper.includes('MEDIA') || upper.includes('TECHNICAL')) return 'MEDIA';
  if (upper === 'PRAYER' || upper.includes('PRAYER') || upper.includes('INTERCESSION')) return 'PRAYER';
  if (upper === 'SPORTS' || upper.includes('SPORT') || upper.includes('RECREATION')) return 'SPORTS';
  if (upper === 'USHERING' || upper.includes('USHER') || upper.includes('PROTOCOL')) return 'USHERING';
  if (upper === 'HOSPITALITY' || upper.includes('HOSPITALITY') || upper.includes('WELFARE')) return 'HOSPITALITY';
  return 'GENERAL';
}

export function getDepartmentDisplayName(raw?: string | null): string {
  const type = normalizeDepartmentType(raw);
  switch (type) {
    case 'CHOIR':
      return 'Choir & Music Ministry';
    case 'DRAMA':
      return 'Drama & Creative Arts';
    case 'MEDIA':
      return 'Media & Technical Team';
    case 'PRAYER':
      return 'Prayer & Intercession Unit';
    case 'SPORTS':
      return 'Sports & Recreation Unit';
    case 'USHERING':
      return 'Ushering & Protocol';
    case 'HOSPITALITY':
      return 'Hospitality & Welfare';
    default:
      return (raw || '').trim() || 'General Fellowship';
  }
}

export function generateQrPassCode(randomZeroToOne: number = Math.random()): string {
  const num = Math.min(9999, Math.max(1000, Math.floor(1000 + randomZeroToOne * 9000)));
  return `CYP-${num}`;
}

export function generate16CharId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  }
  const part1 = Date.now().toString(36);
  const part2 = Math.random().toString(36).slice(2, 12);
  return `${part1}${part2}`.slice(0, 16).padEnd(16, '0');
}

export function formatShortDateTime(timestampMs: number): string {
  const d = new Date(timestampMs || Date.now());
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleDateString('en-US', { month: 'short' });
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${day} ${month}, ${time}`;
}

export function formatTimeOnly(timestampMs: number): string {
  const d = new Date(timestampMs || Date.now());
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function getAttendanceTotalCount(records: AttendanceRecord[]): number {
  return records.reduce((sum, rec) => {
    const count =
      typeof rec.totalAttendees === 'number' && rec.totalAttendees > 0
        ? rec.totalAttendees
        : (rec.maleCount || 0) + (rec.femaleCount || 0) > 0
        ? (rec.maleCount || 0) + (rec.femaleCount || 0)
        : 1;
    return sum + count;
  }, 0);
}

export function getProgrammeTitle(p: Pick<Programme, 'titleEn' | 'title'>): string {
  return (p.titleEn || p.title || 'Youth Alive Programme').trim();
}

export function getProgrammeDescription(p: Pick<Programme, 'descriptionEn' | 'description'>): string {
  return (p.descriptionEn || p.description || '').trim();
}

export function getProgrammeSpeaker(p: Pick<Programme, 'speaker' | 'minister'>): string {
  return (p.speaker || p.minister || '').trim();
}

export function getProgrammeLimit(p: Pick<Programme, 'participantLimit' | 'capacity'>): number {
  const raw = p.participantLimit ?? p.capacity ?? 0;
  return Number.isFinite(raw) ? Math.max(0, Number(raw)) : 0;
}

export function getProgrammeStartMillis(
  p: Pick<Programme, 'startDateMillis' | 'timestamp' | 'createdAt'>
): number {
  if (typeof p.startDateMillis === 'number' && p.startDateMillis > 0) return p.startDateMillis;
  if (typeof p.timestamp === 'number' && p.timestamp > 0) return p.timestamp;
  return p.createdAt || Date.now();
}

export function startOfDayMillis(nowMs: number = Date.now()): number {
  const d = new Date(nowMs);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfDayMillis(dateMillis: number): number {
  const d = new Date(dateMillis);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function isEventDatePassed(
  eventDateTimeMillis: number,
  nowMs: number = Date.now()
): boolean {
  if (!Number.isFinite(eventDateTimeMillis) || eventDateTimeMillis <= 0) {
    return false;
  }
  return eventDateTimeMillis < startOfDayMillis(nowMs);
}

export function computeProgrammeEndDateMillis(startDateMillis: number): number {
  return Math.max(startDateMillis, endOfDayMillis(startDateMillis));
}

export function filterActiveProgrammes(
  programmes: Programme[],
  nowMs: number = Date.now()
): Programme[] {
  return programmes.filter((p) => !isEventDatePassed(getProgrammeStartMillis(p), nowMs));
}

export function sortProgrammesAscending(programmes: Programme[]): Programme[] {
  return [...programmes].sort((a, b) => getProgrammeStartMillis(a) - getProgrammeStartMillis(b));
}

export function filterProgrammesByCategory(
  programmes: Programme[],
  category: ProgrammeCategory | null
): Programme[] {
  if (!category || category === 'All') return programmes;
  const target = normalizeEventCategory(category);
  return programmes.filter((p) => normalizeEventCategory(p.category) === target);
}

export function filterProgrammesByEventCategory(
  programmes: Programme[],
  category: EventCategory | null
): Programme[] {
  if (!category) return programmes;
  return programmes.filter((p) => normalizeEventCategory(p.category) === category);
}

export function getProgrammeRegistrations(programme: Pick<Programme, 'registrationsJson'>): ProgrammeRegistration[] {
  return parseJsonArray<ProgrammeRegistration>(programme.registrationsJson, []);
}

export function getProgrammeRegisteredCount(
  programme: Pick<Programme, 'registeredCount' | 'registrationsJson'>,
  regs?: ProgrammeRegistration[]
): number {
  const list = regs ?? getProgrammeRegistrations(programme);
  return Math.max(programme.registeredCount || 0, list.length);
}

export function getRegistrationAttendeeName(reg: ProgrammeRegistration): string {
  return (reg.userName || reg.fullName || 'Kingdom Giant').trim();
}

export function isUserRegisteredForProgramme(
  programme: Pick<Programme, 'registrationsJson'>,
  account: Pick<FellowshipAccount, 'id' | 'userId'>
): boolean {
  const regs = getProgrammeRegistrations(programme);
  const candidateIds = new Set([account.id, account.userId].filter(Boolean) as string[]);
  return regs.some((r) => candidateIds.has(r.userId));
}

export function formatRegistrantsSummary(regs: ProgrammeRegistration[]): string {
  if (regs.length === 0) return '';
  const names = regs.slice(0, 3).map(getRegistrationAttendeeName);
  const remaining = regs.length - 3;
  return remaining > 0 ? `Registered: ${names.join(', ')} +${remaining} more` : `Registered: ${names.join(', ')}`;
}

export function calculateRegistrationProgress(
  registrationsCount: number,
  capacity: number
): { percentage: number; spotsLeft: number; isFull: boolean } {
  if (!capacity || capacity <= 0) {
    return {
      percentage: registrationsCount > 0 ? Math.min(100, registrationsCount * 10) : 0,
      spotsLeft: 999,
      isFull: false,
    };
  }
  const safeCap = Math.max(1, capacity);
  const rawPct = Math.round((Math.max(0, registrationsCount) / safeCap) * 100);
  const percentage = Math.min(100, rawPct);
  const spotsLeft = Math.max(0, safeCap - registrationsCount);
  return {
    percentage,
    spotsLeft,
    isFull: registrationsCount >= safeCap,
  };
}

export function generatePassCode(userId: string, programmeId: string): string {
  const combined = `${userId}-${programmeId}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash * 31 + combined.charCodeAt(i)) >>> 0;
  }
  const code = (hash % 900000) + 100000;
  return `GID-${code}`;
}

export function generateOfficialPassCode(eventId: string, userId: string): string {
  const cleanEvent = (eventId || 'EVT0').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const cleanUser = (userId || 'USR0').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const part1 = (cleanEvent.slice(-4) || cleanEvent).padStart(4, '0').slice(0, 4);
  const part2 = (cleanUser.slice(-4) || cleanUser).padStart(4, '0').slice(0, 4);
  return `#GID-${part1}-${part2}`;
}

export function buildReminderSchedule(startDateMillis: number): {
  fiveDaysBefore: number;
  oneDayBefore: number;
} {
  return {
    fiveDaysBefore: startDateMillis - FIVE_DAYS_MS,
    oneDayBefore: startDateMillis - DAY_MS,
  };
}

export function formatBadgeMonthDay(startDateMillis: number): { month: string; day: string } {
  const d = new Date(startDateMillis);
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = String(d.getDate()).padStart(2, '0');
  return { month, day };
}

export function formatProgrammeFullDateTime(startDateMillis: number): string {
  const d = new Date(startDateMillis);
  const datePart = d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: '2-digit',
    year: 'numeric',
  });
  const timePart = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${datePart} • ${timePart}`;
}

export function formatReminderDate(timestampMillis: number): string {
  const d = new Date(timestampMillis);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

function toIcsUtcString(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    d.getUTCFullYear() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  );
}

export function buildProgrammeCalendarUrl(programme: Programme): string {
  const startMs = getProgrammeStartMillis(programme);
  const endMs = programme.endDateMillis && programme.endDateMillis > startMs ? programme.endDateMillis : startMs + 7_200_000;
  const title = getProgrammeTitle(programme);
  const desc = getProgrammeDescription(programme) || 'The Gideonites - The Youth Alive Fellowship Programme';
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${title} • The Gideonites`,
    dates: `${toIcsUtcString(startMs)}/${toIcsUtcString(endMs)}`,
    location: programme.venue || 'Youth Alive Sanctuary',
    details: desc,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildProgrammeIcsContent(programme: Programme, passCode?: string): string {
  const startMs = getProgrammeStartMillis(programme);
  const endMs = programme.endDateMillis && programme.endDateMillis > startMs ? programme.endDateMillis : startMs + 7_200_000;
  const title = getProgrammeTitle(programme);
  const summary = `${title} • The Gideonites`;
  const descLines = [
    getProgrammeDescription(programme) || 'The Gideonites - The Youth Alive Fellowship Programme',
    passCode ? `Official Pass: ${passCode}` : '',
    programme.contactPerson ? `Coordinator: ${programme.contactPerson}` : '',
  ]
    .filter(Boolean)
    .join('\\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//The Gideonites//Youth Alive Fellowship//EN',
    'BEGIN:VEVENT',
    `UID:${programme.id}@gideonites.youthalive.org`,
    `DTSTAMP:${toIcsUtcString(Date.now())}`,
    `DTSTART:${toIcsUtcString(startMs)}`,
    `DTEND:${toIcsUtcString(endMs)}`,
    `SUMMARY:${summary}`,
    `LOCATION:${programme.venue || ''}`,
    `DESCRIPTION:${descLines}`,
    'BEGIN:VALARM',
    'TRIGGER:-P5D',
    'ACTION:DISPLAY',
    `DESCRIPTION:5-Day Reminder: ${summary}`,
    'END:VALARM',
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:1-Day Reminder: ${summary}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

export function buildPassMailtoHref(
  programme: Programme,
  attendeeName: string,
  attendeeEmail: string,
  passCode: string
): string {
  const title = getProgrammeTitle(programme);
  const startMs = getProgrammeStartMillis(programme);
  const when = formatProgrammeFullDateTime(startMs);
  const { fiveDaysBefore, oneDayBefore } = buildReminderSchedule(startMs);

  const subject = `Official Programme Pass: ${title} (${passCode})`;
  const body = [
    `The Gideonites - The Youth Alive Fellowship`,
    `OFFICIAL PROGRAMME PASS`,
    ``,
    `Pass Code: ${passCode}`,
    `Programme: ${title}`,
    `Category: ${getEventCategoryLabel(programme.category)}`,
    `Date & Time: ${when}`,
    `Venue: ${programme.venue}`,
    `Attendee: ${attendeeName}`,
    `Email: ${attendeeEmail}`,
    ``,
    `Automated Reminder Schedule:`,
    `- 5 Days Before: ${formatReminderDate(fiveDaysBefore)}`,
    `- 1 Day Before: ${formatReminderDate(oneDayBefore)}`,
  ].join('\n');

  return `mailto:${encodeURIComponent(attendeeEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export interface NormalizedDailyScripture {
  id: string;
  reference: string;
  verseText: string;
  chargeText: string;
  authorName: string;
  publishedAt: number;
}

export function localizeBuiltInVerse(
  reference: string,
  verseTextEn: string,
  language: LanguageCode,
  doc?: Pick<DailyScriptureDoc, 'verseTextYo' | 'verseTextHa' | 'verseTextIg'>
): string {
  if (language === 'YO' && doc?.verseTextYo) return doc.verseTextYo;
  if (language === 'HA' && doc?.verseTextHa) return doc.verseTextHa;
  if (language === 'IG' && doc?.verseTextIg) return doc.verseTextIg;

  const cleanRef = reference.trim().toLowerCase();
  const preset = SCRIPTURE_OF_THE_DAY_PRESETS.find((p) => {
    const pRef = p.reference.toLowerCase();
    return cleanRef === pRef || cleanRef.startsWith(pRef.replace(/b$/, ''));
  });
  if (preset) {
    return preset.translations[language] || preset.translations.EN;
  }
  return verseTextEn;
}

export function extractScriptureOfTheDay(
  docs: DailyScriptureDoc[],
  language: LanguageCode = 'EN'
): NormalizedDailyScripture {
  const candidates: { doc: DailyScriptureDoc; sortTime: number; verse: string; charge: string }[] = [];

  for (const d of docs) {
    if (!d.id) continue;
    if (
      d.id.startsWith('scripture_bibledoc_') ||
      d.id.startsWith('scripture_biblepack_') ||
      d.dateKey === 'BIBLE_EDITION' ||
      d.dateKey === 'BIBLE_PACK' ||
      d.type === 'BIBLE_DOC'
    ) {
      continue;
    }
    if (d.type === 'SERMON' || d.type === 'DEVOTIONAL' || d.type === 'BIBLE_STUDY' || d.id.startsWith('scripture_res_')) {
      continue;
    }

    let sortTime = d.createdAt || 0;
    let parsedJson: Record<string, unknown> | null = null;
    const rawPrompt = (d.prayerPromptEn || '').trim();
    if (rawPrompt.startsWith('{')) {
      try {
        parsedJson = JSON.parse(rawPrompt) as Record<string, unknown>;
      } catch {
        parsedJson = null;
      }
    }

    if (parsedJson) {
      const cat = String(parsedJson.category || '');
      const kind = String(parsedJson.kind || '');
      if (
        kind === 'SERMON' ||
        kind === 'DEVOTIONAL' ||
        kind === 'BIBLE_STUDY' ||
        kind === 'PRAYER_POINTS' ||
        cat === 'BIBLE_DOCUMENT' ||
        cat === 'BIBLE_VERSE_PACK'
      ) {
        continue;
      }
      if (cat && cat !== 'SCRIPTURE_OF_THE_DAY') {
        continue;
      }
      if (typeof parsedJson.publishedAt === 'number' && parsedJson.publishedAt > 0) {
        sortTime = parsedJson.publishedAt;
      }
    }

    const baseVerse = (d.verseTextEn || d.verseText || (parsedJson?.summary as string) || '').trim();
    const rawReflection = (d.reflectionEn || d.chargeEn || '').trim();
    let charge = '';
    if (rawReflection.includes('Gideonites Youth Charge:')) {
      charge = rawReflection.split('Gideonites Youth Charge:')[1]?.trim() || '';
    } else if (rawReflection && rawReflection !== baseVerse) {
      charge = rawReflection;
    }

    candidates.push({
      doc: d,
      sortTime,
      verse: baseVerse,
      charge,
    });
  }

  candidates.sort((a, b) => b.sortTime - a.sortTime);

  if (candidates.length === 0) {
    return {
      id: 'fallback-judges-6-12',
      reference: 'Judges 6:12',
      verseText: localizeBuiltInVerse('Judges 6:12', 'The LORD is with thee, thou mighty man of valour.', language),
      chargeText: 'Rise as mighty Gideonites today and do Kingdom exploits!',
      authorName: 'Youth Pastor / Admin',
      publishedAt: 0,
    };
  }

  const latest = candidates[0];
  const ref = (latest.doc.referenceEn || latest.doc.reference || 'Judges 6:12').trim();
  const baseVerse = latest.verse || 'The LORD is with thee, thou mighty man of valour.';

  return {
    id: latest.doc.id,
    reference: ref,
    verseText: localizeBuiltInVerse(ref, baseVerse, language, latest.doc),
    chargeText: latest.charge,
    authorName: (latest.doc.authorName || 'Youth Pastor / Admin').trim(),
    publishedAt: latest.sortTime,
  };
}

export function formatNGN(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `₦${safe.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export function formatNGNDecimal(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `₦${safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const GIVING_CATEGORIES = [
  { value: 'TITHE', displayName: 'Tithe' },
  { value: 'OFFERING', displayName: 'Offering' },
  { value: 'PLEDGE', displayName: 'Faith Pledge' },
  { value: 'SPECIAL_PROJECT', displayName: 'Special Project' },
  { value: 'DUES', displayName: 'Fellowship Dues' },
  { value: 'DONATION', displayName: 'Donation' },
] as const;

export const PAYMENT_METHODS = [
  { value: 'BANK_TRANSFER', displayName: 'Bank Transfer' },
  { value: 'DEBIT_CARD', displayName: 'Debit Card' },
  { value: 'CASH', displayName: 'Cash' },
  { value: 'USSD', displayName: 'USSD' },
] as const;

export function getGivingCategoryLabel(raw?: string | null): string {
  const clean = (raw || '').trim();
  const upper = clean.toUpperCase();
  const match = GIVING_CATEGORIES.find((c) => c.value === upper);
  if (match) return match.displayName;
  if (upper === 'WELFARE SEED') return 'Welfare Seed';
  return clean || 'Offering';
}

export function getPaymentMethodLabel(raw?: string | null): string {
  const clean = (raw || '').trim();
  const upper = clean.toUpperCase();
  const match = PAYMENT_METHODS.find((m) => m.value === upper);
  return match ? match.displayName : clean || 'Bank Transfer';
}

export function generateGivingReference(
  nowMs: number = Date.now(),
  randomZeroToOne: number = Math.random()
): string {
  const tsPart = String(nowMs).slice(-6).padStart(6, '0');
  const randPart = Math.min(999, Math.max(100, Math.floor(100 + randomZeroToOne * 900)));
  return `CYP-${tsPart}-${randPart}`;
}

export function sumGivingRecords(records: GivingRecord[]): number {
  return records.reduce((sum, item) => sum + (Number(item.amount ?? item.amountNgn) || 0), 0);
}

export function sumCompletedGiving(records: GivingRecord[], userId?: string): number {
  return records.reduce((sum, item) => {
    if (userId && item.userId !== userId) return sum;
    const status = (item.status || '').toUpperCase();
    if (status === 'COMPLETED' || status === 'VERIFIED') {
      return sum + (Number(item.amount ?? item.amountNgn) || 0);
    }
    return sum;
  }, 0);
}

export function formatGivingDate(timestampMs: number): string {
  const d = new Date(timestampMs || Date.now());
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

export function formatAuditDateTime(timestampMs: number): string {
  const d = new Date(timestampMs || Date.now());
  const datePart = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${datePart}, ${hours}:${mins}`;
}

export function formatRelativeTime(timestampMs: number, nowMs: number = Date.now()): string {
  const diffSec = Math.max(0, Math.floor((nowMs - timestampMs) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(timestampMs).toLocaleDateString('en-NG', {
    month: 'short',
    day: 'numeric',
  });
}

export function scrambleWord(word: string, seedIndex = 0): string {
  const upper = word.trim().toUpperCase();
  if (upper.length <= 2) return upper;
  const chars = upper.split('');
  for (let i = chars.length - 1; i > 0; i--) {
    const j = (i * 7 + seedIndex * 3 + 1) % (i + 1);
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }
  const result = chars.join('');
  if (result === upper) {
    return chars.slice(1).concat(chars[0]).join('');
  }
  return result;
}

export function evaluateQuizAnswer(question: QuizQuestion, selectedIndex: number): boolean {
  return question.correctIndex === selectedIndex;
}

export function buildCsvContent(headers: string[], rows: (string | number | boolean)[][]): string {
  const escape = (val: string | number | boolean) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  return [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
}

export function buildFinancesCsv(records: GivingRecord[]): string {
  return buildCsvContent(
    ['Reference', 'User', 'Category', 'Amount', 'PaymentMethod', 'Status', 'Date', 'Notes'],
    records.map((g) => [
      g.referenceCode || g.id,
      g.userName || g.donorName || 'Member',
      getGivingCategoryLabel(g.category),
      Number(g.amount ?? g.amountNgn) || 0,
      getPaymentMethodLabel(g.paymentMethod),
      g.status,
      new Date(g.createdAt).toISOString(),
      g.purposeOrNotes || g.referenceNote || '',
    ])
  );
}

export function buildAttendanceCsv(records: AttendanceRecord[]): string {
  return buildCsvContent(
    ['MeetingTitle', 'Department', 'Date', 'TotalAttendees', 'Male', 'Female', 'FirstTimers', 'Notes'],
    records.map((a) => [
      a.meetingTitle || a.serviceTitle,
      getDepartmentDisplayName(a.department),
      new Date(a.createdAt).toISOString(),
      a.totalAttendees ?? ((a.maleCount || 0) + (a.femaleCount || 0) || 1),
      a.maleCount ?? 0,
      a.femaleCount ?? 0,
      a.firstTimersCount ?? 0,
      a.notes || `Code: ${a.verificationCode} · By: ${a.checkedInBy}`,
    ])
  );
}

export function buildRosterCsv(accounts: FellowshipAccount[]): string {
  return buildCsvContent(
    ['FullName', 'Email', 'Phone', 'Role', 'Status', 'Department', 'XP'],
    accounts.map((a) => [
      getDisplayNameForAccount(a),
      a.email,
      a.phone || a.phoneNumber || '',
      getRoleLabel(a.role),
      a.status,
      getDepartmentDisplayName(a.department),
      a.xpPoints ?? 0,
    ])
  );
}

export function chunkStringForFirestore(
  text: string,
  maxChunks = 4,
  chunkSize = 3000
): string[] {
  const clean = text || '';
  const result: string[] = [];
  for (let i = 0; i < maxChunks; i++) {
    result.push(clean.slice(i * chunkSize, (i + 1) * chunkSize));
  }
  return result;
}

export interface ParsedBibleVerse {
  reference: string;
  book: string;
  chapter: number;
  verse: number;
  text: string;
  translation: string;
  theme?: string;
}

export function parseLineOrJsonBibleVerses(
  rawText: string,
  mode: 'LINE' | 'JSON',
  translation = 'KJV'
): ParsedBibleVerse[] {
  const clean = rawText.trim();
  if (!clean) return [];

  if (mode === 'JSON') {
    try {
      const parsed = JSON.parse(clean) as unknown;
      const arr = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object' && Array.isArray((parsed as Record<string, unknown>).verses)
        ? ((parsed as Record<string, unknown>).verses as unknown[])
        : [];
      return arr
        .map((item) => {
          const obj = item as Record<string, unknown>;
          const book = String(obj.book || obj.bookName || 'Genesis').trim();
          const chapter = Number(obj.chapter) || 1;
          const verse = Number(obj.verse) || 1;
          const text = String(obj.text || obj.verseText || obj.v || '').trim();
          const reference = String(obj.reference || obj.r || `${book} ${chapter}:${verse}`).trim();
          const themeVal = String(obj.theme || obj.m || '').trim();
          return {
            reference,
            book,
            chapter,
            verse,
            text,
            translation: String(obj.translation || obj.t || translation),
            ...(themeVal ? { theme: themeVal } : {}),
          };
        })
        .filter((v) => v.text.length > 0);
    } catch {
      return [];
    }
  }

  const lines = clean.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const verses: ParsedBibleVerse[] = [];
  const lineRegex = /^([1-3]?\s*[A-Za-z]+(?:\s+[A-Za-z]+)*)\s+(\d+):(\d+)\s*[|–—:-]?\s*(.+)$/;
  const refParseRegex = /^([1-3]?\s*[A-Za-z]+(?:\s+[A-Za-z]+)*)\s+(\d+):(\d+)/;

  for (const line of lines) {
    if (line.includes('|')) {
      const parts = line.split('|').map((p) => p.trim());
      if (parts.length >= 2 && parts[0] && parts[1]) {
        const refMatch = parts[0].match(refParseRegex);
        if (refMatch) {
          const book = refMatch[1].trim();
          const chapter = Number(refMatch[2]) || 1;
          const verse = Number(refMatch[3]) || 1;
          const text = parts[1];
          const lineTrans = parts[2] || translation;
          const lineTheme = parts[3] || undefined;
          verses.push({
            reference: parts[0],
            book,
            chapter,
            verse,
            text,
            translation: lineTrans,
            ...(lineTheme ? { theme: lineTheme } : {}),
          });
          continue;
        }
      }
    }

    const match = line.match(lineRegex);
    if (match) {
      const book = match[1].trim();
      const chapter = Number(match[2]) || 1;
      const verse = Number(match[3]) || 1;
      const text = match[4].replace(/^\|/, '').trim();
      if (text) {
        verses.push({
          reference: `${book} ${chapter}:${verse}`,
          book,
          chapter,
          verse,
          text,
          translation,
        });
      }
    }
  }
  return verses;
}

export function isPendingApprovalStatus(status?: string | null): boolean {
  const upper = (status || '').trim().toUpperCase();
  return upper === 'PENDING_APPROVAL' || upper === 'PENDING';
}

export function isAdministratorRole(role?: string | null): boolean {
  const upper = (role || '').trim().toUpperCase();
  return upper === 'ADMINISTRATOR' || upper === 'ADMIN';
}

export function getDisplayNameForAccount(account: Pick<FellowshipAccount, 'id' | 'role' | 'fullName'>): string {
  if (account.id === 'user-admin-01' || account.role === 'ADMINISTRATOR') {
    return 'Admin';
  }
  return account.fullName || 'Member';
}

export function getRoleLabel(role?: string | null): string {
  const upper = (role || '').toUpperCase();
  if (upper === 'ADMINISTRATOR' || upper === 'ADMIN') return 'Admin';
  if (upper.includes('EXECUTIVE') || upper === 'EXCO') return 'Youth Executive';
  if (upper === 'GUEST') return 'Guest';
  return 'Member';
}

export function canManageFellowship(role?: string | null): boolean {
  const upper = (role || '').toUpperCase();
  return upper === 'ADMINISTRATOR' || upper === 'ADMIN' || upper.includes('EXECUTIVE') || upper === 'EXCO';
}

export type FirestoreAccountRole = 'YOUTH_MEMBER' | 'YOUTH_EXECUTIVE' | 'GUEST' | 'ADMINISTRATOR';

export function normalizeAccountRoleForFirestore(role?: string | null): FirestoreAccountRole {
  const upper = (role || '').trim().toUpperCase();
  if (upper === 'ADMINISTRATOR' || upper === 'ADMIN') return 'ADMINISTRATOR';
  if (upper === 'YOUTH_EXECUTIVE' || upper === 'EXECUTIVE' || upper === 'EXCO') {
    return 'YOUTH_EXECUTIVE';
  }
  if (upper === 'GUEST') return 'GUEST';
  return 'YOUTH_MEMBER';
}

export function normalizeLanguageForFirestore(lang?: string | null): 'en' | 'yo' | 'ha' | 'ig' {
  const lower = (lang || '').trim().toLowerCase();
  if (lower === 'yo') return 'yo';
  if (lower === 'ha') return 'ha';
  if (lower === 'ig') return 'ig';
  return 'en';
}

export function buildNewAccountFirestoreDoc<TCreated = unknown>(params: {
  userId: string;
  fellowshipId?: string;
  fullName: string;
  email: string;
  phone?: string;
  salt?: string;
  passwordHash?: string;
  role?: string | null;
  status?: 'APPROVED' | 'PENDING';
  department?: string | null;
  preferredLanguage?: string | null;
  profilePhotoUri?: string;
  createdAt: TCreated;
  updatedAt: TCreated;
}): Record<string, unknown> {
  const normalizedRole = normalizeAccountRoleForFirestore(params.role);
  const resolvedRole = normalizedRole === 'ADMINISTRATOR' ? 'YOUTH_MEMBER' : normalizedRole;
  const resolvedStatus =
    params.status ?? (resolvedRole === 'YOUTH_EXECUTIVE' ? 'PENDING' : 'APPROVED');

  const doc: Record<string, unknown> = {
    userId: params.userId,
    fellowshipId: params.fellowshipId || 'GIDEONITES',
    fullName: params.fullName.trim(),
    email: params.email.trim().toLowerCase(),
    phone: (params.phone || '').trim(),
    role: resolvedRole,
    status: resolvedStatus,
    department: normalizeDepartmentType(params.department),
    preferredLanguage: normalizeLanguageForFirestore(params.preferredLanguage),
    englishOverride: false,
    xpPoints: 0,
    createdAt: params.createdAt,
    updatedAt: params.updatedAt,
  };

  if (params.salt && params.passwordHash) {
    doc.salt = params.salt;
    doc.passwordHash = params.passwordHash;
  }
  if (params.profilePhotoUri && params.profilePhotoUri.trim()) {
    doc.profilePhotoUri = params.profilePhotoUri.trim();
  }
  return doc;
}

export const SAFE_FIRESTORE_DOC_BYTES = 950_000;

export function estimatePayloadBytes(payload: unknown): number {
  const json = JSON.stringify(payload);
  return new TextEncoder().encode(json).length;
}

export function isWithinFirestoreDocLimit(
  payload: unknown,
  maxBytes: number = SAFE_FIRESTORE_DOC_BYTES
): boolean {
  return estimatePayloadBytes(payload) <= maxBytes;
}

export function formatActionErrorMessage(
  err: unknown,
  fallback = 'Something went wrong. Please try again.'
): string {
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  if (!raw) return fallback;

  if (raw.startsWith('{') && raw.includes('"error"')) {
    try {
      const parsed = JSON.parse(raw) as {
        error?: string;
        operationType?: string;
        authInfo?: { userId?: string | null };
      };
      const inner = parsed.error || '';
      if (inner.toLowerCase().includes('missing or insufficient permissions')) {
        if (parsed.authInfo && parsed.authInfo.userId === null) {
          return 'Database permission denied for an unauthenticated Firebase session. Sign in with Google or allow this write in your Firestore rules.';
        }
        return 'Permission denied by the database for this action. Please refresh or sign in with an authorized account.';
      }
      if (inner.toLowerCase().includes('exceeds the maximum allowed size')) {
        return 'This item is too large for database storage (1 MB limit). Please use a smaller attachment.';
      }
      if (inner.toLowerCase().includes('no document to update') || inner.toLowerCase().includes('not-found')) {
        return 'This record no longer exists. Refreshing the feed.';
      }
      if (inner) return inner;
    } catch {
      // fall through to raw message
    }
  }

  if (raw.toLowerCase().includes('missing or insufficient permissions')) {
    return 'Permission denied by the database for this action. Please refresh or sign in with an authorized account.';
  }
  if (raw.toLowerCase().includes('exceeds the maximum allowed size')) {
    return 'This item is too large for database storage (1 MB limit). Please use a smaller attachment.';
  }
  return raw;
}

