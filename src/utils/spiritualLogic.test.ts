import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIO_SLICE_BYTES,
  MAX_AUDIO_FILE_BYTES,
  buildAllExplorerVerses,
  buildCappedPrayerPromptJson,
  buildSermonAudioChunkFirestorePayload,
  buildSpiritualResourceFirestorePayload,
  chunkSpeechText,
  combineDecodedChunksToBlob,
  computeAudioDurationMinutes,
  createDefaultKjvBibleEdition,
  decodeBase64ChunkToUint8Array,
  encodeUint8ArrayToPureBase64,
  extractBiblePackVerses,
  extractScriptureOfTheDayResources,
  extractSpiritualMemoryVerse,
  filterExplorerVerses,
  findLatestActiveAudioCloudId,
  formatAudioDurationMMSS,
  formatFileSizeMB,
  generateAudioCloudId,
  getMemoryVerse,
  getSpeechLangTag,
  hasPlayableAudioSermon,
  inferAudioMimeType,
  isAmbiguousAudioFile,
  isAudioFileCandidate,
  maskMemoryVerseText,
  mergeBibleEditionsWithDefault,
  sanitizeSpiritualDisplayText,
  sliceAudioBytesToChunkBase64,
  validateAudioSermonFile,
} from './spiritualLogic';
import type { DailyScriptureDoc } from '../types/fellowship';

test('getMemoryVerse and maskMemoryVerseText localize and mask memory verses per specification', () => {
  const en = getMemoryVerse('Daniel 11:32b', '', 'EN');
  assert.match(en, /know their God shall be strong/);

  const yo = getMemoryVerse('Daniel 11:32b', en, 'YO');
  assert.match(yo, /Ọlọ́run/);

  const ha = getMemoryVerse('Judges 6:12', 'The LORD is with thee', 'HA');
  assert.match(ha, /Ubangiji/);

  const ig = getMemoryVerse('Philippians 4:13', 'I can do all things', 'IG');
  assert.match(ig, /Kraịst/);

  // Short verse (<= 3 words) -> "[ ? ? ? ]"
  assert.equal(maskMemoryVerseText('Jesus wept today'), '[ ? ? ? ]');

  // Longer verse -> replaces words with >= 4 alpha chars at index % 3 === 2 or last index
  const masked = maskMemoryVerseText('The LORD is my shepherd and stronghold always');
  assert.match(masked, /____/);
  assert.ok(masked.endsWith('____'));
});

test('extractSpiritualMemoryVerse prioritizes newest SCRIPTURE_OF_THE_DAY doc and falls back to Daniel 11:32b', () => {
  const fallback = extractSpiritualMemoryVerse([], 'EN');
  assert.equal(fallback.reference, 'Daniel 11:32b');
  assert.equal(fallback.speakerOrAuthor, undefined);

  const docs: DailyScriptureDoc[] = [
    {
      id: 'scripture_bibledoc_1',
      fellowshipId: 'GIDEONITES',
      referenceEn: 'KJV',
      verseTextEn: 'KJV Bible',
      prayerPromptEn: JSON.stringify({ category: 'BIBLE_DOCUMENT' }),
      createdAt: 9999,
    },
    {
      id: 'scripture_res_1',
      fellowshipId: 'GIDEONITES',
      type: 'SERMON',
      referenceEn: 'Acts 1:8',
      verseTextEn: 'Revival Fire',
      prayerPromptEn: JSON.stringify({ kind: 'SERMON' }),
      createdAt: 8888,
    },
    {
      id: 'scripture_sotd_new',
      fellowshipId: 'GIDEONITES',
      authorName: 'Pastor Tunde',
      referenceEn: 'Joshua 1:9',
      verseTextEn: 'Be strong and of a good courage.',
      prayerPromptEn: JSON.stringify({ category: 'SCRIPTURE_OF_THE_DAY', publishedAt: 5000 }),
      createdAt: 5000,
    },
  ];

  const picked = extractSpiritualMemoryVerse(docs, 'EN');
  assert.equal(picked.id, 'scripture_sotd_new');
  assert.equal(picked.reference, 'Joshua 1:9');
  assert.equal(picked.speakerOrAuthor, 'Pastor Tunde');

  const sotdCards = extractScriptureOfTheDayResources(docs);
  assert.equal(sotdCards.length, 1);
  assert.equal(sotdCards[0].category, 'SCRIPTURE_OF_THE_DAY');
});

test('chunkSpeechText splits long sermon text into <=220 char iOS-safe sentence chunks and maps language tags', () => {
  const longBody = Array.from(
    { length: 8 },
    (_, i) => `Sentence number ${i + 1} declares the victory of Christ over every circumstance in our fellowship.`
  ).join(' ');
  const chunks = chunkSpeechText(longBody, 220);
  assert.ok(chunks.length >= 3);
  for (const c of chunks) {
    assert.ok(c.length <= 220, `Chunk exceeded 220 chars: ${c.length}`);
  }
  assert.equal(getSpeechLangTag('EN'), 'en-US');
  assert.equal(getSpeechLangTag('YO'), 'yo-NG');
  assert.equal(getSpeechLangTag('HA'), 'ha-NG');
  assert.equal(getSpeechLangTag('IG'), 'ig-NG');
});

test('Bible Explorer seeds bdoc_default_kjv, unpacks BIBLE_VERSE_PACK, and filters cleanly with language auto-sync fallback', () => {
  const merged = mergeBibleEditionsWithDefault([]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 'bdoc_default_kjv');
  assert.equal(merged[0].format, 'EPUB');
  assert.ok((merged[0].sections || []).length >= 3);

  const packDoc: DailyScriptureDoc = {
    id: 'scripture_biblepack_nkjv_0',
    fellowshipId: 'GIDEONITES',
    reflectionEn: JSON.stringify([
      { book: 'Psalms', chapter: 27, verse: 1, reference: 'Psalm 27:1', text: 'The LORD is my light and my salvation.', translation: 'NKJV' },
    ]),
    prayerPromptEn: JSON.stringify({ category: 'BIBLE_VERSE_PACK', translation: 'NKJV' }),
    createdAt: 1000,
  };

  const unpacked = extractBiblePackVerses([packDoc]);
  assert.equal(unpacked.length, 1);
  assert.equal(unpacked[0].translation, 'NKJV');

  const allVerses = buildAllExplorerVerses([packDoc]);
  assert.ok(allVerses.some((v) => v.reference === 'Psalm 27:1' && v.translation === 'NKJV'));
  assert.ok(allVerses.some((v) => v.language === 'YO'));

  const yoOnly = filterExplorerVerses(allVerses, {
    activeLanguage: 'YO',
    filterByActiveLanguage: true,
    selectedTranslation: 'ALL',
    selectedTheme: 'ALL',
    searchQuery: '',
  });
  assert.equal(yoOnly.fellBackToAllLanguages, false);
  assert.ok(yoOnly.verses.every((v) => v.language === 'YO'));

  // Search for NKJV while activeLanguage is YO triggers clean fallback when YO has 0 NKJV matches
  const fallbackNkjv = filterExplorerVerses(allVerses, {
    activeLanguage: 'YO',
    filterByActiveLanguage: true,
    selectedTranslation: 'NKJV',
    selectedTheme: 'ALL',
    searchQuery: '',
  });
  assert.equal(fallbackNkjv.fellBackToAllLanguages, true);
  assert.equal(fallbackNkjv.verses.length, 1);
});

test('buildSpiritualResourceFirestorePayload emits strictly allowlisted daily_scriptures fields without disallowed type property', () => {
  const payload = buildSpiritualResourceFirestorePayload({
    authorId: 'user-admin-01',
    authorName: 'Admin',
    category: 'SERMON',
    title: 'Faith That Conquers',
    speaker: 'Pastor Tunde',
    scriptureRef: 'Hebrews 11:1',
    summary: 'Walking in substance and evidence',
    body: 'A'.repeat(4500),
    audioDurationMinutes: 30,
  });

  assert.equal('type' in payload, false);
  assert.equal(payload.fellowshipId, 'GIDEONITES');
  assert.equal(String(payload.reflectionEn).length, 3000);
  assert.equal(String(payload.reflectionYo).length, 1500);
  assert.ok(String(payload.prayerPromptEn).length <= 980);
  const meta = JSON.parse(String(payload.prayerPromptEn));
  assert.equal(meta.category, 'SERMON');
  assert.equal(meta.audioDurationMinutes, 30);
});

test('Audio sermon validation, chunk base64 round-trip, duration/size formatting, and 980-char JSON budget preservation', () => {
  const id = generateAudioCloudId();
  assert.match(id, /^sa_[0-9a-f]{16}$/);

  assert.equal(validateAudioSermonFile({ name: 'empty.mp3', size: 0, type: 'audio/mpeg' }).ok, false);
  assert.equal(
    validateAudioSermonFile({ name: 'huge.mp3', size: MAX_AUDIO_FILE_BYTES + 1, type: 'audio/mpeg' }).ok,
    false
  );

  // Non-audio rejection exact inline message
  for (const nonAudio of [
    { name: 'notes.pdf', size: 1024, type: 'application/pdf' },
    { name: 'bible.epub', size: 1024, type: 'application/epub+zip' },
    { name: 'outline.txt', size: 512, type: 'text/plain' },
    { name: 'flyer.png', size: 2048, type: 'image/png' },
    { name: 'app.apk', size: 4096, type: 'application/vnd.android.package-archive' },
  ]) {
    const res = validateAudioSermonFile(nonAudio);
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(
        res.error,
        `'${nonAudio.name}' is not an audio file. Please select an MP3, M4A, AAC, WAV, OGG, or Voice Recording.`
      );
    }
    assert.equal(isAudioFileCandidate(nonAudio), false);
  }

  // Extended mobile/voice-note audio extensions even with blank, octet-stream, ogg, or video/mp4 MIME
  for (const audioCase of [
    { name: 'sermon.mp3', size: 1024 * 1024, type: 'audio/mpeg' },
    { name: 'sermon.m4a', size: 2048, type: '' },
    { name: 'voice_note.ogg', size: 2048, type: 'application/ogg' },
    { name: 'whatsapp_ptt.opus', size: 2048, type: 'application/octet-stream' },
    { name: 'recording.flac', size: 2048, type: '' },
    { name: 'memo.3gp', size: 2048, type: '' },
    { name: 'call.amr', size: 2048, type: '' },
    { name: 'talk.wma', size: 2048, type: '' },
    { name: 'chapter.m4b', size: 2048, type: '' },
    { name: 'audio_track.mp4', size: 4096, type: 'video/mp4' },
    { name: 'browser_rec.webm', size: 4096, type: 'audio/webm' },
  ]) {
    const res = validateAudioSermonFile(audioCase);
    assert.equal(res.ok, true, `Expected ${audioCase.name} (${audioCase.type}) to validate`);
    assert.equal(isAudioFileCandidate(audioCase), true);
  }

  assert.equal(isAmbiguousAudioFile({ name: 'sermon.mp3', type: 'audio/mpeg' }), false);
  assert.equal(isAmbiguousAudioFile({ name: 'audio_track.mp4', type: 'video/mp4' }), true);
  assert.equal(isAmbiguousAudioFile({ name: 'unknown_voice_note', type: 'application/octet-stream' }), true);

  assert.equal(inferAudioMimeType('sermon.m4a', 'video/mp4'), 'audio/mp4');
  assert.equal(inferAudioMimeType('voice.opus', 'application/octet-stream'), 'audio/ogg');
  assert.equal(inferAudioMimeType('sunday.mp3', ''), 'audio/mpeg');
  assert.equal(inferAudioMimeType('sunday.wav', ''), 'audio/wav');

  // Blank speaker defaults to Living Faith Church Youth Ministry
  const defaultSpeakerPayload = buildSpiritualResourceFirestorePayload({
    authorId: 'user-admin-01',
    authorName: '',
    category: 'SERMON',
    title: 'Faith Message',
    speaker: '',
    scriptureRef: 'Romans 10:17',
    summary: '',
    body: 'Body text',
    audioDurationMinutes: 15,
  });
  assert.equal(defaultSpeakerPayload.authorName, 'Living Faith Church Youth Ministry');
  assert.equal(
    JSON.parse(String(defaultSpeakerPayload.prayerPromptEn)).speaker,
    'Living Faith Church Youth Ministry'
  );

  const sample = new Uint8Array(AUDIO_SLICE_BYTES + 123);
  for (let i = 0; i < sample.length; i += 1) {
    sample[i] = i % 251;
  }
  const base64Chunks = sliceAudioBytesToChunkBase64(sample);
  assert.equal(base64Chunks.length, 2);
  assert.equal(base64Chunks[0].includes('\n'), false);
  assert.equal(base64Chunks[0].startsWith('data:'), false);

  const reassembled = decodeBase64ChunkToUint8Array(base64Chunks[0]);
  assert.equal(reassembled.length, AUDIO_SLICE_BYTES);
  const blob = combineDecodedChunksToBlob(
    base64Chunks.map((dataBase64, chunkIndex) => ({ chunkIndex, dataBase64 })),
    'audio/mpeg'
  );
  assert.equal(blob.size, sample.length);
  assert.equal(blob.type, 'audio/mpeg');

  assert.equal(computeAudioDurationMinutes(61), 2);
  assert.equal(computeAudioDurationMinutes(1), 1);
  assert.equal(formatAudioDurationMMSS(125), '02:05');
  assert.equal(formatFileSizeMB(1_572_864), '1.5 MB');
  assert.equal(formatFileSizeMB(512 * 1024), '512 KB');

  // Ensure buildCappedPrayerPromptJson & buildSpiritualResourceFirestorePayload preserve audioCloudId cleanly
  const hugePayload = buildSpiritualResourceFirestorePayload({
    authorId: 'user-admin-01',
    authorName: 'Admin',
    category: 'SERMON',
    title: 'Long Title '.repeat(12),
    speaker: 'Pastor Tunde Adeyemi',
    scriptureRef: 'Judges 6:12',
    summary: 'Huge Summary '.repeat(30),
    body: '',
    audioDurationMinutes: 42,
    audioCloudId: 'sa_0123456789abcdef',
    audioFileName: 'sunday_sermon_recording_final_master.mp3',
    audioMimeType: 'audio/mpeg',
    audioSizeBytes: 12_345_678,
    audioChunkCount: 28,
  });
  const promptStr = String(hugePayload.prayerPromptEn);
  assert.ok(promptStr.length <= 980, `Expected <= 980 chars, got ${promptStr.length}`);
  const parsed = JSON.parse(promptStr);
  assert.equal(parsed.audioCloudId, 'sa_0123456789abcdef');
  assert.equal(parsed.audioChunkCount, 28);
  assert.equal(parsed.audioSizeBytes, 12_345_678);
  assert.equal(parsed.audioDurationMinutes, 42);
  assert.equal(hugePayload.reflectionEn, 'Audio Sermon • sunday_sermon_recording_final_master.mp3');

  assert.equal(hasPlayableAudioSermon({ audioCloudId: 'sa_1', audioChunkCount: 3 }), true);
  assert.equal(hasPlayableAudioSermon({ audioCloudId: 'sa_1', audioChunkCount: 0 }), false);
  assert.equal(
    findLatestActiveAudioCloudId([
      { audioCloudId: 'sa_old', audioChunkCount: 2, createdAt: 100 },
      { audioCloudId: 'sa_new', audioChunkCount: 4, createdAt: 500 },
      { audioCloudId: undefined, audioChunkCount: 0, createdAt: 999 },
    ]),
    'sa_new'
  );
  assert.equal(
    encodeUint8ArrayToPureBase64(new Uint8Array([71, 73, 68])),
    'R0lE'
  );

  assert.equal(
    sanitizeSpiritualDisplayText('Walk in faith and power.', 'Fallback'),
    'Walk in faith and power.'
  );
  assert.equal(
    sanitizeSpiritualDisplayText(
      'ID3\u0004\u0000\u0000#TSSE\u0000\u0003Lavf59.27.100\uFFFD',
      'Audio sermon notes unavailable'
    ),
    'Audio sermon notes unavailable'
  );

  const stampSentinel = { _type: 'serverTimestamp' };
  const chunkDoc = buildSermonAudioChunkFirestorePayload({
    audioCloudId: ' sa_0123456789abcdef ',
    uploadedById: '',
    chunkIndex: 0,
    totalChunks: 3,
    dataBase64: 'UklGRg==',
    createdAt: stampSentinel,
    updatedAt: stampSentinel,
  });
  assert.deepEqual(Object.keys(chunkDoc).sort(), [
    'audioCloudId',
    'chunkIndex',
    'createdAt',
    'dataBase64',
    'fellowshipId',
    'totalChunks',
    'updatedAt',
    'uploadedById',
  ]);
  assert.equal(chunkDoc.audioCloudId, 'sa_0123456789abcdef');
  assert.equal(chunkDoc.fellowshipId, 'GIDEONITES');
  assert.equal(chunkDoc.uploadedById, 'user-admin-01');
  assert.equal(chunkDoc.chunkIndex, 0);
  assert.equal(chunkDoc.totalChunks, 3);
  assert.equal(chunkDoc.createdAt, stampSentinel);
  assert.equal(chunkDoc.updatedAt, stampSentinel);
});
