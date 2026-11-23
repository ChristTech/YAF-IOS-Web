export type UserRole =
  | 'ADMINISTRATOR'
  | 'YOUTH_EXECUTIVE'
  | 'EXECUTIVE'
  | 'YOUTH_MEMBER'
  | 'MEMBER'
  | 'GUEST';
export type AccountStatus =
  | 'APPROVED'
  | 'PENDING_APPROVAL'
  | 'PENDING'
  | 'SUSPENDED'
  | 'DECLINED'
  | 'PURGED';
export type LanguageCode = 'EN' | 'YO' | 'HA' | 'IG';

export type MainTab = 'home' | 'community' | 'games' | 'spiritual' | 'profile';

export interface FellowshipAccount {
  id: string;
  userId?: string;
  fellowshipId: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  phone?: string;
  address?: string;
  fellowshipGroup?: string;
  password?: string;
  salt?: string;
  passwordHash?: string;
  passwordSalt?: string;
  role: UserRole;
  status: AccountStatus;
  department: string;
  preferredLanguage: LanguageCode;
  englishOverride?: boolean;
  xpPoints?: number;
  avatarUrl?: string;
  profilePhotoUri?: string;
  createdAt: number;
  updatedAt?: number;
}

export type EventCategory =
  | 'YOUTH_SERVICE'
  | 'WORKSHOP'
  | 'RETREAT'
  | 'SOCIAL'
  | 'OUTREACH'
  | 'BIBLE_STUDY'
  | 'PRAYER_MEETING';

export type ProgrammeCategory =
  | 'All'
  | EventCategory
  | 'Youth Service'
  | 'Skills & Workshop'
  | 'Spiritual Retreat'
  | 'Social & Hangout'
  | 'Evangelism & Outreach'
  | 'Bible Study'
  | 'Prayer Meeting';

export interface ProgrammeRegistration {
  id?: string;
  eventId?: string;
  userId: string;
  userName?: string;
  fullName?: string;
  userEmail?: string;
  email?: string;
  userPhone?: string;
  passCode?: string;
  registeredAt: number;
  reminder5DaysScheduledAt?: number;
  reminder1DayScheduledAt?: number;
}

export interface Programme {
  id: string;
  fellowshipId: string;
  createdById?: string;
  titleEn: string;
  descriptionEn?: string;
  category: string;
  venue: string;
  speaker?: string;
  contactPerson?: string;
  participantLimit: number;
  isRegistrationEnabled?: boolean;
  startDateMillis: number;
  endDateMillis?: number;
  status?: string;
  registeredCount?: number;
  registrationsJson?: string;
  createdAt: number;
  updatedAt?: number;
  // Optional legacy web fields for backward compatibility
  title?: string;
  description?: string;
  dateTime?: string;
  timestamp?: number;
  minister?: string;
  capacity?: number;
  createdBy?: string;
}

export type CommunityCategory =
  | 'Discussion'
  | 'Work/Skills'
  | 'Testimonies'
  | 'Prayer Requests'
  | 'Q&A'
  | 'Faith & Career'
  | 'Spiritual Growth'
  | 'ANNOUNCEMENT_NORMAL'
  | 'ANNOUNCEMENT_URGENT';

export interface PostComment {
  id: string;
  postId?: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  authorAvatarUri?: string;
  content?: string;
  text?: string;
  createdAt: number;
}

export interface CommunityPost {
  id: string;
  fellowshipId: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  authorAvatarUri?: string;
  authorAvatar?: string;
  category: CommunityCategory | string;
  title?: string;
  content: string;
  attachmentPhotoUri?: string;
  photoUrl?: string;
  whatsappContact?: string;
  whatsappNumber?: string;
  likesCount: number;
  commentsCount?: number;
  likedByJson?: string;
  commentsJson: string;
  isPinned?: boolean;
  isFlagged?: boolean;
  isHidden?: boolean;
  createdAt: number;
  updatedAt?: number;
}

export type InquiryStatus = 'PENDING' | 'IN_PROGRESS' | 'RESOLVED' | 'OPEN' | 'ANSWERED';

export interface ExecutiveInquiry {
  id: string;
  fellowshipId: string;
  senderId: string;
  senderName: string;
  senderRole?: UserRole | string;
  senderAvatarUri?: string | null;
  isAnonymous: boolean;
  topic?: string;
  subject?: string;
  message?: string;
  question?: string;
  status: InquiryStatus;
  responseMessage?: string;
  response?: string;
  respondedByName?: string;
  respondedByRole?: string;
  respondedBy?: string;
  respondedAt?: number;
  createdAt: number;
  updatedAt?: number;
}

export interface DailyScriptureDoc {
  id: string;
  fellowshipId: string;
  authorId?: string;
  authorName?: string;
  dateKey?: string;
  referenceEn?: string;
  verseTextEn?: string;
  reflectionEn?: string;
  prayerPromptEn: string;
  createdAt: number;
  updatedAt?: number;
  // Optional localized or legacy fields
  reflectionYo?: string;
  reflectionHa?: string;
  reflectionIg?: string;
  referenceYo?: string;
  verseTextYo?: string;
  referenceHa?: string;
  verseTextHa?: string;
  referenceIg?: string;
  verseTextIg?: string;
  type?: 'DAILY_SCRIPTURE' | 'SERMON' | 'DEVOTIONAL' | 'BIBLE_STUDY' | 'PRAYER_POINTS' | 'BIBLE_DOC';
  reference?: string;
  verseText?: string;
  chargeEn?: string;
}

export type SpiritualResourceCategory =
  | 'SCRIPTURE_OF_THE_DAY'
  | 'DEVOTIONAL'
  | 'SERMON'
  | 'BIBLE_STUDY'
  | 'PRAYER_POINTS';

export interface SpiritualResource {
  id: string;
  kind: SpiritualResourceCategory;
  title: string;
  speaker: string;
  scriptureRef: string;
  duration: string;
  audioDurationMinutes?: number;
  audioCloudId?: string;
  audioFileName?: string;
  audioMimeType?: string;
  audioSizeBytes?: number;
  audioChunkCount?: number;
  summary?: string;
  body: string;
  bookmarkedBy: string[];
  createdAt: number;
}

export interface SermonAudioChunk {
  audioCloudId: string;
  fellowshipId: string;
  uploadedById: string;
  chunkIndex: number;
  totalChunks: number;
  dataBase64: string;
  createdAt: number;
  updatedAt: number;
}

export interface ExplorerBibleVerse {
  id: string;
  testament: 'Old Testament' | 'New Testament';
  book: string;
  chapter: number;
  verse: number;
  reference: string;
  text: string;
  translation: string;
  language: LanguageCode;
  theme: string;
}

export interface UploadedBibleSection {
  title: string;
  content: string;
}

export interface UploadedBibleDoc {
  id: string;
  title: string;
  version: string;
  translation?: string;
  format: 'PDF' | 'EPUB' | 'JSON' | 'TXT';
  fileFormat?: 'PDF' | 'EPUB' | 'JSON' | 'TXT';
  fileName: string;
  fileSizeKb: number;
  pageOrChapterCount?: number;
  extractedVersesCount?: number;
  sections?: UploadedBibleSection[];
  contentText: string;
  fileDataUrl?: string;
  uploadedBy: string;
  createdAt: number;
}

export type GameType = 'TRIVIA_CHALLENGE' | 'WHO_AM_I' | 'SCRIPTURE_SCRAMBLE';

export type SessionStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'LOBBY'
  | 'LIVE'
  | 'ENDED';

export type SessionSubstate = 'WAITING_TO_START' | 'QUESTION_OPEN' | 'LEADERBOARD';

export interface MultiplayerQuestion {
  id: string;
  gameType: GameType;
  prompt: string;
  options: string[];
  correctAnswer: string;
  clues: string[];
  scrambledWords: string[];
  scriptureReference: string;
  translation: string;
  timerSeconds: number;
  points: number;
  explanation: string;
}

export interface MultiplayerParticipant {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  joinedAt: number;
  joinedAtQuestionIndex: number;
  currentScore: number;
  lastQuestionPoints: number;
  lastAnswerTimestamp: number;
  answeredQuestionsCount: number;
  isOnline?: boolean;
  lastSubmittedQuestionIndex?: number;
  lastSubmittedCorrect?: boolean;
  lastSubmittedLate?: boolean;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  correctAnswerIndex?: number;
  scriptureRef?: string;
}

export interface SoloQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  scriptureRef: string;
}

export type SoloQuizCategory =
  | 'BIBLE_TRIVIA'
  | 'SCRIPTURE_MEMORY'
  | 'CHURCH_DOCTRINE'
  | 'YOUTH_HISTORY';

export interface GameQuiz {
  id: string;
  createdById: string;
  fellowshipId: string;
  title: string;
  description?: string;
  category: SoloQuizCategory | string;
  questionsJson: string;
  totalQuestions: number;
  timeLimitSeconds: number;
  difficulty: 'Easy' | 'Medium' | 'Hard' | string;
  createdAt: number;
  updatedAt: number;
}

export interface GameScore {
  id: string;
  quizId: string;
  quizTitle: string;
  userId: string;
  userName: string;
  fellowshipId: string;
  score: number;
  totalQuestions: number;
  timeTakenSeconds: number;
  completedAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface QuizParticipant {
  userId: string;
  fullName: string;
  score: number;
  answeredCount: number;
  lastUpdated: number;
}

export interface QuizSession {
  id: string;
  hostId: string;
  hostName: string;
  fellowshipId: string;
  roomPin: string;
  titleEn: string;
  title?: string;
  titleYo?: string;
  titleHa?: string;
  titleIg?: string;
  description?: string;
  gameType: GameType;
  status: SessionStatus;
  scheduledStartTime?: number;
  timeLimitPerQuestionSeconds: number;
  leaderboardDurationSeconds: number;
  currentQuestionIndex: number;
  totalQuestions: number;
  currentSubstate?: SessionSubstate;
  currentQuestionDeadline?: number;
  leaderboardDeadline?: number;
  baseScorePerQuestion: number;
  speedBonusEnabled: boolean;
  maxSpeedBonus: number;
  penaltyForIncorrect?: boolean;
  questionsJson: string;
  participantsJson: string;
  participantCount: number;
  scriptureFocus?: string;
  createdAt: number;
  updatedAt?: number;
}

export interface FellowshipNotification {
  id: string;
  dedupKey?: string;
  fellowshipId: string;
  title: string;
  message: string;
  type:
    | 'ANNOUNCEMENT'
    | 'EVENT'
    | 'PROGRAMME'
    | 'COMMUNITY'
    | 'COMMUNITY_POST'
    | 'QUIZ'
    | 'GAME_TIME'
    | 'APPROVAL'
    | 'FINANCE'
    | 'REPORT_REVIEW';
  targetRole?: 'ALL' | 'ADMINISTRATOR' | 'EXECUTIVE';
  recipientUserId?: string;
  senderDeviceId?: string;
  readByJson?: string;
  createdAt: number;
}

export type DepartmentType =
  | 'CHOIR'
  | 'DRAMA'
  | 'MEDIA'
  | 'PRAYER'
  | 'SPORTS'
  | 'USHERING'
  | 'HOSPITALITY'
  | 'GENERAL';

export interface MinistryDepartment {
  id: string;
  type: DepartmentType;
  name: string;
  description: string;
  meetingSchedule: string;
  venue: string;
  leadTitle: string;
}

export interface AttendanceRecord {
  id: string;
  fellowshipId: string;
  userId: string;
  userName: string;
  department: string;
  verificationCode: string;
  serviceTitle: string;
  checkedInBy: string;
  meetingTitle?: string;
  totalAttendees?: number;
  maleCount?: number;
  femaleCount?: number;
  firstTimersCount?: number;
  notes?: string;
  method?: 'LEADER_LOG' | 'QR_SELF_CODE';
  passCode?: string;
  createdAt: number;
}

export interface WeeklyReport {
  id: string;
  fellowshipId: string;
  department: string;
  departmentType?: DepartmentType;
  submittedBy: string;
  submittedById?: string;
  title?: string;
  weekLabel: string;
  attendanceCount: number;
  firstTimersCount?: number;
  highlights: string;
  achievements?: string;
  challenges?: string;
  nextWeekGoals?: string;
  prayerNeeds: string;
  status?: 'SUBMITTED' | 'REVIEWED' | 'ARCHIVED';
  reviewerNotes?: string;
  reviewedBy?: string;
  reviewedAt?: number;
  createdAt: number;
}

export type GivingCategoryKey =
  | 'TITHE'
  | 'OFFERING'
  | 'PLEDGE'
  | 'SPECIAL_PROJECT'
  | 'DUES'
  | 'DONATION'
  | 'Tithe'
  | 'Offering'
  | 'Pledge'
  | 'Fellowship Dues'
  | 'Welfare Seed';

export type PaymentMethodKey = 'BANK_TRANSFER' | 'DEBIT_CARD' | 'CASH' | 'USSD';

export type GivingStatusKey =
  | 'COMPLETED'
  | 'PLEDGED'
  | 'PENDING_VERIFICATION'
  | 'VERIFIED'
  | 'RECORDED';

export interface GivingRecord {
  id: string;
  fellowshipId: string;
  userId: string;
  donorName: string;
  userName?: string;
  category: GivingCategoryKey;
  amountNgn: number;
  amount?: number;
  paymentMethod?: PaymentMethodKey | string;
  referenceCode?: string;
  referenceNote: string;
  purposeOrNotes?: string;
  status: GivingStatusKey;
  createdAt: number;
}

export interface AuditLogEntry {
  id: string;
  fellowshipId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  actionType?: string;
  target: string;
  targetEntity?: string;
  details?: string;
  createdAt: number;
}
