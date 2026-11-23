import type {
  DailyScriptureDoc,
  DepartmentType,
  MinistryDepartment,
  QuizQuestion,
  SpiritualResource,
} from '../types/fellowship';

export interface BibleVerseItem {
  id: string;
  testament: 'Old Testament' | 'New Testament';
  book: string;
  chapter: number;
  verse: number;
  reference: string;
  text: string;
  theme: string;
}

export const MINISTRY_DEPARTMENTS: MinistryDepartment[] = [
  {
    id: 'unit-choir',
    type: 'CHOIR',
    name: 'Choir & Music Ministry',
    description: 'Leading spirit-filled praise, worship, and youth anthem ministrations.',
    meetingSchedule: 'Fridays · 5:00 PM & Saturdays · 3:30 PM',
    venue: 'Choir Gallery, Youth Chapel',
    leadTitle: 'Music Coordinator',
  },
  {
    id: 'unit-drama',
    type: 'DRAMA',
    name: 'Drama & Creative Arts',
    description: 'Gospel stage plays, spoken word, choreography, and prophetic skits.',
    meetingSchedule: 'Saturdays · 2:00 PM',
    venue: 'Upper Room Studio',
    leadTitle: 'Creative Director',
  },
  {
    id: 'unit-media',
    type: 'MEDIA',
    name: 'Media & Technical Team',
    description: 'Livestreaming, sound engineering, projection, photography, and digital evangelism.',
    meetingSchedule: 'Saturdays · 4:00 PM',
    venue: 'Media Booth, Main Sanctuary',
    leadTitle: 'Media Coordinator',
  },
  {
    id: 'unit-prayer',
    type: 'PRAYER',
    name: 'Prayer & Intercession Unit',
    description: 'Standing in the gap for the fellowship, revival vigils, and altar care.',
    meetingSchedule: 'Wednesdays · 6:00 PM & Fridays · 11:00 PM',
    venue: 'Prayer Sanctuary',
    leadTitle: 'Prayer Secretary',
  },
  {
    id: 'unit-sports',
    type: 'SPORTS',
    name: 'Sports & Recreation Unit',
    description: 'Youth fitness, football outreach, indoor games, and fellowship bonding.',
    meetingSchedule: 'Saturdays · 7:00 AM',
    venue: 'Fellowship Sports Ground',
    leadTitle: 'Sports Coordinator',
  },
  {
    id: 'unit-ushering',
    type: 'USHERING',
    name: 'Ushering & Protocol',
    description: 'Warm hospitality, seating order, VIP welcome, and service coordination.',
    meetingSchedule: 'Sundays · 7:30 AM & Thursdays · 5:00 PM',
    venue: 'Fellowship Foyer',
    leadTitle: 'Head Usher',
  },
];

export const ALL_DEPARTMENT_TYPES: { type: DepartmentType; label: string }[] = [
  { type: 'CHOIR', label: 'Choir & Music Ministry' },
  { type: 'DRAMA', label: 'Drama & Creative Arts' },
  { type: 'MEDIA', label: 'Media & Technical Team' },
  { type: 'PRAYER', label: 'Prayer & Intercession Unit' },
  { type: 'SPORTS', label: 'Sports & Recreation Unit' },
  { type: 'USHERING', label: 'Ushering & Protocol' },
  { type: 'HOSPITALITY', label: 'Hospitality & Welfare' },
  { type: 'GENERAL', label: 'General Fellowship' },
];

export const DEPARTMENT_NAMES = MINISTRY_DEPARTMENTS.map((d) => d.name);

export const INQUIRY_SUBJECT_TOPICS = [
  'Spiritual Counseling & Mentorship',
  'Confidential Prayer Request',
  'Career & Academic Guidance',
  'Feedback for Youth Leadership',
  'Disciplinary / Personal Inquiry',
] as const;

export const BIBLE_VERSES: BibleVerseItem[] = [
  {
    id: 'gen-1-1',
    testament: 'Old Testament',
    book: 'Genesis',
    chapter: 1,
    verse: 1,
    reference: 'Genesis 1:1',
    text: 'In the beginning God created the heaven and the earth.',
    theme: 'Creation & Sovereignty',
  },
  {
    id: 'judg-6-12',
    testament: 'Old Testament',
    book: 'Judges',
    chapter: 6,
    verse: 12,
    reference: 'Judges 6:12',
    text: 'And the angel of the LORD appeared unto him, and said unto him, The LORD is with thee, thou mighty man of valour.',
    theme: 'Gideonite Identity & Courage',
  },
  {
    id: 'judg-6-14',
    testament: 'Old Testament',
    book: 'Judges',
    chapter: 6,
    verse: 14,
    reference: 'Judges 6:14',
    text: 'Go in this thy might, and thou shalt save Israel from the hand of the Midianites: have not I sent thee?',
    theme: 'Kingdom Mandate',
  },
  {
    id: 'judg-7-20',
    testament: 'Old Testament',
    book: 'Judges',
    chapter: 7,
    verse: 20,
    reference: 'Judges 7:20',
    text: 'The sword of the LORD, and of Gideon.',
    theme: 'Victory & Boldness',
  },
  {
    id: 'josh-1-9',
    testament: 'Old Testament',
    book: 'Joshua',
    chapter: 1,
    verse: 9,
    reference: 'Joshua 1:9',
    text: 'Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.',
    theme: 'Strength & Courage',
  },
  {
    id: 'ps-23-1',
    testament: 'Old Testament',
    book: 'Psalms',
    chapter: 23,
    verse: 1,
    reference: 'Psalm 23:1',
    text: 'The LORD is my shepherd; I shall not want.',
    theme: 'Provision & Guidance',
  },
  {
    id: 'ps-119-9',
    testament: 'Old Testament',
    book: 'Psalms',
    chapter: 119,
    verse: 9,
    reference: 'Psalm 119:9',
    text: 'Wherewithal shall a young man cleanse his way? by taking heed thereto according to thy word.',
    theme: 'Youth Purity & Word',
  },
  {
    id: 'ps-119-105',
    testament: 'Old Testament',
    book: 'Psalms',
    chapter: 119,
    verse: 105,
    reference: 'Psalm 119:105',
    text: 'Thy word is a lamp unto my feet, and a light unto my path.',
    theme: 'Direction',
  },
  {
    id: 'prov-3-5',
    testament: 'Old Testament',
    book: 'Proverbs',
    chapter: 3,
    verse: 5,
    reference: 'Proverbs 3:5-6',
    text: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.',
    theme: 'Wisdom & Trust',
  },
  {
    id: 'isa-40-31',
    testament: 'Old Testament',
    book: 'Isaiah',
    chapter: 40,
    verse: 31,
    reference: 'Isaiah 40:31',
    text: 'But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.',
    theme: 'Spiritual Renewal',
  },
  {
    id: 'jer-29-11',
    testament: 'Old Testament',
    book: 'Jeremiah',
    chapter: 29,
    verse: 11,
    reference: 'Jeremiah 29:11',
    text: 'For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end.',
    theme: 'Purpose & Future',
  },
  {
    id: 'ezek-22-30',
    testament: 'Old Testament',
    book: 'Ezekiel',
    chapter: 22,
    verse: 30,
    reference: 'Ezekiel 22:30',
    text: 'And I sought for a man among them, that should make up the hedge, and stand in the gap before me for the land, that I should not destroy it.',
    theme: 'Standing in the Gap',
  },
  {
    id: 'dan-11-32',
    testament: 'Old Testament',
    book: 'Daniel',
    chapter: 11,
    verse: 32,
    reference: 'Daniel 11:32',
    text: 'But the people that do know their God shall be strong, and do exploits.',
    theme: 'Kingdom Giants',
  },
  {
    id: 'joel-2-28',
    testament: 'Old Testament',
    book: 'Joel',
    chapter: 2,
    verse: 28,
    reference: 'Joel 2:28',
    text: 'And it shall come to pass afterward, that I will pour out my spirit upon all flesh; and your sons and your daughters shall prophesy.',
    theme: 'Revival & Youth',
  },
  {
    id: 'matt-5-14',
    testament: 'New Testament',
    book: 'Matthew',
    chapter: 5,
    verse: 14,
    reference: 'Matthew 5:14',
    text: 'Ye are the light of the world. A city that is set on an hill cannot be hid.',
    theme: 'Witness & Influence',
  },
  {
    id: 'matt-6-33',
    testament: 'New Testament',
    book: 'Matthew',
    chapter: 6,
    verse: 33,
    reference: 'Matthew 6:33',
    text: 'But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you.',
    theme: 'Kingdom Priority',
  },
  {
    id: 'john-3-16',
    testament: 'New Testament',
    book: 'John',
    chapter: 3,
    verse: 16,
    reference: 'John 3:16',
    text: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.',
    theme: 'Salvation & Love',
  },
  {
    id: 'acts-1-8',
    testament: 'New Testament',
    book: 'Acts',
    chapter: 1,
    verse: 8,
    reference: 'Acts 1:8',
    text: 'But ye shall receive power, after that the Holy Ghost is come upon you: and ye shall be witnesses unto me.',
    theme: 'Holy Spirit Power',
  },
  {
    id: 'rom-12-2',
    testament: 'New Testament',
    book: 'Romans',
    chapter: 12,
    verse: 2,
    reference: 'Romans 12:2',
    text: 'And be not conformed to this world: but be ye transformed by the renewing of your mind.',
    theme: 'Renewal & Consecration',
  },
  {
    id: 'eph-6-10',
    testament: 'New Testament',
    book: 'Ephesians',
    chapter: 6,
    verse: 10,
    reference: 'Ephesians 6:10-11',
    text: 'Finally, my brethren, be strong in the Lord, and in the power of his might. Put on the whole armour of God.',
    theme: 'Spiritual Warfare',
  },
  {
    id: 'phil-4-13',
    testament: 'New Testament',
    book: 'Philippians',
    chapter: 4,
    verse: 13,
    reference: 'Philippians 4:13',
    text: 'I can do all things through Christ which strengtheneth me.',
    theme: 'Empowerment',
  },
  {
    id: '1tim-4-12',
    testament: 'New Testament',
    book: '1 Timothy',
    chapter: 4,
    verse: 12,
    reference: '1 Timothy 4:12',
    text: 'Let no man despise thy youth; but be thou an example of the believers, in word, in conversation, in charity, in spirit, in faith, in purity.',
    theme: 'Youth Example',
  },
  {
    id: '2tim-2-15',
    testament: 'New Testament',
    book: '2 Timothy',
    chapter: 2,
    verse: 15,
    reference: '2 Timothy 2:15',
    text: 'Study to shew thyself approved unto God, a workman that needeth not to be ashamed, rightly dividing the word of truth.',
    theme: 'Scripture Mastery',
  },
  {
    id: 'heb-11-1',
    testament: 'New Testament',
    book: 'Hebrews',
    chapter: 11,
    verse: 1,
    reference: 'Hebrews 11:1',
    text: 'Now faith is the substance of things hoped for, the evidence of things not seen.',
    theme: 'Faith',
  },
];

export interface ScrambleItem {
  word: string;
  hint: string;
  scripture: string;
}

export const SCRAMBLE_WORDS: ScrambleItem[] = [
  { word: 'GIDEON', hint: 'Mighty man of valour called from the winepress', scripture: 'Judges 6:12' },
  { word: 'VALOR', hint: 'Courageous spirit declared over Gideon', scripture: 'Judges 6:12' },
  { word: 'TORCH', hint: 'Light carried inside pitchers by the 300', scripture: 'Judges 7:16' },
  { word: 'TRUMPET', hint: 'Sounded on the hills before victory', scripture: 'Judges 7:20' },
  { word: 'REVIVAL', hint: 'Fresh outpouring of the Spirit upon youth', scripture: 'Joel 2:28' },
  { word: 'SANCTUARY', hint: 'Sacred place of worship and prayer', scripture: 'Psalm 73:17' },
  { word: 'EXPLOITS', hint: 'Mighty deeds done by those who know God', scripture: 'Daniel 11:32' },
  { word: 'INTERCEDE', hint: 'Standing in the gap in prayer for others', scripture: 'Ezekiel 22:30' },
];

export const DEFAULT_SOLO_QUIZZES: {
  id: string;
  title: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Scholar';
  questions: QuizQuestion[];
}[] = [
  {
    id: 'solo-gideon',
    title: 'Gideon & The 300 Warriors',
    difficulty: 'Intermediate',
    questions: [
      {
        id: 'q1',
        question: 'Where was Gideon threshing wheat when the angel of the LORD appeared to him?',
        options: ['In the temple court', 'By the winepress', 'On Mount Carmel', 'Beside the Jordan'],
        correctIndex: 1,
        scriptureRef: 'Judges 6:11',
      },
      {
        id: 'q2',
        question: 'How many men remained in Gideon’s army after the water-drinking test?',
        options: ['3,000', '1,000', '300', '120'],
        correctIndex: 2,
        scriptureRef: 'Judges 7:7',
      },
      {
        id: 'q3',
        question: 'What three items did each of Gideon’s 300 men carry into battle?',
        options: [
          'Sword, shield, and spear',
          'Trumpet, empty pitcher, and lamp',
          'Bow, arrow, and banner',
          'Sling, stone, and staff',
        ],
        correctIndex: 1,
        scriptureRef: 'Judges 7:16',
      },
      {
        id: 'q4',
        question: 'What was the battle cry of Gideon’s men?',
        options: [
          'The Lord is our Banner!',
          'The sword of the LORD, and of Gideon!',
          'Stand still and see salvation!',
          'Shout for the Lord hath given us the city!',
        ],
        correctIndex: 1,
        scriptureRef: 'Judges 7:20',
      },
    ],
  },
  {
    id: 'solo-youth-giants',
    title: 'Youth Giants of Scripture',
    difficulty: 'Beginner',
    questions: [
      {
        id: 'yq1',
        question: 'Which epistle reminds young believers: "Let no man despise thy youth"?',
        options: ['1 Corinthians', '1 Timothy', 'Galatians', 'Philippians'],
        correctIndex: 1,
        scriptureRef: '1 Timothy 4:12',
      },
      {
        id: 'yq2',
        question: 'Who wrote: "The people that do know their God shall be strong, and do exploits"?',
        options: ['Isaiah', 'Jeremiah', 'Daniel', 'Ezekiel'],
        correctIndex: 2,
        scriptureRef: 'Daniel 11:32',
      },
      {
        id: 'yq3',
        question: 'Complete Psalm 119:9 — "Wherewithal shall a young man cleanse his way?"',
        options: [
          'By fasting forty days',
          'By taking heed thereto according to thy word',
          'By giving tithes of all',
          'By singing psalms daily',
        ],
        correctIndex: 1,
        scriptureRef: 'Psalm 119:9',
      },
    ],
  },
];

export interface ScripturePreset {
  reference: string;
  translations: Record<'EN' | 'YO' | 'HA' | 'IG', string>;
}

export const SCRIPTURE_OF_THE_DAY_PRESETS: ScripturePreset[] = [
  {
    reference: 'Judges 6:12',
    translations: {
      EN: 'The LORD is with thee, thou mighty man of valour.',
      YO: 'Olúwa wà pẹ̀lú rẹ, ìwọ alágbára akọni.',
      HA: 'Ubangiji yana tare da kai, ya kai jarumi mai ƙarfi.',
      IG: 'Onyenwe anyị nọnyeere gị, gị dike dị ike.',
    },
  },
  {
    reference: 'Daniel 11:32b',
    translations: {
      EN: 'But the people that do know their God shall be strong, and do exploits.',
      YO: 'Ṣùgbọ́n àwọn ènìyàn tí ó mọ Ọlọ́run wọn yóò lágbára, wọn yóò sì ṣe iṣẹ́ ìyanu.',
      HA: 'Amma mutanen da suka san Allahn su za su yi ƙarfi, su yi manyan ayyuka.',
      IG: 'Ma ndị maara Chineke ha ga-adị ike, mee ihe dị ukwuu.',
    },
  },
  {
    reference: '1 Timothy 4:12',
    translations: {
      EN: 'Let no man despise thy youth; but be thou an example of the believers, in word, in conversation, in charity, in spirit, in faith, in purity.',
      YO: 'Má ṣe jẹ́ kí ẹnikẹ́ni tẹ́ńbẹ́lú ìgbà èwe rẹ; ṣùgbọ́n jẹ́ àpẹẹrẹ fún àwọn onígbàgbọ́ ní ọ̀rọ̀, ní ìwà, ní ìfẹ́, ní ẹ̀mí, ní ìgbàgbọ́, àti ní ìwà mímọ́.',
      HA: 'Kada kowa ya raina ƙuruciyarka; amma ka zama abin koyi ga masu bi a magana, da hali, da ƙauna, da ruhu, da bangaskiya, da tsarki.',
      IG: 'Ekwela ka onye ọ bụla leda ntorobịa gị anya; kama bụrụ ihe nlereanya nye ndị kwere ekwe n’okwu, n’omume, n’ịhụnanya, n’ime mmụọ, n’okwukwe, na n’ịdị ọcha.',
    },
  },
  {
    reference: 'Joshua 1:9',
    translations: {
      EN: 'Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.',
      YO: 'Jẹ́ alágbára kí o sì ní ìgboyà; má bẹ̀rù, má sì jẹ́ kí àyà rẹ ó fò: nítorí Olúwa Ọlọ́run rẹ wà pẹ̀lú rẹ ní ibikíbi tí ìwọ bá ń lọ.',
      HA: 'Ka yi ƙarfi ka ƙarfafa zuciyarka; kada ka ji tsoro, kada ka karaya: domin Ubangiji Allahnka yana tare da kai duk inda ka je.',
      IG: 'Dị ike nwee obi ike; atụla egwu, emela ka obi lọọ gị mmiri: n’ihi na Onyenwe anyị Chineke gị nọnyeere gị n’ebe ọ bụla ị na-aga.',
    },
  },
  {
    reference: 'Isaiah 40:31',
    translations: {
      EN: 'But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.',
      YO: 'Ṣùgbọ́n àwọn tí ó dúró de Olúwa yóò tún agbára wọn ṣe; wọn yóò fò sókè pẹ̀lú ìyẹ́ bí idì; wọn yóò sáré, wọn kì yóò sì rẹ̀; wọn yóò rìn, wọn kì yóò sì dákú.',
      HA: 'Amma waɗanda suke dogara ga Ubangiji za su sabunta ƙarfinsu; za su tashi sama da fuka-fuki kamar gaggafa; za su yi gudu ba za su gaji ba; za su yi tafiya ba za su suma ba.',
      IG: 'Ma ndị na-eche Onyenwe anyị ga-eme ka ike ha dị ọhụrụ; ha ga-efe elu n’ikuku dị ka ugo; ha ga-agba ọsọ ma ike agaghị agwụ ha; ha ga-eje ije ma ha agaghị ada mbà.',
    },
  },
];

export const DEFAULT_DAILY_SCRIPTURE: DailyScriptureDoc = {
  id: 'default-daily-scripture',
  fellowshipId: 'GIDEONITES',
  type: 'DAILY_SCRIPTURE',
  referenceEn: 'Judges 6:12',
  verseTextEn: 'The LORD is with thee, thou mighty man of valour.',
  reflectionEn:
    'The LORD is with thee, thou mighty man of valour.\n\nGideonites Youth Charge:\nRise as mighty Gideonites today and do Kingdom exploits!',
  prayerPromptEn: JSON.stringify({
    category: 'SCRIPTURE_OF_THE_DAY',
    title: 'Scripture for the Day • Judges 6:12',
    summary: 'The LORD is with thee, thou mighty man of valour.',
    audioDurationMinutes: 0,
    publishedAt: 0,
  }),
  authorName: 'Living Faith Church Youth Ministry',
  createdAt: Date.now(),
};

export const DEFAULT_SPIRITUAL_RESOURCES: SpiritualResource[] = [
  {
    id: 'seed-dev-1',
    kind: 'DEVOTIONAL',
    title: 'Standing in the Gap Without Compromise',
    speaker: 'Youth Chaplaincy Desk',
    scriptureRef: 'Ezekiel 22:30',
    duration: '5 min read',
    body: 'God does not look for the loudest crowd; He searches for a consecrated remnant willing to build the hedge in prayer and integrity. Just as Gideon’s 300 stood awake at the watch with torches hidden inside earthen vessels, your daily discipline in the secret place prepares you for public victory. Keep the fire burning today through Word meditation and intentional intercession for your peers.',
    bookmarkedBy: [],
    createdAt: Date.now() - 86_400_000,
  },
  {
    id: 'seed-sermon-1',
    kind: 'SERMON',
    title: 'Raising Kingdom Giants in a Digital Age',
    speaker: 'Pastor Tunde Adeyemi',
    scriptureRef: 'Daniel 11:32',
    duration: '28 min message',
    body: 'Exploits are not products of hype—they flow from intimacy with God. Daniel and his companions excelled ten times above their peers in Babylon because they settled their consecration before the test arrived. Youth Alive members must pair spiritual depth with marketplace skill, media stewardship, and compassionate service.',
    bookmarkedBy: [],
    createdAt: Date.now() - 2 * 86_400_000,
  },
  {
    id: 'seed-study-1',
    kind: 'BIBLE_STUDY',
    title: 'Outline: Lamps, Pitchers & Trumpets (Judges 7)',
    speaker: 'Bible Study Unit',
    scriptureRef: 'Judges 7:15-22',
    duration: '15 min study',
    body: '1. The Pitcher represents the fragile human vessel (2 Cor 4:7).\n2. The Torch represents the indwelling light of Christ.\n3. Breaking the pitcher symbolizes surrender so God’s glory shines.\n4. The Trumpet symbolizes bold proclamation of the Gospel.',
    bookmarkedBy: [],
    createdAt: Date.now() - 3 * 86_400_000,
  },
];

export const CANONICAL_66_BOOKS: { book: string; sample: string }[] = [
  { book: 'Genesis', sample: 'In the beginning God created the heaven and the earth.' },
  { book: 'Exodus', sample: 'The LORD shall fight for you, and ye shall hold your peace.' },
  { book: 'Leviticus', sample: 'Ye shall be holy: for I the LORD your God am holy.' },
  { book: 'Numbers', sample: 'The LORD bless thee, and keep thee.' },
  { book: 'Deuteronomy', sample: 'Hear, O Israel: The LORD our God is one LORD.' },
  { book: 'Joshua', sample: 'Be strong and of a good courage; the LORD thy God is with thee.' },
  { book: 'Judges', sample: 'The LORD is with thee, thou mighty man of valour.' },
  { book: 'Ruth', sample: 'Whither thou goest, I will go; thy God my God.' },
  { book: '1 Samuel', sample: 'Speak, LORD; for thy servant heareth.' },
  { book: '2 Samuel', sample: 'As for God, his way is perfect; the word of the LORD is tried.' },
  { book: '1 Kings', sample: 'The LORD our God be with us, as he was with our fathers.' },
  { book: '2 Kings', sample: 'Fear not: for they that be with us are more than they that be with them.' },
  { book: '1 Chronicles', sample: 'Thine, O LORD, is the greatness, and the power, and the glory.' },
  { book: '2 Chronicles', sample: 'If my people, which are called by my name, shall humble themselves and pray.' },
  { book: 'Ezra', sample: 'For the hand of our God is upon all them for good that seek him.' },
  { book: 'Nehemiah', sample: 'The joy of the LORD is your strength.' },
  { book: 'Esther', sample: 'Who knoweth whether thou art come to the kingdom for such a time as this?' },
  { book: 'Job', sample: 'I know that my redeemer liveth.' },
  { book: 'Psalms', sample: 'The LORD is my shepherd; I shall not want.' },
  { book: 'Proverbs', sample: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding.' },
  { book: 'Ecclesiastes', sample: 'Remember now thy Creator in the days of thy youth.' },
  { book: 'Song of Solomon', sample: 'Many waters cannot quench love, neither can the floods drown it.' },
  { book: 'Isaiah', sample: 'They that wait upon the LORD shall renew their strength.' },
  { book: 'Jeremiah', sample: 'For I know the thoughts that I think toward you, saith the LORD, thoughts of peace.' },
  { book: 'Lamentations', sample: 'It is of the LORDs mercies that we are not consumed; great is thy faithfulness.' },
  { book: 'Ezekiel', sample: 'I sought for a man among them, that should make up the hedge, and stand in the gap.' },
  { book: 'Daniel', sample: 'The people that do know their God shall be strong, and do exploits.' },
  { book: 'Hosea', sample: 'Then shall we know, if we follow on to know the LORD.' },
  { book: 'Joel', sample: 'I will pour out my spirit upon all flesh; your sons and daughters shall prophesy.' },
  { book: 'Amos', sample: 'Let judgment run down as waters, and righteousness as a mighty stream.' },
  { book: 'Obadiah', sample: 'Upon mount Zion shall be deliverance, and there shall be holiness.' },
  { book: 'Jonah', sample: 'Salvation is of the LORD.' },
  { book: 'Micah', sample: 'Walk humbly with thy God.' },
  { book: 'Nahum', sample: 'The LORD is good, a strong hold in the day of trouble.' },
  { book: 'Habakkuk', sample: 'The earth shall be filled with the knowledge of the glory of the LORD.' },
  { book: 'Zephaniah', sample: 'The LORD thy God in the midst of thee is mighty; he will save.' },
  { book: 'Haggai', sample: 'The glory of this latter house shall be greater than of the former.' },
  { book: 'Zechariah', sample: 'Not by might, nor by power, but by my spirit, saith the LORD of hosts.' },
  { book: 'Malachi', sample: 'Unto you that fear my name shall the Sun of righteousness arise with healing.' },
  { book: 'Matthew', sample: 'Seek ye first the kingdom of God, and his righteousness.' },
  { book: 'Mark', sample: 'All things are possible to him that believeth.' },
  { book: 'Luke', sample: 'For with God nothing shall be impossible.' },
  { book: 'John', sample: 'For God so loved the world, that he gave his only begotten Son.' },
  { book: 'Acts', sample: 'Ye shall receive power, after that the Holy Ghost is come upon you.' },
  { book: 'Romans', sample: 'And we know that all things work together for good to them that love God.' },
  { book: '1 Corinthians', sample: 'Watch ye, stand fast in the faith, quit you like men, be strong.' },
  { book: '2 Corinthians', sample: 'Therefore if any man be in Christ, he is a new creature.' },
  { book: 'Galatians', sample: 'I am crucified with Christ: nevertheless I live.' },
  { book: 'Ephesians', sample: 'Be strong in the Lord, and in the power of his might.' },
  { book: 'Philippians', sample: 'I can do all things through Christ which strengtheneth me.' },
  { book: 'Colossians', sample: 'And whatsoever ye do, do it heartily, as to the Lord.' },
  { book: '1 Thessalonians', sample: 'Pray without ceasing. In every thing give thanks.' },
  { book: '2 Thessalonians', sample: 'But the Lord is faithful, who shall stablish you, and keep you from evil.' },
  { book: '1 Timothy', sample: 'Let no man despise thy youth; but be thou an example of the believers.' },
  { book: '2 Timothy', sample: 'Study to shew thyself approved unto God.' },
  { book: 'Titus', sample: 'In all things shewing thyself a pattern of good works.' },
  { book: 'Philemon', sample: 'The grace of our Lord Jesus Christ be with your spirit.' },
  { book: 'Hebrews', sample: 'Now faith is the substance of things hoped for, the evidence of things not seen.' },
  { book: 'James', sample: 'If any of you lack wisdom, let him ask of God.' },
  { book: '1 Peter', sample: 'Ye are a chosen generation, a royal priesthood, an holy nation.' },
  { book: '2 Peter', sample: 'Grow in grace, and in the knowledge of our Lord and Saviour Jesus Christ.' },
  { book: '1 John', sample: 'Greater is he that is in you, than he that is in the world.' },
  { book: '2 John', sample: 'Walk after his commandments.' },
  { book: '3 John', sample: 'Beloved, wish above all things that thou mayest prosper and be in health.' },
  { book: 'Jude', sample: 'Building up yourselves on your most holy faith, praying in the Holy Ghost.' },
  { book: 'Revelation', sample: 'Behold, I come quickly: blessed is he that keepeth the sayings of this book.' },
];

export function build66BookReferenceVerses(translation = 'KJV'): {
  reference: string;
  book: string;
  chapter: number;
  verse: number;
  text: string;
  translation: string;
}[] {
  const existingMap = new Map(BIBLE_VERSES.map((v) => [v.book.toLowerCase(), v]));
  return CANONICAL_66_BOOKS.map((entry) => {
    const match = existingMap.get(entry.book.toLowerCase());
    return {
      reference: match ? match.reference : `${entry.book} 1:1`,
      book: entry.book,
      chapter: match ? match.chapter : 1,
      verse: match ? match.verse : 1,
      text: match ? match.text : entry.sample,
      translation,
    };
  });
}
