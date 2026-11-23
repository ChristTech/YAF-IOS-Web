import {
  BIBLE_VERSES,
  SCRIPTURE_OF_THE_DAY_PRESETS,
  build66BookReferenceVerses,
  type BibleVerseItem,
} from '../data/bibleData';
import {
  DEFAULT_MINISTRY_AUTHOR,
  chunkStringForFirestore,
} from './fellowshipLogic';
import type {
  DailyScriptureDoc,
  LanguageCode,
  SpiritualResource,
  UploadedBibleDoc,
  UploadedBibleSection,
} from '../types/fellowship';

export type SpiritualCategoryFilter =
  | 'ALL'
  | 'SCRIPTURE_OF_THE_DAY'
  | 'SERMON'
  | 'DEVOTIONAL'
  | 'BIBLE_STUDY'
  | 'PRAYER_POINTS';

export type ExtendedSpiritualKind = Exclude<SpiritualCategoryFilter, 'ALL'>;

export interface MemoryVerseData {
  id: string;
  reference: string;
  verseText: string;
  speakerOrAuthor?: string;
  publishedAt: number;
}

export interface ExplorerVerseItem {
  id: string;
  reference: string;
  book: string;
  chapter: number;
  verse: number;
  text: string;
  translation: string;
  language: LanguageCode;
  theme: string;
  testament: 'Old Testament' | 'New Testament';
}

const LOCALIZED_MEMORY_VERSES: Record<
  string,
  Record<LanguageCode, string>
> = {
  '11:32': {
    EN: '...but the people that do know their God shall be strong, and do exploits.',
    YO: '...ṣùgbọ́n àwọn ènìyàn tí ó mọ Ọlọ́run wọn yóò lágbára, wọn yóò sì ṣe iṣẹ́ ìyanu.',
    HA: '...amma mutanen da suka san Allahn su za su yi ƙarfi, su yi manyan ayyuka.',
    IG: '...ma ndị maara Chineke ha ga-adị ike, mee ihe dị ukwuu.',
  },
  '6:12': {
    EN: 'The LORD is with thee, thou mighty man of valour.',
    YO: 'Olúwa wà pẹ̀lú rẹ, ìwọ alágbára akọni.',
    HA: 'Ubangiji yana tare da kai, ya kai jarumi mai ƙarfi.',
    IG: 'Onyenwe anyị nọnyeere gị, gị dike dị ike.',
  },
  '4:13': {
    EN: 'I can do all things through Christ which strengtheneth me.',
    YO: 'Èmi lè ṣe ohun gbogbo nípa Kristi tí ó ń fún mi ní agbára.',
    HA: 'Zan iya yin kome ta wurin Almasihu wanda ke ƙarfafa ni.',
    IG: 'Apụrụ m ime ihe niile site na Kraịst onye na-enye m ike.',
  },
  '4:12': {
    EN: 'Let no man despise thy youth; but be thou an example of the believers, in word, in conversation, in charity, in spirit, in faith, in purity.',
    YO: 'Má ṣe jẹ́ kí ẹnikẹ́ni tẹ́ńbẹ́lú ìgbà èwe rẹ; ṣùgbọ́n jẹ́ àpẹẹrẹ fún àwọn onígbàgbọ́ ní ọ̀rọ̀, ní ìwà, ní ìfẹ́, ní ẹ̀mí, ní ìgbàgbọ́, àti ní ìwà mímọ́.',
    HA: 'Kada kowa ya raina ƙuruciyarka; amma ka zama abin koyi ga masu bi a magana, da hali, da ƙauna, da ruhu, da bangaskiya, da tsarki.',
    IG: 'Ekwela ka onye ọ bụla leda ntorobịa gị anya; kama bụrụ ihe nlereanya nye ndị kwere ekwe n’okwu, n’omume, n’ịhụnanya, n’ime mmụọ, n’okwukwe, na n’ịdị ọcha.',
  },
  '1:9': {
    EN: 'Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.',
    YO: 'Jẹ́ alágbára kí o sì ní ìgboyà; má bẹ̀rù, má sì jẹ́ kí àyà rẹ ó fò: nítorí Olúwa Ọlọ́run rẹ wà pẹ̀lú rẹ ní ibikíbi tí ìwọ bá ń lọ.',
    HA: 'Ka yi ƙarfi ka ƙarfafa zuciyarka; kada ka ji tsoro, kada ka karaya: domin Ubangiji Allahnka yana tare da kai duk inda ka je.',
    IG: 'Dị ike nwee obi ike; atụla egwu, emela ka obi lọọ gị mmiri: n’ihi na Onyenwe anyị Chineke gị nọnyeere gị n’ebe ọ bụla ị na-aga.',
  },
  '40:31': {
    EN: 'But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.',
    YO: 'Ṣùgbọ́n àwọn tí ó dúró de Olúwa yóò tún agbára wọn ṣe; wọn yóò fò sókè pẹ̀lú ìyẹ́ bí idì; wọn yóò sáré, wọn kì yóò sì rẹ̀; wọn yóò rìn, wọn kì yóò sì dákú.',
    HA: 'Amma waɗanda suke dogara ga Ubangiji za su sabunta ƙarfinsu; za su tashi sama da fuka-fuki kamar gaggafa; za su yi gudu ba za su gaji ba; za su yi tafiya ba za su suma ba.',
    IG: 'Ma ndị na-eche Onyenwe anyị ga-eme ka ike ha dị ọhụrụ; ha ga-efe elu n’ikuku dị ka ugo; ha ga-agba ọsọ ma ike agaghị agwụ ha; ha ga-eje ije ma ha agaghị ada mbà.',
  },
};

export function getMemoryVerse(
  reference: string,
  rawVerse: string,
  activeLang: LanguageCode
): string {
  const refClean = (reference || '').trim().toLowerCase();
  const matchedKey = Object.keys(LOCALIZED_MEMORY_VERSES).find((key) =>
    refClean.includes(key)
  );
  if (matchedKey) {
    const entry = LOCALIZED_MEMORY_VERSES[matchedKey];
    if (activeLang === 'EN' && rawVerse.trim()) {
      return rawVerse.trim();
    }
    return entry[activeLang] || rawVerse.trim() || entry.EN;
  }
  return (
    rawVerse.trim() ||
    '...but the people that do know their God shall be strong, and do exploits.'
  );
}

export function maskMemoryVerseText(text: string): string {
  const trimmed = (text || '').trim();
  if (!trimmed) return '[ ? ? ? ]';
  const words = trimmed.split(/\s+/);
  if (words.length <= 3) {
    return '[ ? ? ? ]';
  }
  const lastIndex = words.length - 1;
  return words
    .map((word, index) => {
      const alphaNum = word.replace(/[^a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF]/g, '');
      if (alphaNum.length >= 4 && (index % 3 === 2 || index === lastIndex)) {
        const trailingPunctMatch = word.match(/[.,;:!?"'”’]+$/);
        const leadingPunctMatch = word.match(/^["'“‘(]+/);
        const prefix = leadingPunctMatch ? leadingPunctMatch[0] : '';
        const suffix = trailingPunctMatch ? trailingPunctMatch[0] : '';
        return `${prefix}____${suffix}`;
      }
      return word;
    })
    .join(' ');
}

export function extractSpiritualMemoryVerse(
  docs: DailyScriptureDoc[],
  activeLang: LanguageCode = 'EN'
): MemoryVerseData {
  const candidates: {
    id: string;
    reference: string;
    rawVerse: string;
    speakerOrAuthor?: string;
    publishedAt: number;
  }[] = [];

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

    let meta: Record<string, unknown> | null = null;
    const rawPrompt = (d.prayerPromptEn || '').trim();
    if (rawPrompt.startsWith('{')) {
      try {
        meta = JSON.parse(rawPrompt) as Record<string, unknown>;
      } catch {
        meta = null;
      }
    }

    const metaCat = String(meta?.category || '').toUpperCase();
    const metaKind = String(meta?.kind || '').toUpperCase();
    const isScriptureOfDay =
      metaCat === 'SCRIPTURE_OF_THE_DAY' ||
      (!metaCat &&
        !metaKind &&
        d.type !== 'SERMON' &&
        d.type !== 'DEVOTIONAL' &&
        d.type !== 'BIBLE_STUDY' &&
        d.type !== 'PRAYER_POINTS' &&
        !d.id.startsWith('scripture_res_'));

    if (!isScriptureOfDay) continue;

    const ref = (d.referenceEn || d.reference || 'Daniel 11:32b').trim();
    const rawVerse = (
      d.verseTextEn ||
      d.verseText ||
      (typeof meta?.summary === 'string' ? meta.summary : '') ||
      ''
    ).trim();
    const publishedAt =
      typeof meta?.publishedAt === 'number' && meta.publishedAt > 0
        ? meta.publishedAt
        : d.createdAt || 0;

    candidates.push({
      id: d.id,
      reference: ref,
      rawVerse,
      speakerOrAuthor: (d.authorName || String(meta?.speaker || '')).trim() || undefined,
      publishedAt,
    });
  }

  candidates.sort((a, b) => b.publishedAt - a.publishedAt);

  if (candidates.length === 0) {
    return {
      id: 'default-memory-daniel-11-32b',
      reference: 'Daniel 11:32b',
      verseText: getMemoryVerse(
        'Daniel 11:32b',
        '...but the people that do know their God shall be strong, and do exploits.',
        activeLang
      ),
      publishedAt: 0,
    };
  }

  const newest = candidates[0];
  return {
    id: newest.id,
    reference: newest.reference,
    verseText: getMemoryVerse(newest.reference, newest.rawVerse, activeLang),
    speakerOrAuthor: newest.speakerOrAuthor,
    publishedAt: newest.publishedAt,
  };
}

export function extractScriptureOfTheDayResources(
  docs: DailyScriptureDoc[]
): (SpiritualResource & { category: ExtendedSpiritualKind })[] {
  const result: (SpiritualResource & { category: ExtendedSpiritualKind })[] = [];

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

    let meta: Record<string, unknown> | null = null;
    if ((d.prayerPromptEn || '').trim().startsWith('{')) {
      try {
        meta = JSON.parse(d.prayerPromptEn) as Record<string, unknown>;
      } catch {
        meta = null;
      }
    }

    const metaCat = String(meta?.category || meta?.kind || '').toUpperCase();
    if (metaCat === 'BIBLE_DOCUMENT' || metaCat === 'BIBLE_VERSE_PACK') continue;
    if (metaCat !== 'SCRIPTURE_OF_THE_DAY') continue;

    const joinedReflections = [d.reflectionEn, d.reflectionYo, d.reflectionHa, d.reflectionIg]
      .filter((part): part is string => typeof part === 'string' && part.length > 0)
      .join('');

    const ref = (d.referenceEn || d.reference || 'Daniel 11:32b').trim();
    const verse = (d.verseTextEn || d.verseText || '').trim();
    const title = String(meta?.title || `Scripture for the Day • ${ref}`);
    const speaker = String(meta?.speaker || d.authorName || DEFAULT_MINISTRY_AUTHOR);
    const body = joinedReflections || verse || String(meta?.summary || '');

    result.push({
      id: d.id,
      kind: 'DEVOTIONAL',
      category: 'SCRIPTURE_OF_THE_DAY',
      title,
      speaker,
      scriptureRef: ref,
      duration: 'Daily Memory',
      audioDurationMinutes: Number(meta?.audioDurationMinutes) || 0,
      summary: String(meta?.summary || verse).slice(0, 220),
      body,
      bookmarkedBy: Array.isArray(meta?.bookmarkedBy)
        ? (meta.bookmarkedBy as string[])
        : [],
      createdAt: Number(meta?.publishedAt) || d.createdAt || 0,
    });
  }

  return result;
}

export function chunkSpeechText(text: string, maxChunkLen = 220): string[] {
  const normalized = (text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return [];

  const sentenceTokens = normalized
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let buffer = '';

  const flush = () => {
    if (buffer.trim()) {
      chunks.push(buffer.trim());
      buffer = '';
    }
  };

  for (const sentence of sentenceTokens) {
    if (sentence.length > maxChunkLen) {
      flush();
      const words = sentence.split(' ');
      let part = '';
      for (const w of words) {
        const candidate = part ? `${part} ${w}` : w;
        if (candidate.length > maxChunkLen && part) {
          chunks.push(part);
          part = w;
        } else {
          part = candidate;
        }
      }
      if (part) chunks.push(part);
      continue;
    }

    const candidate = buffer ? `${buffer} ${sentence}` : sentence;
    if (candidate.length > maxChunkLen && buffer) {
      flush();
      buffer = sentence;
    } else {
      buffer = candidate;
    }
  }
  flush();
  return chunks;
}

export function getSpeechLangTag(lang: LanguageCode): string {
  switch (lang) {
    case 'YO':
      return 'yo-NG';
    case 'HA':
      return 'ha-NG';
    case 'IG':
      return 'ig-NG';
    default:
      return 'en-US';
  }
}

export function getSpeechLangFallbackTags(lang: LanguageCode): string[] {
  switch (lang) {
    case 'YO':
      return ['yo-NG', 'yo', 'en-NG', 'en-GB', 'en-US'];
    case 'HA':
      return ['ha-NG', 'ha', 'en-NG', 'en-GB', 'en-US'];
    case 'IG':
      return ['ig-NG', 'ig', 'en-NG', 'en-GB', 'en-US'];
    default:
      return ['en-NG', 'en-US', 'en-GB', 'en'];
  }
}

export function createDefaultKjvBibleEdition(): UploadedBibleDoc {
  const otSections = BIBLE_VERSES.filter((v) => v.testament === 'Old Testament')
    .map((v) => `${v.reference} (${v.theme}) — "${v.text}"`)
    .join('\n\n');
  const ntSections = BIBLE_VERSES.filter((v) => v.testament === 'New Testament')
    .map((v) => `${v.reference} (${v.theme}) — "${v.text}"`)
    .join('\n\n');
  const canonical66 = build66BookReferenceVerses('KJV')
    .map((v) => `${v.reference} — ${v.text}`)
    .join('\n');

  const sections: UploadedBibleSection[] = [
    {
      title: 'Old Testament Key Youth Scriptures (KJV)',
      content: otSections,
    },
    {
      title: 'New Testament Key Youth Scriptures (KJV)',
      content: ntSections,
    },
    {
      title: '66-Book Canonical Quick Reference Index',
      content: canonical66,
    },
  ];

  return {
    id: 'bdoc_default_kjv',
    title: 'Gideonites KJV Executive Reference Bible',
    version: 'KJV',
    translation: 'KJV',
    format: 'EPUB',
    fileFormat: 'EPUB',
    fileName: 'gideonites-kjv-executive-reference.epub',
    fileSizeKb: 48,
    pageOrChapterCount: sections.length,
    extractedVersesCount: 66 + BIBLE_VERSES.length,
    sections,
    contentText: sections.map((s) => `${s.title}\n\n${s.content}`).join('\n\n---\n\n'),
    uploadedBy: 'The Gideonites Fellowship',
    createdAt: 1_700_000_000_000,
  };
}

export function mergeBibleEditionsWithDefault(
  uploadedBibles: UploadedBibleDoc[]
): UploadedBibleDoc[] {
  const hasDefault = uploadedBibles.some((b) => b.id === 'bdoc_default_kjv');
  if (hasDefault) return uploadedBibles;
  return [createDefaultKjvBibleEdition(), ...uploadedBibles];
}

const LANGUAGE_EXPLORER_VERSES: ExplorerVerseItem[] = [
  ...SCRIPTURE_OF_THE_DAY_PRESETS.flatMap((preset): ExplorerVerseItem[] => {
    const book = preset.reference.replace(/\s+\d+:.*$/, '').trim();
    const match = preset.reference.match(/(\d+):(\d+)/);
    const chapter = match ? Number(match[1]) : 1;
    const verse = match ? Number(match[2]) : 1;
    const isNt = /^(1\s*Timothy|Matthew|John|Acts|Romans|Ephesians|Philippians|Hebrews)/i.test(
      book
    );
    const langs: { code: LanguageCode; translation: string }[] = [
      { code: 'YO', translation: 'Bibeli Mimo (YO)' },
      { code: 'HA', translation: 'Littafi Mai Tsarki (HA)' },
      { code: 'IG', translation: 'Baịbụl Nsọ (IG)' },
    ];
    return langs.map((l) => ({
      id: `lang-${l.code.toLowerCase()}-${preset.reference.replace(/[^a-z0-9]/gi, '-')}`,
      reference: preset.reference,
      book,
      chapter,
      verse,
      text: preset.translations[l.code],
      translation: l.translation,
      language: l.code,
      theme: 'Kingdom Identity & Exploits',
      testament: isNt ? 'New Testament' : 'Old Testament',
    }));
  }),
];

export function extractBiblePackVerses(
  docs: DailyScriptureDoc[]
): ExplorerVerseItem[] {
  const items: ExplorerVerseItem[] = [];
  for (const d of docs) {
    if (!d.id) continue;
    let meta: Record<string, unknown> | null = null;
    if ((d.prayerPromptEn || '').trim().startsWith('{')) {
      try {
        meta = JSON.parse(d.prayerPromptEn) as Record<string, unknown>;
      } catch {
        meta = null;
      }
    }
    const metaCat = String(meta?.category || '').toUpperCase();
    if (
      !d.id.startsWith('scripture_biblepack_') &&
      d.dateKey !== 'BIBLE_PACK' &&
      metaCat !== 'BIBLE_VERSE_PACK'
    ) {
      continue;
    }

    const joined = [d.reflectionEn, d.reflectionYo, d.reflectionHa, d.reflectionIg]
      .filter((s): s is string => typeof s === 'string' && s.length > 0)
      .join('');
    try {
      const parsed = JSON.parse(joined) as Record<string, unknown>[];
      if (!Array.isArray(parsed)) continue;
      parsed.forEach((v, idx) => {
        const text = String(v.text || v.verseText || v.v || '').trim();
        if (!text) return;
        const rawRef = String(v.reference || v.r || '').trim();
        const refMatch = rawRef.match(/^([1-3]?\s*[A-Za-z]+(?:\s+[A-Za-z]+)*)\s+(\d+):(\d+)/);
        const book = String(v.book || (refMatch ? refMatch[1].trim() : 'Genesis')).trim();
        const chapter = Number(v.chapter) || (refMatch ? Number(refMatch[2]) : 1);
        const verse = Number(v.verse) || (refMatch ? Number(refMatch[3]) : 1);
        const translation = String(v.translation || v.t || meta?.translation || 'KJV').trim();
        const theme = String(v.theme || v.m || 'Uploaded Bible Edition').trim();
        const isNt =
          /^(Matthew|Mark|Luke|John|Acts|Romans|1\s*Cor|2\s*Cor|Galatians|Ephesians|Philippians|Colossians|1\s*Thess|2\s*Thess|1\s*Tim|2\s*Tim|Titus|Philemon|Hebrews|James|1\s*Pet|2\s*Pet|1\s*John|2\s*John|3\s*John|Jude|Revelation)/i.test(
            book
          );
        const language: LanguageCode = translation.includes('(YO)')
          ? 'YO'
          : translation.includes('(HA)')
          ? 'HA'
          : translation.includes('(IG)')
          ? 'IG'
          : 'EN';
        items.push({
          id: `${d.id}_${idx}`,
          reference: rawRef || `${book} ${chapter}:${verse}`,
          book,
          chapter,
          verse,
          text,
          translation,
          language,
          theme,
          testament: isNt ? 'New Testament' : 'Old Testament',
        });
      });
    } catch {
      // ignore malformed JSON chunk
    }
  }
  return items;
}

export function buildAllExplorerVerses(
  docs: DailyScriptureDoc[]
): ExplorerVerseItem[] {
  const baseEn: ExplorerVerseItem[] = BIBLE_VERSES.map((v) => ({
    id: v.id,
    reference: v.reference,
    book: v.book,
    chapter: v.chapter,
    verse: v.verse,
    text: v.text,
    translation: 'KJV',
    language: 'EN',
    theme: v.theme,
    testament: v.testament,
  }));

  const canonical66 = build66BookReferenceVerses('KJV')
    .filter(
      (c) =>
        !baseEn.some(
          (b) => b.book.toLowerCase() === c.book.toLowerCase() && b.chapter === c.chapter && b.verse === c.verse
        )
    )
    .map((c, idx): ExplorerVerseItem => ({
      id: `canon-${idx}-${c.book.toLowerCase().replace(/\s+/g, '-')}`,
      reference: c.reference,
      book: c.book,
      chapter: c.chapter,
      verse: c.verse,
      text: c.text,
      translation: c.translation,
      language: 'EN',
      theme: '66-Book Canonical',
      testament: idx < 39 ? 'Old Testament' : 'New Testament',
    }));

  const remotePackVerses = extractBiblePackVerses(docs);

  const seen = new Set<string>();
  const combined: ExplorerVerseItem[] = [];
  for (const item of [
    ...remotePackVerses,
    ...baseEn,
    ...LANGUAGE_EXPLORER_VERSES,
    ...canonical66,
  ]) {
    const key = `${item.translation.toLowerCase()}|${item.reference.toLowerCase()}|${item.language}`;
    if (!seen.has(key)) {
      seen.add(key);
      combined.push(item);
    }
  }
  return combined;
}

export function filterExplorerVerses(
  allVerses: ExplorerVerseItem[],
  options: {
    activeLanguage: LanguageCode;
    filterByActiveLanguage: boolean;
    selectedTranslation: string;
    selectedTheme: string;
    searchQuery: string;
  }
): { verses: ExplorerVerseItem[]; fellBackToAllLanguages: boolean } {
  const q = options.searchQuery.trim().toLowerCase();

  const applyCommon = (list: ExplorerVerseItem[]) =>
    list.filter((v) => {
      if (
        options.selectedTranslation !== 'ALL' &&
        v.translation !== options.selectedTranslation
      ) {
        return false;
      }
      if (options.selectedTheme !== 'ALL' && v.theme !== options.selectedTheme) {
        return false;
      }
      if (!q) return true;
      return (
        v.reference.toLowerCase().includes(q) ||
        v.book.toLowerCase().includes(q) ||
        v.text.toLowerCase().includes(q) ||
        v.theme.toLowerCase().includes(q) ||
        v.translation.toLowerCase().includes(q)
      );
    });

  if (options.filterByActiveLanguage) {
    const langMatches = applyCommon(
      allVerses.filter((v) => v.language === options.activeLanguage)
    );
    if (langMatches.length > 0) {
      return { verses: langMatches, fellBackToAllLanguages: false };
    }
    // Fall back gracefully when zero matches exist in the active language
    return { verses: applyCommon(allVerses), fellBackToAllLanguages: true };
  }

  return { verses: applyCommon(allVerses), fellBackToAllLanguages: false };
}

export const AUDIO_SLICE_BYTES = 450_000;
export const MAX_AUDIO_FILE_BYTES = 24 * 1024 * 1024;
export const MAX_AUDIO_CHUNKS = 500;
export const MAX_BASE64_CHUNK_CHARS = 700_000;
export const MAX_PRAYER_PROMPT_JSON_CHARS = 980;

export function generateAudioCloudId(): string {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `sa_${hex}`;
}

export const VALID_AUDIO_EXTENSIONS = new Set([
  'mp3',
  'm4a',
  'aac',
  'wav',
  'ogg',
  'oga',
  'opus',
  'flac',
  '3gp',
  'amr',
  'wma',
  'm4b',
  'mpga',
  'mpeg',
  'mp4',
  'webm',
]);

export const AMBIGUOUS_AUDIO_EXTENSIONS = new Set(['mp4', 'webm']);

export const NON_AUDIO_FILE_EXTENSIONS = new Set([
  'pdf',
  'epub',
  'txt',
  'doc',
  'docx',
  'rtf',
  'odt',
  'csv',
  'json',
  'xml',
  'html',
  'htm',
  'md',
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'svg',
  'bmp',
  'heic',
  'zip',
  'rar',
  '7z',
  'tar',
  'gz',
  'apk',
  'exe',
  'dmg',
  'iso',
]);

export function getFileExtensionLower(fileName: string): string {
  const clean = (fileName || '').trim().toLowerCase();
  const lastDot = clean.lastIndexOf('.');
  if (lastDot < 0 || lastDot === clean.length - 1) return '';
  return clean.slice(lastDot + 1);
}

export function formatNonAudioRejectionMessage(fileName: string): string {
  return `'${fileName || 'Selected file'}' is not an audio file. Please select an MP3, M4A, AAC, WAV, OGG, or Voice Recording.`;
}

export function isKnownNonAudioFile(fileName: string, mimeType?: string): boolean {
  const ext = getFileExtensionLower(fileName);
  if (ext && NON_AUDIO_FILE_EXTENSIONS.has(ext)) return true;
  const mime = (mimeType || '').trim().toLowerCase();
  if (!mime) return false;
  return (
    mime.startsWith('image/') ||
    mime.startsWith('text/') ||
    mime === 'application/pdf' ||
    mime === 'application/epub+zip' ||
    mime === 'application/zip' ||
    mime === 'application/x-zip-compressed' ||
    mime === 'application/vnd.android.package-archive' ||
    mime === 'application/msword' ||
    mime.startsWith('application/vnd.openxmlformats-officedocument')
  );
}

export function isAudioFileCandidate(file: { name: string; type?: string }): boolean {
  if (!file || isKnownNonAudioFile(file.name, file.type)) return false;
  const ext = getFileExtensionLower(file.name);
  const mime = (file.type || '').trim().toLowerCase();
  return (
    (Boolean(ext) && VALID_AUDIO_EXTENSIONS.has(ext)) ||
    mime.startsWith('audio/') ||
    mime === 'application/ogg'
  );
}

export function isAmbiguousAudioFile(file: { name: string; type?: string }): boolean {
  if (!file) return false;
  const ext = getFileExtensionLower(file.name);
  const mime = (file.type || '').trim().toLowerCase();
  if (AMBIGUOUS_AUDIO_EXTENSIONS.has(ext)) return true;
  if (mime === 'video/mp4' || mime === 'video/webm') return true;
  if (!ext || !VALID_AUDIO_EXTENSIONS.has(ext)) {
    return (
      mime === '' ||
      mime === 'application/octet-stream' ||
      mime === 'application/ogg' ||
      mime.startsWith('audio/')
    );
  }
  return false;
}

export function inferAudioMimeType(fileName: string, rawType?: string): string {
  const mime = (rawType || '').trim().toLowerCase();
  if (mime.startsWith('audio/')) {
    return mime;
  }
  if (mime === 'application/ogg') {
    return 'audio/ogg';
  }
  const ext = getFileExtensionLower(fileName);
  switch (ext) {
    case 'mp3':
    case 'mpga':
    case 'mpeg':
      return 'audio/mpeg';
    case 'm4a':
    case 'm4b':
    case 'mp4':
      return 'audio/mp4';
    case 'aac':
      return 'audio/aac';
    case 'wav':
      return 'audio/wav';
    case 'ogg':
    case 'oga':
    case 'opus':
      return 'audio/ogg';
    case 'flac':
      return 'audio/flac';
    case '3gp':
      return 'audio/3gpp';
    case 'amr':
      return 'audio/amr';
    case 'wma':
      return 'audio/x-ms-wma';
    case 'webm':
      return 'audio/webm';
    default:
      return 'audio/mpeg';
  }
}

export function validateAudioSermonFile(file: {
  name: string;
  size: number;
  type?: string;
}): { ok: true; ambiguous: boolean; inferredMimeType: string } | { ok: false; error: string } {
  if (!file || typeof file.size !== 'number' || file.size <= 0) {
    return {
      ok: false,
      error:
        'The selected audio file is empty (0 bytes). Please choose a valid MP3, M4A, AAC, WAV, OGG, or Voice Recording.',
    };
  }
  if (file.size > MAX_AUDIO_FILE_BYTES) {
    return {
      ok: false,
      error:
        'Audio file exceeds the 24 MB limit. Please upload a compressed MP3, M4A, or AAC file under 24 MB.',
    };
  }
  const expectedChunks = Math.ceil(file.size / AUDIO_SLICE_BYTES);
  if (expectedChunks > MAX_AUDIO_CHUNKS) {
    return {
      ok: false,
      error: `Audio file requires ${expectedChunks} chunks (max ${MAX_AUDIO_CHUNKS}). Please upload a smaller recording under 24 MB.`,
    };
  }

  if (isKnownNonAudioFile(file.name, file.type)) {
    return {
      ok: false,
      error: formatNonAudioRejectionMessage(file.name),
    };
  }

  const ext = getFileExtensionLower(file.name);
  const mime = (file.type || '').trim().toLowerCase();
  const hasAllowedExt = Boolean(ext) && VALID_AUDIO_EXTENSIONS.has(ext);
  const hasAllowedMime =
    mime.startsWith('audio/') ||
    mime === 'application/ogg' ||
    mime === 'video/mp4' ||
    mime === 'video/webm' ||
    mime === 'application/octet-stream';

  if (!hasAllowedExt && !hasAllowedMime) {
    return {
      ok: false,
      error: formatNonAudioRejectionMessage(file.name),
    };
  }

  return {
    ok: true,
    ambiguous: isAmbiguousAudioFile(file),
    inferredMimeType: inferAudioMimeType(file.name, file.type),
  };
}

export function encodeUint8ArrayToPureBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
  }
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    const slice = bytes.subarray(i, Math.min(i + step, bytes.length));
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

export function decodeBase64ChunkToUint8Array(dataBase64: string): Uint8Array {
  const clean = (dataBase64 || '')
    .replace(/^data:[^;]+;base64,/, '')
    .replace(/\s+/g, '');
  if (!clean) return new Uint8Array(0);
  if (typeof Buffer !== 'undefined' && typeof atob !== 'function') {
    const buf = Buffer.from(clean, 'base64');
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  const binary = atob(clean);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export function sliceAudioBytesToChunkBase64(
  bytes: Uint8Array,
  sliceBytes: number = AUDIO_SLICE_BYTES
): string[] {
  if (!bytes || bytes.length === 0) {
    throw new Error('Audio recording is empty (0 bytes).');
  }
  if (bytes.length > MAX_AUDIO_FILE_BYTES) {
    throw new Error(
      'Audio file exceeds the 24 MB limit. Please upload a compressed MP3, M4A, or AAC file under 24 MB.'
    );
  }
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += sliceBytes) {
    const slice = bytes.subarray(offset, Math.min(offset + sliceBytes, bytes.length));
    const encoded = encodeUint8ArrayToPureBase64(slice);
    if (encoded.length >= MAX_BASE64_CHUNK_CHARS) {
      throw new Error('Encoded audio chunk exceeded Firestore limit. Please use a smaller file.');
    }
    chunks.push(encoded);
  }
  if (chunks.length > MAX_AUDIO_CHUNKS) {
    throw new Error(`Audio file exceeds ${MAX_AUDIO_CHUNKS} chunk limit.`);
  }
  return chunks;
}

export function combineDecodedChunksToBlob(
  chunks: Array<{ chunkIndex: number; dataBase64: string }>,
  mimeType = 'audio/mpeg'
): Blob {
  const sorted = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
  const decodedParts: BlobPart[] = sorted.map((chunk) => {
    const u8 = decodeBase64ChunkToUint8Array(chunk.dataBase64);
    const copy = new Uint8Array(u8.byteLength);
    copy.set(u8);
    return copy.buffer;
  });
  return new Blob(decodedParts, { type: mimeType || 'audio/mpeg' });
}

export function computeAudioDurationMinutes(durationSeconds: number): number {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0;
  return Math.max(1, Math.ceil(durationSeconds / 60));
}

export function formatAudioDurationMMSS(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const totalSec = Math.floor(seconds);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatFileSizeMB(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function hasPlayableAudioSermon(
  resource: Pick<SpiritualResource, 'audioCloudId' | 'audioChunkCount'> | null | undefined
): boolean {
  if (!resource) return false;
  return Boolean(
    typeof resource.audioCloudId === 'string' &&
      resource.audioCloudId.trim().length > 0 &&
      (resource.audioChunkCount || 0) > 0
  );
}

export function findLatestActiveAudioCloudId(
  resources: Array<Pick<SpiritualResource, 'audioCloudId' | 'audioChunkCount' | 'createdAt'>>
): string | null {
  const playable = resources
    .filter((r) => hasPlayableAudioSermon(r))
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return playable[0]?.audioCloudId?.trim() || null;
}

export function sanitizeSpiritualDisplayText(
  rawText?: string,
  fallbackText = ''
): string {
  const text = (rawText || '').trim();
  if (!text) return fallbackText;
  const sample = text.slice(0, 400);
  // Detect binary MP3/ID3 payloads or control/replacement character dumps saved by older text importers
  // eslint-disable-next-line no-control-regex
  const controlMatches = sample.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD]/g);
  const controlCount = controlMatches ? controlMatches.length : 0;
  if (
    /^ID3[\u0000-\u001F]/u.test(sample) ||
    sample.includes('\u0000') ||
    controlCount >= 3
  ) {
    return fallbackText;
  }
  return text;
}

export function buildCappedPrayerPromptJson(
  payload: Record<string, unknown>,
  maxChars: number = MAX_PRAYER_PROMPT_JSON_CHARS
): string {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (v !== undefined) {
      clean[k] = v;
    }
  }

  let json = JSON.stringify(clean);
  if (json.length <= maxChars) return json;

  const copy: Record<string, unknown> = { ...clean };
  if (typeof copy.summary === 'string') {
    const excess = json.length - maxChars;
    copy.summary = copy.summary.slice(0, Math.max(0, copy.summary.length - excess - 12));
  }
  json = JSON.stringify(copy);
  if (json.length <= maxChars) return json;

  copy.summary = '';
  json = JSON.stringify(copy);
  if (json.length <= maxChars) return json;

  if (typeof copy.title === 'string' && copy.title.length > 60) {
    copy.title = copy.title.slice(0, 60);
  }
  json = JSON.stringify(copy);
  if (json.length <= maxChars) return json;

  if (typeof copy.audioFileName === 'string' && copy.audioFileName.length > 48) {
    copy.audioFileName = copy.audioFileName.slice(0, 48);
  }
  json = JSON.stringify(copy);
  if (json.length <= maxChars) return json;

  if (Array.isArray(copy.bookmarkedBy) && copy.bookmarkedBy.length > 10) {
    copy.bookmarkedBy = copy.bookmarkedBy.slice(-10);
  }
  json = JSON.stringify(copy);
  if (json.length <= maxChars) return json;

  if (typeof copy.speaker === 'string' && copy.speaker.length > 32) {
    copy.speaker = copy.speaker.slice(0, 32);
  }
  if (typeof copy.title === 'string' && copy.title.length > 36) {
    copy.title = copy.title.slice(0, 36);
  }
  return JSON.stringify(copy);
}

export function buildSpiritualResourceFirestorePayload(params: {
  authorId: string;
  authorName: string;
  category: ExtendedSpiritualKind;
  title: string;
  speaker: string;
  scriptureRef: string;
  summary: string;
  body: string;
  audioDurationMinutes: number;
  audioCloudId?: string;
  audioFileName?: string;
  audioMimeType?: string;
  audioSizeBytes?: number;
  audioChunkCount?: number;
  bookmarkedBy?: string[];
  publishedAt?: number;
}): Record<string, unknown> {
  const now = params.publishedAt || Date.now();
  const refClean = (params.scriptureRef || 'Psalm 119:105').trim().slice(0, 120);
  const titleClean = (
    params.category === 'SCRIPTURE_OF_THE_DAY'
      ? `Scripture for the Day • ${refClean}`
      : params.title
  ).trim();
  const speakerClean = (params.speaker || params.authorName || DEFAULT_MINISTRY_AUTHOR).trim();
  const hasAudio = Boolean(
    params.category === 'SERMON' &&
      params.audioCloudId &&
      params.audioCloudId.trim().length > 0 &&
      (params.audioChunkCount || 0) > 0
  );
  const audioFallbackText =
    hasAudio && params.audioFileName
      ? `Audio Sermon • ${params.audioFileName}`
      : titleClean;
  const bodyClean = params.body.trim() || (hasAudio ? audioFallbackText : '');
  const summaryClean = (
    params.summary.trim() ||
    (hasAudio && !params.body.trim() ? audioFallbackText : bodyClean.slice(0, 180))
  ).trim();
  const audioMins = Math.max(0, Number(params.audioDurationMinutes) || 0);
  const durationLabel =
    params.category === 'SCRIPTURE_OF_THE_DAY'
      ? 'Daily Memory'
      : params.category === 'SERMON' && audioMins > 0
      ? `${audioMins} min audio`
      : audioMins > 0
      ? `${audioMins} min audio`
      : '5 min read';

  const fullTextForChunks =
    params.category === 'SCRIPTURE_OF_THE_DAY'
      ? `${bodyClean}\n\nGideonites Youth Charge:\n${
          params.summary.trim() || 'Rise as mighty Gideonites today and do Kingdom exploits!'
        }`
      : bodyClean;

  const [reflectionEn, reflectionYo, reflectionHa, reflectionIg] = chunkStringForFirestore(
    fullTextForChunks,
    4,
    3000
  );

  const metaObj: Record<string, unknown> = {
    category: params.category,
    ...(params.category !== 'SCRIPTURE_OF_THE_DAY' ? { kind: params.category } : {}),
    title: titleClean,
    speaker: speakerClean,
    scriptureRef: refClean,
    duration: durationLabel,
    summary: summaryClean.slice(0, 200),
    audioDurationMinutes: audioMins,
    ...(hasAudio
      ? {
          audioCloudId: params.audioCloudId!.trim(),
          audioFileName: (params.audioFileName || 'sermon-audio.mp3').slice(0, 120),
          audioMimeType: (params.audioMimeType || 'audio/mpeg').slice(0, 60),
          audioSizeBytes: Math.max(0, Number(params.audioSizeBytes) || 0),
          audioChunkCount: Math.max(0, Number(params.audioChunkCount) || 0),
        }
      : {}),
    bookmarkedBy: params.bookmarkedBy || [],
    publishedAt: now,
  };

  const promptJson = buildCappedPrayerPromptJson(metaObj, MAX_PRAYER_PROMPT_JSON_CHARS);

  return {
    authorId: params.authorId || 'user-admin-01',
    authorName: speakerClean,
    fellowshipId: 'GIDEONITES',
    dateKey: new Date(now).toISOString().slice(0, 10),
    referenceEn: refClean,
    verseTextEn:
      params.category === 'SCRIPTURE_OF_THE_DAY'
        ? bodyClean.slice(0, 2000)
        : titleClean.slice(0, 2000),
    reflectionEn,
    ...(reflectionYo ? { reflectionYo } : {}),
    ...(reflectionHa ? { reflectionHa } : {}),
    ...(reflectionIg ? { reflectionIg } : {}),
    prayerPromptEn: promptJson,
  };
}

export interface SermonAudioChunkFirestorePayload<TTimestamp = unknown> {
  audioCloudId: string;
  fellowshipId: 'GIDEONITES';
  uploadedById: string;
  chunkIndex: number;
  totalChunks: number;
  dataBase64: string;
  createdAt: TTimestamp;
  updatedAt: TTimestamp;
}

export function buildSermonAudioChunkFirestorePayload<TTimestamp = unknown>(params: {
  audioCloudId: string;
  uploadedById?: string | null;
  chunkIndex: number;
  totalChunks: number;
  dataBase64: string;
  createdAt: TTimestamp;
  updatedAt: TTimestamp;
}): SermonAudioChunkFirestorePayload<TTimestamp> {
  return {
    audioCloudId: params.audioCloudId.trim(),
    fellowshipId: 'GIDEONITES',
    uploadedById: (params.uploadedById || '').trim() || 'user-admin-01',
    chunkIndex: Math.max(0, Math.floor(params.chunkIndex)),
    totalChunks: Math.max(1, Math.floor(params.totalChunks)),
    dataBase64: params.dataBase64,
    createdAt: params.createdAt,
    updatedAt: params.updatedAt,
  };
}

export const mergeUploadedBiblesWithBaseline = mergeBibleEditionsWithDefault;
export const getMemoryVerseText = getMemoryVerse;
export function maskMemoryVerse(text: string, reveal = false): string {
  return reveal ? text : maskMemoryVerseText(text);
}

export function extractVersesFromBibleDoc(doc: UploadedBibleDoc): BibleVerseItem[] {
  const raw =
    (doc.sections && doc.sections.length > 0
      ? doc.sections.map((s) => s.content).join('\n')
      : doc.contentText) || '';
  const results: BibleVerseItem[] = [];
  const lineRegex = /([1-3]?\s*[A-Za-z]+(?:\s+[A-Za-z]+)*\s+\d+:\d+)\s*(?:[—\-:]\s*)?(.+)/;

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(lineRegex);
    if (match) {
      const ref = match[1].trim();
      const text = match[2].replace(/^["“]|["”]$/g, '').trim();
      const numMatch = ref.match(/^(.*?)\s+(\d+):(\d+)$/);
      const book = numMatch ? numMatch[1].trim() : 'Scripture';
      const chapter = numMatch ? Number(numMatch[2]) : 1;
      const verse = numMatch ? Number(numMatch[3]) : 1;
      results.push({
        id: `${doc.id}-${results.length}`,
        book,
        chapter,
        verse,
        reference: ref,
        text,
        theme: 'Uploaded Bible',
        testament: 'New Testament',
      });
    }
    if (results.length >= 250) break;
  }
  return results;
}

