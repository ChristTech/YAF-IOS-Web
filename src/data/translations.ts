import type { LanguageCode } from '../types/fellowship';

export const LANGUAGE_CYCLE: LanguageCode[] = ['EN', 'YO', 'HA', 'IG'];

export const LANGUAGE_PILL_LABEL: Record<LanguageCode, string> = {
  EN: 'EN',
  YO: 'YO ⇄ EN',
  HA: 'HA ⇄ EN',
  IG: 'IG ⇄ EN',
};

export const LANGUAGE_FULL_NAME: Record<LanguageCode, string> = {
  EN: 'English',
  YO: 'Yorùbá',
  HA: 'Hausa',
  IG: 'Igbo',
};

export function normalizeLanguageCode(raw?: string | null): LanguageCode {
  if (!raw) return 'EN';
  const upper = raw.trim().toUpperCase();
  if (upper === 'YO' || upper.startsWith('YOR')) return 'YO';
  if (upper === 'HA' || upper.startsWith('HAU')) return 'HA';
  if (upper === 'IG' || upper.startsWith('IGB')) return 'IG';
  return 'EN';
}

export interface SpiritualTranslationStrings {
  tabDevotionals: string;
  tabBibleExplorer: string;
  scriptureOfTheDayBadge: string;
  postScriptureAction: string;
  bibleAutoSyncedLabel: string;
  bibleAllLanguagesLabel: string;
  practiceMemory: string;
  revealScripture: string;
  savedOffline: string;
  saveOffline: string;
  bookmarkedDone: string;
  listenAloud: string;
  pauseAudio: string;
  stopAudio: string;
  readFullMessage: string;
  share: string;
  close: string;
  bibleSearchPlaceholder?: string;
  savedOfflineFilter?: string;
  allFilter?: string;
  bookmarkedLabel?: string;
  shareLabel?: string;
}

export interface TranslationStrings {
  graceAndPeace: string;
  scriptureForTheDay: string;
  postScriptureForTheDay: string;
  postUpcomingProgramme: string;
  upcomingProgrammes: string;
  dailyChargeTitle: string;
  postDailyScripture: string;
  registerNow: string;
  registerRsvp: string;
  registeredPass: string;
  newProgramme: string;
  tabs: {
    home: string;
    community: string;
    games: string;
    spiritual: string;
    profile: string;
  };
  subTabs: {
    communityForum: string;
    communityUnits: string;
    unitReports: string;
    forumDesk: string;
    unitsAttendance: string;
    bibleGamesArena: string;
    weeklyReports: string;
    sermonsDevotionals: string;
    bibleExplorer: string;
    myProfile: string;
    givingPledges: string;
    commandCentre: string;
  };
  spiritual: SpiritualTranslationStrings;
  announcementsTitle: string;
  notificationsTitle: string;
  askTheExcos: string;
  fellowshipForum: string;
  signOut: string;
  givingSubtitle: string;
}

export const TRANSLATIONS: Record<LanguageCode, TranslationStrings> = {
  EN: {
    graceAndPeace: 'Grace & Peace',
    scriptureForTheDay: 'SCRIPTURE FOR THE DAY',
    postScriptureForTheDay: 'Post Scripture for the Day',
    postUpcomingProgramme: '+ Post Upcoming Programme',
    upcomingProgrammes: 'UPCOMING YOUTH PROGRAMMES',
    dailyChargeTitle: 'SCRIPTURE FOR THE DAY',
    postDailyScripture: 'Post Scripture for the Day',
    registerNow: 'Register Now',
    registerRsvp: 'Register (RSVP)',
    registeredPass: 'Registered ✓',
    newProgramme: '+ Post Upcoming Programme',
    tabs: {
      home: 'Home',
      community: 'Community',
      games: 'Games',
      spiritual: 'Spiritual',
      profile: 'Profile',
    },
    subTabs: {
      communityForum: 'Forum',
      communityUnits: 'Units',
      unitReports: 'Unit Reports',
      forumDesk: 'Forum & Desk',
      unitsAttendance: 'Units & Attendance',
      bibleGamesArena: 'Bible Games Arena',
      weeklyReports: 'Weekly Reports',
      sermonsDevotionals: 'Devotionals & Sermons',
      bibleExplorer: 'Bible Explorer',
      myProfile: 'My Profile',
      givingPledges: 'Giving & Pledges',
      commandCentre: 'Command Centre',
    },
    spiritual: {
      tabDevotionals: 'Devotionals & Sermons',
      tabBibleExplorer: 'Bible Explorer',
      scriptureOfTheDayBadge: 'SCRIPTURE OF THE DAY',
      postScriptureAction: 'Post Scripture',
      bibleAutoSyncedLabel: 'English (Synced)',
      bibleAllLanguagesLabel: 'All Languages',
      practiceMemory: 'Practice Memory',
      revealScripture: 'Reveal Scripture',
      savedOffline: 'Saved Offline',
      saveOffline: 'Save Offline',
      bookmarkedDone: 'Bookmarked ✓',
      listenAloud: 'Listen Aloud',
      pauseAudio: 'Pause Audio',
      stopAudio: 'Stop Audio',
      readFullMessage: 'Read Full Message',
      share: 'Share',
      close: 'Close',
    },
    announcementsTitle: 'Fellowship Announcements',
    notificationsTitle: 'Notification Center',
    askTheExcos: 'Ask the Excos',
    fellowshipForum: 'Fellowship Forum',
    signOut: 'Sign Out',
    givingSubtitle: 'Official Fellowship Bank Account & Giving Ledger',
  },
  YO: {
    graceAndPeace: 'Oore-ọ̀fẹ́ àti Àlàáfíà',
    scriptureForTheDay: 'Ọ̀RỌ̀ ỌLỌ́RUN FÚN ÒNÍ',
    postScriptureForTheDay: 'Fi Ọ̀rọ̀ Ọlọ́run Lónìí Sílẹ̀',
    postUpcomingProgramme: '+ Fi Ètò Tuntun Sílẹ̀',
    upcomingProgrammes: 'ÀWỌN ÈTÒ Ọ̀DỌ́ TÓ Ń BỌ̀',
    dailyChargeTitle: 'Ọ̀RỌ̀ ỌLỌ́RUN FÚN ÒNÍ',
    postDailyScripture: 'Fi Ọ̀rọ̀ Ọlọ́run Lónìí Sílẹ̀',
    registerNow: 'Forúkọsílẹ̀ Báyìí',
    registerRsvp: 'Forúkọsílẹ̀ (RSVP)',
    registeredPass: 'Ti Forúkọsílẹ̀ ✓',
    newProgramme: '+ Fi Ètò Tuntun Sílẹ̀',
    tabs: {
      home: 'Ilé',
      community: 'Àwùjọ',
      games: 'Àwọn Eré',
      spiritual: 'Ẹ̀mí',
      profile: 'Ìrísí Mi',
    },
    subTabs: {
      communityForum: 'Ìjíròrò',
      communityUnits: 'Ẹ̀ka Iṣẹ́',
      unitReports: 'Ìròyìn Ẹ̀ka',
      forumDesk: 'Àpérò & Àwọn Olórí',
      unitsAttendance: 'Ẹ̀ka & Ìkópa',
      bibleGamesArena: 'Pápá Eré Bíbélì',
      weeklyReports: 'Ìròyìn Ọ̀sọ̀ọ̀sẹ̀',
      sermonsDevotionals: 'Ìwé Ìgbàgbọ́ & Ìwàásù',
      bibleExplorer: 'Bíbélì Mímọ́',
      myProfile: 'Ìrísí Mi',
      givingPledges: 'Ìdámẹ́wàá & Ọrẹ',
      commandCentre: 'Ilé Àṣẹ',
    },
    spiritual: {
      tabDevotionals: 'Ìwé Ìgbàgbọ́ & Ìwàásù',
      tabBibleExplorer: 'Bíbélì Mímọ́',
      scriptureOfTheDayBadge: 'Ọ̀RỌ̀ ỌLỌ́RUN LÓNÌÍ',
      postScriptureAction: 'Fi Ọ̀rọ̀ Lónìí Ránṣẹ́',
      bibleAutoSyncedLabel: 'Yorùbá (Ti Sopọ̀)',
      bibleAllLanguagesLabel: 'Gbogbo Èdè',
      practiceMemory: 'Kọ́ Ní Àkọ́sórí',
      revealScripture: 'Fihàn Ẹsẹ Bíbélì',
      savedOffline: 'Àṣàyàn Offline',
      saveOffline: 'Fipamọ́ Offline',
      bookmarkedDone: 'Ti Fipamọ́ ✓',
      listenAloud: 'Gbọ́ Ohùn',
      pauseAudio: 'Dákẹ́ Ohùn',
      stopAudio: 'Dá Ohùn Dúró',
      readFullMessage: 'Ka Gbogbo Ọ̀rọ̀',
      share: 'Pín Pẹ̀lú',
      close: 'Tì í',
    },
    announcementsTitle: 'Ìkéde Ẹgbẹ́ Ọ̀dọ́',
    notificationsTitle: 'Àpótí Ìfitónilétí',
    askTheExcos: 'Bi Àwọn Olórí',
    fellowshipForum: 'Àpérò Ẹgbẹ́',
    signOut: 'Jáde',
    givingSubtitle: 'Àkọọ́lẹ̀ Báńkì Ẹgbẹ́ & Ìwé Ìtọrẹ',
  },
  HA: {
    graceAndPeace: 'Alheri da Salama',
    scriptureForTheDay: 'AYAR LITTAFI TA YAU',
    postScriptureForTheDay: 'Saka Ayar Yau',
    postUpcomingProgramme: '+ Saka Sabon Shiri',
    upcomingProgrammes: 'SHIRYE-SHIRYEN MATASA MASU ZUWA',
    dailyChargeTitle: 'AYAR LITTAFI TA YAU',
    postDailyScripture: 'Saka Ayar Yau',
    registerNow: 'Yi Rajista Yanzu',
    registerRsvp: 'Yi Rajista (RSVP)',
    registeredPass: 'An Yi Rajista ✓',
    newProgramme: '+ Saka Sabon Shiri',
    tabs: {
      home: 'Gida',
      community: "Al'umma",
      games: 'Wasanni',
      spiritual: 'Ruhaniya',
      profile: 'Bayani Na',
    },
    subTabs: {
      communityForum: 'Tattaunawa',
      communityUnits: 'Sassa',
      unitReports: 'Rahoton Sassa',
      forumDesk: 'Tattaunawa & Shugabanni',
      unitsAttendance: 'Sashe & Halarta',
      bibleGamesArena: 'Filin Wasannin Littafi',
      weeklyReports: 'Rahoton Mako',
      sermonsDevotionals: "Wa'azi & Karatu",
      bibleExplorer: 'Littafi Mai Tsarki',
      myProfile: 'Bayani Na',
      givingPledges: 'Zakkar & Sadaka',
      commandCentre: 'Cibiyar Gudanarwa',
    },
    spiritual: {
      tabDevotionals: "Wa'azi & Karatu",
      tabBibleExplorer: 'Littafi Mai Tsarki',
      scriptureOfTheDayBadge: 'AYAR LITTAFI TA YAU',
      postScriptureAction: 'Saka Ayar Yau',
      bibleAutoSyncedLabel: 'Hausa (An Daidaita)',
      bibleAllLanguagesLabel: 'Dukan Harsuna',
      practiceMemory: 'Haddace Aya',
      revealScripture: 'Nuna Aya',
      savedOffline: 'Ajiyayyun Offline',
      saveOffline: 'Ajiye Offline',
      bookmarkedDone: 'An Ajiye ✓',
      listenAloud: 'Saurara',
      pauseAudio: 'Dakata',
      stopAudio: 'Tsayar da Murya',
      readFullMessage: 'Karanta Cikakken Saƙo',
      share: 'Raba',
      close: 'Rufe',
    },
    announcementsTitle: 'Sanarwar Zumunta',
    notificationsTitle: 'Cibiyar Sanarwa',
    askTheExcos: 'Tambayi Shugabanni',
    fellowshipForum: 'Dandalin Zumunta',
    signOut: 'Fita',
    givingSubtitle: 'Asusun Bankin Zumunta & Littafin Sadaka',
  },
  IG: {
    graceAndPeace: 'Amara na Udo',
    scriptureForTheDay: 'OKWU CHINEKE NKE TAATA',
    postScriptureForTheDay: 'Tinye Okwu Taa',
    postUpcomingProgramme: '+ Tinye Mmemme Na-abịa',
    upcomingProgrammes: 'MMEMME NDỊ NTOROBỊA NA-ABỊA',
    dailyChargeTitle: 'OKWU CHINEKE NKE TAATA',
    postDailyScripture: 'Tinye Okwu Taa',
    registerNow: 'Debanye Aha Ugbu a',
    registerRsvp: 'Debanye Aha (RSVP)',
    registeredPass: 'Edebanyela Aha ✓',
    newProgramme: '+ Tinye Mmemme Na-abịa',
    tabs: {
      home: 'Ụlọ',
      community: 'Ọgbakọ',
      games: 'Egwuregwu',
      spiritual: 'Ime Mmụọ',
      profile: 'Profaịlụ M',
    },
    subTabs: {
      communityForum: 'Mkparịta ụka',
      communityUnits: 'Ngalaba',
      unitReports: 'Akụkọ Ngalaba',
      forumDesk: 'Nzukọ & Ndị Isi',
      unitsAttendance: 'Ngalaba & Ndebanye',
      bibleGamesArena: 'Egwuregwu Baịbụl',
      weeklyReports: 'Akụkọ Izu',
      sermonsDevotionals: 'Ozizi & Okwuchukwu',
      bibleExplorer: 'Baịbụl Nsọ',
      myProfile: 'Profaịlụ M',
      givingPledges: 'Onyinye & Nkwa',
      commandCentre: 'Ọdụ Nchịkwa',
    },
    spiritual: {
      tabDevotionals: 'Ozizi & Okwuchukwu',
      tabBibleExplorer: 'Baịbụl Nsọ',
      scriptureOfTheDayBadge: 'OKWU CHINEKE NKE TAA',
      postScriptureAction: 'Zipụ Okwu Taa',
      bibleAutoSyncedLabel: 'Igbo (Ejikọtara)',
      bibleAllLanguagesLabel: 'Asụsụ Niile',
      practiceMemory: 'Mụọ N’isi',
      revealScripture: 'Gosi Akwụkwọ Nsọ',
      savedOffline: 'Echekwara Offline',
      saveOffline: 'Chekwaa Offline',
      bookmarkedDone: 'Echekwara ✓',
      listenAloud: 'Gee Ntị',
      pauseAudio: 'Kwụsịtụ',
      stopAudio: 'Kwụsị Ọdịyo',
      readFullMessage: 'Gụọ Ozi Niile',
      share: 'Kesaa',
      close: 'Mechie',
    },
    announcementsTitle: 'Ọkwa Nzukọ Ndị Ntorobịa',
    notificationsTitle: 'Ebe Ozi Ọhụrụ',
    askTheExcos: 'Jụọ Ndị Isi',
    fellowshipForum: 'Nzukọ Ụmụnna',
    signOut: 'Pụọ',
    givingSubtitle: 'Akaụntụ Bankị Nzukọ & Ndekọ Onyinye',
  },
};
