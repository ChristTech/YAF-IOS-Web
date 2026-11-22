import type {
  GameType,
  LanguageCode,
  MultiplayerQuestion,
  SoloQuizQuestion,
} from '../types/fellowship';
import { scrambleVerse } from '../utils/gamesLogic';

export function buildLocalizedSessionTitles(
  gameType: GameType,
  customEnTitle?: string
): {
  titleEn: string;
  titleYo: string;
  titleHa: string;
  titleIg: string;
} {
  if (customEnTitle && customEnTitle.trim()) {
    const clean = customEnTitle.trim();
    return {
      titleEn: clean,
      titleYo: clean,
      titleHa: clean,
      titleIg: clean,
    };
  }
  switch (gameType) {
    case 'WHO_AM_I':
      return {
        titleEn: 'Who Am I? Bible Character Showdown',
        titleYo: 'Ta ni Èmi? Ìdíje Bíbélì',
        titleHa: 'Wane ne Ni? Gasar Littafi Mai Tsarki',
        titleIg: 'Onye Ka M Bụ? Egwuregwu Baịbụl',
      };
    case 'SCRIPTURE_SCRAMBLE':
      return {
        titleEn: 'Scripture Scramble Live Challenge',
        titleYo: 'Ìdíje Títò Ọ̀rọ̀ Bíbélì',
        titleHa: 'Gasar Hada Ayar Littafi Mai Tsarki',
        titleIg: 'Egwuregwu Ịhazi Okwu Baịbụl',
      };
    default:
      return {
        titleEn: 'Gideonites Bible Trivia Showdown',
        titleYo: 'Ìdíje Ìbéèrè Bíbélì Gideonites',
        titleHa: 'Gasar Tambayoyin Littafi Mai Tsarki',
        titleIg: 'Egwuregwu Ajụjụ Baịbụl Gideonites',
      };
  }
}

const TRIVIA_PRESETS: Record<LanguageCode, MultiplayerQuestion[]> = {
  EN: [
    {
      id: 'tr-en-1',
      gameType: 'TRIVIA_CHALLENGE',
      prompt: 'Where was Gideon threshing wheat when the angel of the LORD appeared to him?',
      options: ['In the temple court', 'By the winepress', 'On Mount Carmel', 'Beside the Jordan'],
      correctAnswer: 'By the winepress',
      clues: [],
      scrambledWords: [],
      scriptureReference: 'Judges 6:11',
      translation: 'KJV',
      timerSeconds: 20,
      points: 100,
      explanation: 'Gideon threshed wheat secretly by the winepress in Ophrah to hide it from the Midianites.',
    },
    {
      id: 'tr-en-2',
      gameType: 'TRIVIA_CHALLENGE',
      prompt: 'How many men remained in Gideon’s army after the Lord tested them at the water?',
      options: ['3,000', '1,000', '300', '120'],
      correctAnswer: '300',
      clues: [],
      scrambledWords: [],
      scriptureReference: 'Judges 7:7',
      translation: 'KJV',
      timerSeconds: 20,
      points: 100,
      explanation: 'God reduced Gideon’s army to 300 men so Israel would know victory came from the LORD.',
    },
    {
      id: 'tr-en-3',
      gameType: 'TRIVIA_CHALLENGE',
      prompt: 'What battle cry did Gideon’s 300 warriors shout when they broke their pitchers?',
      options: [
        'The Lord is our Banner!',
        'The sword of the LORD, and of Gideon!',
        'Stand still and see salvation!',
        'Glory to the God of Israel!',
      ],
      correctAnswer: 'The sword of the LORD, and of Gideon!',
      clues: [],
      scrambledWords: [],
      scriptureReference: 'Judges 7:20',
      translation: 'KJV',
      timerSeconds: 20,
      points: 100,
      explanation: 'Holding torches in their left hands and trumpets in their right, they cried "The sword of the LORD, and of Gideon!"',
    },
    {
      id: 'tr-en-4',
      gameType: 'TRIVIA_CHALLENGE',
      prompt: 'Which young leader received the apostolic counsel: "Let no man despise thy youth"?',
      options: ['Barnabas', 'Timothy', 'Apollos', 'Silas'],
      correctAnswer: 'Timothy',
      clues: [],
      scrambledWords: [],
      scriptureReference: '1 Timothy 4:12',
      translation: 'KJV',
      timerSeconds: 20,
      points: 100,
      explanation: 'Paul wrote 1 Timothy 4:12 to charge young Timothy to set an example in word, conduct, love, faith, and purity.',
    },
  ],
  YO: [
    {
      id: 'tr-yo-1',
      gameType: 'TRIVIA_CHALLENGE',
      prompt: 'Níbo ni Gídíónì ti ń pakà alikama nígbà tí áńgẹ́lì Olúwa farahàn án?',
      options: ['Nínú tẹ́ńpìlì', 'Níbi ìfúntí wáìnì', 'Lórí Òkè Kámẹ́lì', 'Lẹ́bàá Odò Jọ́dánì'],
      correctAnswer: 'Níbi ìfúntí wáìnì',
      clues: [],
      scrambledWords: [],
      scriptureReference: 'Judges 6:11',
      translation: 'Bibeli Mimo (YO)',
      timerSeconds: 20,
      points: 100,
      explanation: 'Gídíónì ń pakà ní ìfúntí wáìnì ní Ọ́fúrà láti fi pamọ́ fún àwọn ará Mídíánì.',
    },
    {
      id: 'tr-yo-2',
      gameType: 'TRIVIA_CHALLENGE',
      prompt: 'Ọkùnrin mélòó ló kù nínú ogun Gídíónì lẹ́yìn ìdánwò omi mímu?',
      options: ['3,000', '1,000', '300', '120'],
      correctAnswer: '300',
      clues: [],
      scrambledWords: [],
      scriptureReference: 'Judges 7:7',
      translation: 'Bibeli Mimo (YO)',
      timerSeconds: 20,
      points: 100,
      explanation: 'Ọlọ́run yàn 300 ọkùnrin kí Ísírẹ́lì lè mọ̀ pé Olúwa ló fún wọn ní ìṣẹ́gun.',
    },
    {
      id: 'tr-yo-3',
      gameType: 'TRIVIA_CHALLENGE',
      prompt: 'Kí ni ariwo ogun tí àwọn 300 akọni Gídíónì ké?',
      options: [
        'Olúwa ni àsíá wa!',
        'Idà Olúwa, àti ti Gídíónì!',
        'Dúró jẹ́ẹ́ kí ẹ rí ìgbàlà!',
        'Ògo fún Ọlọ́run Ísírẹ́lì!',
      ],
      correctAnswer: 'Idà Olúwa, àti ti Gídíónì!',
      clues: [],
      scrambledWords: [],
      scriptureReference: 'Judges 7:20',
      translation: 'Bibeli Mimo (YO)',
      timerSeconds: 20,
      points: 100,
      explanation: 'Wọ́n fọ́ ìkòkò wọn, wọ́n fọn fèrè, wọ́n sì ké pé "Idà Olúwa, àti ti Gídíónì!"',
    },
    {
      id: 'tr-yo-4',
      gameType: 'TRIVIA_CHALLENGE',
      prompt: 'Ta ni Pọ́ọ̀lù kọ̀wé sí pé "Má ṣe jẹ́ kí ẹnikẹ́ni tẹ́ńbẹ́lú ìgbà èwe rẹ"?',
      options: ['Bánábà', 'Tímótì', 'Àpólò', 'Sílà'],
      correctAnswer: 'Tímótì',
      clues: [],
      scrambledWords: [],
      scriptureReference: '1 Timothy 4:12',
      translation: 'Bibeli Mimo (YO)',
      timerSeconds: 20,
      points: 100,
      explanation: 'Pọ́ọ̀lù gba Tímótì níyànjú láti jẹ́ àpẹẹrẹ fún àwọn onígbàgbọ́ ní ọ̀rọ̀ àti ìwà mímọ́.',
    },
  ],
  HA: [
    {
      id: 'tr-ha-1',
      gameType: 'TRIVIA_CHALLENGE',
      prompt: 'A ina Gidiyon yake sussukar alkama sa’ad da mala’ikan Ubangiji ya bayyana gare shi?',
      options: ['A cikin haikali', 'A matsewar inabi', 'A kan Dutsen Karmel', 'Kusa da Kogin Urdun'],
      correctAnswer: 'A matsewar inabi',
      clues: [],
      scrambledWords: [],
      scriptureReference: 'Judges 6:11',
      translation: 'Littafi Mai Tsarki (HA)',
      timerSeconds: 20,
      points: 100,
      explanation: 'Gidiyon ya ɓoye a matsewar inabi a Ofra don kada Midiyanawa su gan shi.',
    },
    {
      id: 'tr-ha-2',
      gameType: 'TRIVIA_CHALLENGE',
      prompt: 'Maza nawa suka rage a rundunar Gidiyon bayan gwajin shan ruwa?',
      options: ['3,000', '1,000', '300', '120'],
      correctAnswer: '300',
      clues: [],
      scrambledWords: [],
      scriptureReference: 'Judges 7:7',
      translation: 'Littafi Mai Tsarki (HA)',
      timerSeconds: 20,
      points: 100,
      explanation: 'Allah ya zaɓi jarumawa 300 domin Isra’ila ta san cewa Ubangiji ne ya ba su nasara.',
    },
    {
      id: 'tr-ha-3',
      gameType: 'TRIVIA_CHALLENGE',
      prompt: 'Wane ihun yaƙi ne jarumawan Gidiyon 300 suka yi?',
      options: [
        'Ubangiji ne tutarmu!',
        'Takobin Ubangiji, da na Gidiyon!',
        'Ku tsaya ku ga ceto!',
        'Ɗaukaka ga Allahn Isra’ila!',
      ],
      correctAnswer: 'Takobin Ubangiji, da na Gidiyon!',
      clues: [],
      scrambledWords: [],
      scriptureReference: 'Judges 7:20',
      translation: 'Littafi Mai Tsarki (HA)',
      timerSeconds: 20,
      points: 100,
      explanation: 'Sun fasa tuluna suka busa ƙaho suna cewa "Takobin Ubangiji, da na Gidiyon!"',
    },
    {
      id: 'tr-ha-4',
      gameType: 'TRIVIA_CHALLENGE',
      prompt: 'Wane matashi ne Bulus ya rubuta masa "Kada kowa ya raina ƙuruciyarka"?',
      options: ['Barnabas', 'Timotawus', 'Afolos', 'Sila'],
      correctAnswer: 'Timotawus',
      clues: [],
      scrambledWords: [],
      scriptureReference: '1 Timothy 4:12',
      translation: 'Littafi Mai Tsarki (HA)',
      timerSeconds: 20,
      points: 100,
      explanation: 'Bulus ya ƙarfafa Timotawus ya zama abin koyi ga masu bi a magana da tsarki.',
    },
  ],
  IG: [
    {
      id: 'tr-ig-1',
      gameType: 'TRIVIA_CHALLENGE',
      prompt: 'Ebee ka Gidiọn nọ na-azọcha ọka wit mgbe mmụọ ozi Onyenwe anyị pụtara n’ihu ya?',
      options: ['N’ime ụlọ nsọ', 'N’ebe nzọcha mmanya vine', 'N’Ugwu Kamel', 'N’akụkụ Osimiri Jọdan'],
      correctAnswer: 'N’ebe nzọcha mmanya vine',
      clues: [],
      scrambledWords: [],
      scriptureReference: 'Judges 6:11',
      translation: 'Baịbụl Nsọ (IG)',
      timerSeconds: 20,
      points: 100,
      explanation: 'Gidiọn zochiri ọka wit n’ebe nzọcha mmanya vine ka ndị Midian ghara ịhụ ya.',
    },
    {
      id: 'tr-ig-2',
      gameType: 'TRIVIA_CHALLENGE',
      prompt: 'Ndị ikom ole fọdụrụ n’usuu ndị agha Gidiọn mgbe ule ịṅụ mmiri gasịrị?',
      options: ['3,000', '1,000', '300', '120'],
      correctAnswer: '300',
      clues: [],
      scrambledWords: [],
      scriptureReference: 'Judges 7:7',
      translation: 'Baịbụl Nsọ (IG)',
      timerSeconds: 20,
      points: 100,
      explanation: 'Chineke ji naanị mmadụ 300 nye mmeri ka Izrel mara na Onyenwe anyị zọpụtara ha.',
    },
    {
      id: 'tr-ig-3',
      gameType: 'TRIVIA_CHALLENGE',
      prompt: 'Gịnị bụ mkpu agha ndị dike 300 nke Gidiọn tiri?',
      options: [
        'Onyenwe anyị bụ ọkọlọtọ anyị!',
        'Mma agha nke Onyenwe anyị, na nke Gidiọn!',
        'Guzosie ike hụ nzọpụta!',
        'Otuto dịrị Chineke nke Izrel!',
      ],
      correctAnswer: 'Mma agha nke Onyenwe anyị, na nke Gidiọn!',
      clues: [],
      scrambledWords: [],
      scriptureReference: 'Judges 7:20',
      translation: 'Baịbụl Nsọ (IG)',
      timerSeconds: 20,
      points: 100,
      explanation: 'Ha kụwara ite ha, fụọ opi, tie mkpu sị "Mma agha nke Onyenwe anyị, na nke Gidiọn!"',
    },
    {
      id: 'tr-ig-4',
      gameType: 'TRIVIA_CHALLENGE',
      prompt: 'Onye ka Pọl degaara akwụkwọ sị "Ekwela ka onye ọ bụla leda ntorobịa gị anya"?',
      options: ['Banabas', 'Timoti', 'Apọlọs', 'Saịlas'],
      correctAnswer: 'Timoti',
      clues: [],
      scrambledWords: [],
      scriptureReference: '1 Timothy 4:12',
      translation: 'Baịbụl Nsọ (IG)',
      timerSeconds: 20,
      points: 100,
      explanation: 'Pọl dụrụ Timoti ọdụ ka ọ bụrụ ihe nlereanya nye ndị kwere ekwe.',
    },
  ],
};

const WHO_AM_I_PRESETS: Record<LanguageCode, MultiplayerQuestion[]> = {
  EN: [
    {
      id: 'wai-en-1',
      gameType: 'WHO_AM_I',
      prompt: 'Identify this Bible champion from progressive clues:',
      options: [],
      correctAnswer: 'Gideon',
      clues: [
        'I asked for two signs involving a fleece of wool and morning dew.',
        'The angel of the LORD greeted me as a "mighty man of valour" while I threshed wheat.',
        'My 32,000-strong army was trimmed down to 300 lapping warriors.',
        'My warriors carried trumpets and torches inside empty pitchers.',
      ],
      scrambledWords: [],
      scriptureReference: 'Judges 6–7',
      translation: 'KJV',
      timerSeconds: 30,
      points: 150,
      explanation: 'Gideon led 300 fearless Israelite warriors to rout Midian by God’s power.',
    },
    {
      id: 'wai-en-2',
      gameType: 'WHO_AM_I',
      prompt: 'Identify this youthful Kingdom Giant from progressive clues:',
      options: [],
      correctAnswer: 'Daniel',
      clues: [
        'As a youth in Babylon, I purposed in my heart not to defile myself with the king’s food.',
        'God gave me understanding in all visions and dreams.',
        'I wrote that the people who know their God shall be strong and do exploits.',
        'I prayed three times a day and survived a night in a den of lions.',
      ],
      scrambledWords: [],
      scriptureReference: 'Daniel 1, 6, 11:32',
      translation: 'KJV',
      timerSeconds: 30,
      points: 150,
      explanation: 'Daniel’s uncompromising devotion and wisdom elevated him across multiple empires.',
    },
    {
      id: 'wai-en-3',
      gameType: 'WHO_AM_I',
      prompt: 'Identify this Old Testament shepherd & king from progressive clues:',
      options: [],
      correctAnswer: 'David',
      clues: [
        'Before facing a giant, I had already slain a lion and a bear.',
        'I refused Saul’s heavy armour because I had not proved it.',
        'I chose five smooth stones from the brook before running toward the Philistine.',
        'I later became king of Israel and authored many Psalms, including Psalm 23.',
      ],
      scrambledWords: [],
      scriptureReference: '1 Samuel 17',
      translation: 'KJV',
      timerSeconds: 30,
      points: 150,
      explanation: 'David declared "The battle is the LORD’s" and defeated Goliath with faith and a sling.',
    },
    {
      id: 'wai-en-4',
      gameType: 'WHO_AM_I',
      prompt: 'Identify this courageous queen from progressive clues:',
      options: [],
      correctAnswer: 'Esther',
      clues: [
        'My Hebrew name was Hadassah and my cousin Mordecai raised me.',
        'I fasted three days with my people before approaching the royal throne uninvited.',
        'Mordecai reminded me I came to the kingdom "for such a time as this."',
        'I boldly said "If I perish, I perish" and saved the Jewish people from Haman’s plot.',
      ],
      scrambledWords: [],
      scriptureReference: 'Esther 4:14–16',
      translation: 'KJV',
      timerSeconds: 30,
      points: 150,
      explanation: 'Queen Esther risked her crown and life to intercede for God’s people.',
    },
  ],
  YO: [
    {
      id: 'wai-yo-1',
      gameType: 'WHO_AM_I',
      prompt: 'Mọ akọni Bíbélì yìí látinú àwọn àmì ìtọ́ka:',
      options: [],
      correctAnswer: 'Gideon',
      clues: [
        'Mo béèrè fún àmì méjì pẹ̀lú irun àgùntàn àti ìrì òwúrọ̀.',
        'Áńgẹ́lì Olúwa pè mí ní "alágbára akọni" nígbà tí mo ń pakà.',
        'Ọmọ-ogun mi dín kù láti 32,000 sí 300 akọni.',
        'Àwọn ọmọ-ogun mi gbé ògùṣọ̀ nínú ìkòkò àti fèrè.',
      ],
      scrambledWords: [],
      scriptureReference: 'Judges 6–7',
      translation: 'Bibeli Mimo (YO)',
      timerSeconds: 30,
      points: 150,
      explanation: 'Gídíónì lo ìgbọràn láti lé ogun Mídíánì kúrò pẹ̀lú 300 ènìyàn.',
    },
    {
      id: 'wai-yo-2',
      gameType: 'WHO_AM_I',
      prompt: 'Mọ ọ̀dọ́ akọni Bíbélì yìí látinú àwọn àmì ìtọ́ka:',
      options: [],
      correctAnswer: 'Daniel',
      clues: [
        'Ní Bábílónì, mo pinnu láti má ṣe ba ara mi jẹ́ pẹ̀lú oúnjẹ ọba.',
        'Ọlọ́run fún mi ní òye nípa ìran àti àlá gbogbo.',
        'Mo kọ̀wé pé àwọn tí ó mọ Ọlọ́run wọn yóò ṣe iṣẹ́ ìyanu.',
        'Mo gbàdúrà ní ìgbà mẹ́ta lójúmọ́, mo sì là nínú ihò kìnnìún.',
      ],
      scrambledWords: [],
      scriptureReference: 'Daniel 1, 6, 11:32',
      translation: 'Bibeli Mimo (YO)',
      timerSeconds: 30,
      points: 150,
      explanation: 'Dáníẹ́lì fi ìfọkànsìn hàn, Ọlọ́run sì dá a sí nínú ihò kìnnìún.',
    },
    {
      id: 'wai-yo-3',
      gameType: 'WHO_AM_I',
      prompt: 'Mọ olùṣọ́-àgùntàn àti ọba yìí:',
      options: [],
      correctAnswer: 'David',
      clues: [
        'Kí n tó dojú kọ omiran, mo ti pa kìnnìún àti béárì.',
        'Mo kọ ìhámọ́ra Sọ́ọ̀lù nítorí èmi kò tíì dán an wò.',
        'Mo mú òkúta dídán márùn-ún nínú odò láti bá Gòláyátì jà.',
        'Mo kọ ọ̀pọ̀lọpọ̀ Sáàmù bíi Sáàmù 23.',
      ],
      scrambledWords: [],
      scriptureReference: '1 Samuel 17',
      translation: 'Bibeli Mimo (YO)',
      timerSeconds: 30,
      points: 150,
      explanation: 'Dáfídì ṣẹ́gun Gòláyátì ní orúkọ Olúwa àwọn ọmọ-ogun.',
    },
    {
      id: 'wai-yo-4',
      gameType: 'WHO_AM_I',
      prompt: 'Mọ ayaba onígboyà yìí:',
      options: [],
      correctAnswer: 'Esther',
      clues: [
        'Orúkọ mi ní Hébérù ni Hadasa, Mọ́dékáì sì tọ́ mi dàgbà.',
        'Mo gbààwẹ̀ ọjọ́ mẹ́ta kí n tó wọlé sọ́dọ̀ ọba láìpè mí.',
        'Mo dé ipò ọba "fún irú àkókò báyìí."',
        'Mo wí pé "Bí mo bá ṣègbé, kí n ṣègbé" láti gba àwọn Júù là.',
      ],
      scrambledWords: [],
      scriptureReference: 'Esther 4:14–16',
      translation: 'Bibeli Mimo (YO)',
      timerSeconds: 30,
      points: 150,
      explanation: 'Ayaba Ẹ́sítà fi ìgboyà gba àwọn ènìyàn rẹ̀ là.',
    },
  ],
  HA: [
    {
      id: 'wai-ha-1',
      gameType: 'WHO_AM_I',
      prompt: 'Gane wannan jarumin Littafi Mai Tsarki daga alamomi:',
      options: [],
      correctAnswer: 'Gideon',
      clues: [
        'Na nemi alamu biyu da ulun tunkiya da raɓar safe.',
        'Mala’ikan Ubangiji ya kira ni "jarumi mai ƙarfi" yayin sussuka.',
        'An rage rundunata daga 32,000 zuwa jarumawa 300.',
        'Jarumawana sun ɗauki ƙaho da tocila a cikin tuluna.',
      ],
      scrambledWords: [],
      scriptureReference: 'Judges 6–7',
      translation: 'Littafi Mai Tsarki (HA)',
      timerSeconds: 30,
      points: 150,
      explanation: 'Gidiyon ya jagoranci maza 300 zuwa nasara da ikon Allah.',
    },
    {
      id: 'wai-ha-2',
      gameType: 'WHO_AM_I',
      prompt: 'Gane wannan matashin jarumin Littafi Mai Tsarki:',
      options: [],
      correctAnswer: 'Daniel',
      clues: [
        'A Babila, na ƙudura ba zan ƙazantar da kaina da abincin sarki ba.',
        'Allah ya ba ni fahimtar wahayi da mafarkai.',
        'Na rubuta cewa mutanen da suka san Allahn su za su yi manyan ayyuka.',
        'Na yi addu’a sau uku a rana kuma na tsira a ramin zakuna.',
      ],
      scrambledWords: [],
      scriptureReference: 'Daniel 1, 6, 11:32',
      translation: 'Littafi Mai Tsarki (HA)',
      timerSeconds: 30,
      points: 150,
      explanation: 'Daniyel ya tsaya da gaskiya kuma Allah ya cece shi a ramin zakuna.',
    },
    {
      id: 'wai-ha-3',
      gameType: 'WHO_AM_I',
      prompt: 'Gane wannan makiyayi kuma sarki:',
      options: [],
      correctAnswer: 'David',
      clues: [
        'Kafin in fuskanci ƙato, na kashe zaki da beyar.',
        'Na ƙi makaman Saul domin ban saba da su ba.',
        'Na ɗauki duwatsu biyar masu santsi don yaƙi da Goliyat.',
        'Na rubuta Zabura da yawa har da Zabura 23.',
      ],
      scrambledWords: [],
      scriptureReference: '1 Samuel 17',
      translation: 'Littafi Mai Tsarki (HA)',
      timerSeconds: 30,
      points: 150,
      explanation: 'Dawuda ya rinjayi Goliyat da bangaskiya cikin sunan Ubangiji.',
    },
    {
      id: 'wai-ha-4',
      gameType: 'WHO_AM_I',
      prompt: 'Gane wannan sarauniya mai ƙarfin hali:',
      options: [],
      correctAnswer: 'Esther',
      clues: [
        'Sunana na Ibrananci shi ne Hadasa, Mordekai ya rene ni.',
        'Na yi azumin kwana uku kafin in shiga wurin sarki ba tare da kira ba.',
        'Na zo fada "don irin wannan lokaci."',
        'Na ce "In na halaka, na halaka" don ceton jama’ata.',
      ],
      scrambledWords: [],
      scriptureReference: 'Esther 4:14–16',
      translation: 'Littafi Mai Tsarki (HA)',
      timerSeconds: 30,
      points: 150,
      explanation: 'Sarauniya Esta ta ceci Yahudawa da jajircewarta.',
    },
  ],
  IG: [
    {
      id: 'wai-ig-1',
      gameType: 'WHO_AM_I',
      prompt: 'Chọpụta dike Baịbụl a site n’ihe ngosi ndị a:',
      options: [],
      correctAnswer: 'Gideon',
      clues: [
        'Arịọrọ m ihe ịrịba ama abụọ nke ajị atụrụ na igirigi ụtụtụ.',
        'Mmụọ ozi Onyenwe anyị kpọrọ m "dike dị ike" mgbe m na-azọcha ọka.',
        'E belatara ndị agha m site na 32,000 ruo mmadụ 300.',
        'Ndị agha m buuru opi na ọwa ọkụ n’ime ite.',
      ],
      scrambledWords: [],
      scriptureReference: 'Judges 6–7',
      translation: 'Baịbụl Nsọ (IG)',
      timerSeconds: 30,
      points: 150,
      explanation: 'Gidiọn duuru mmadụ 300 merie ndị Midian site n’ike Chineke.',
    },
    {
      id: 'wai-ig-2',
      gameType: 'WHO_AM_I',
      prompt: 'Chọpụta dike ntorobịa Baịbụl a:',
      options: [],
      correctAnswer: 'Daniel',
      clues: [
        'Na Babilọn, ekpebiri m ịghara imerụ onwe m site n’iri nri eze.',
        'Chineke nyere m amamihe n’ọhụụ na nrọ niile.',
        'Edere m na ndị maara Chineke ha ga-adị ike mee ihe dị ukwuu.',
        'Ekperela m ekpere ugboro atọ kwa ụbọchị ma lanarị olulu ọdụm.',
      ],
      scrambledWords: [],
      scriptureReference: 'Daniel 1, 6, 11:32',
      translation: 'Baịbụl Nsọ (IG)',
      timerSeconds: 30,
      points: 150,
      explanation: 'Daniel nọgidere n’ikwesị ntụkwasị obi ya n’ebe Chineke nọ.',
    },
    {
      id: 'wai-ig-3',
      gameType: 'WHO_AM_I',
      prompt: 'Chọpụta onye ọzụzụ atụrụ na eze a:',
      options: [],
      correctAnswer: 'David',
      clues: [
        'Tupu m lụso nnukwu dike ọgụ, egburu m ọdụm na bea.',
        'Ajụrụ m uwe agha Sọl maka na anwalebeghị m ya.',
        'Ahọpụtara m nkume ise dị laree n’osimiri iji lụso Goliat ọgụ.',
        'Edere m ọtụtụ Abụ Ọma gụnyere Abụ Ọma 23.',
      ],
      scrambledWords: [],
      scriptureReference: '1 Samuel 17',
      translation: 'Baịbụl Nsọ (IG)',
      timerSeconds: 30,
      points: 150,
      explanation: 'Devid meriri Goliat site n’okwukwe n’aha Onyenwe anyị.',
    },
    {
      id: 'wai-ig-4',
      gameType: 'WHO_AM_I',
      prompt: 'Chọpụta eze nwanyị nwere obi ike a:',
      options: [],
      correctAnswer: 'Esther',
      clues: [
        'Aha Hibru m bụ Hadasa, Mọdekai zụlitere m.',
        'Ebiri m ọnụ ụbọchị atọ tupu m gaa n’ihu eze n’akpọghị m.',
        'Abịara m n’alaeze "maka oge dị ka nke a."',
        'Asịrị m "Ọ bụrụ na m laa n’iyi, ka m laa n’iyi" iji zọpụta ndị Juu.',
      ],
      scrambledWords: [],
      scriptureReference: 'Esther 4:14–16',
      translation: 'Baịbụl Nsọ (IG)',
      timerSeconds: 30,
      points: 150,
      explanation: 'Eze Nwanyị Esta zọpụtara ndị Izrel site n’obi ike.',
    },
  ],
};

function makeScrambleQuestion(
  id: string,
  verse: string,
  ref: string,
  translation: string,
  explanation: string
): MultiplayerQuestion {
  return {
    id,
    gameType: 'SCRIPTURE_SCRAMBLE',
    prompt: `Reconstruct ${ref} (${translation}):`,
    options: [],
    correctAnswer: verse,
    clues: [],
    scrambledWords: scrambleVerse(verse),
    scriptureReference: ref,
    translation,
    timerSeconds: 30,
    points: 120,
    explanation,
  };
}

const SCRAMBLE_PRESETS: Record<LanguageCode, MultiplayerQuestion[]> = {
  EN: [
    makeScrambleQuestion(
      'scr-en-1',
      'The LORD is with thee thou mighty man of valour',
      'Judges 6:12',
      'KJV',
      'God’s commissioning words to Gideon before calling him to deliver Israel.'
    ),
    makeScrambleQuestion(
      'scr-en-2',
      'The people that do know their God shall be strong and do exploits',
      'Daniel 11:32',
      'KJV',
      'Core anchor verse of The Youth Alive Fellowship — intimacy precedes exploits.'
    ),
    makeScrambleQuestion(
      'scr-en-3',
      'I can do all things through Christ which strengtheneth me',
      'Philippians 4:13',
      'KJV',
      'Paul’s declaration of supernatural strength through Christ in every season.'
    ),
  ],
  YO: [
    makeScrambleQuestion(
      'scr-yo-1',
      'Oluwa wa pelu re iwo alagbara akoni',
      'Judges 6:12',
      'Bibeli Mimo (YO)',
      'Ọ̀rọ̀ ìfọwọ́sowọ́pọ̀ Ọlọ́run sí Gídíónì.'
    ),
    makeScrambleQuestion(
      'scr-yo-2',
      'Awon eniyan ti o mo Olorun won yoo lagbara won yoo si se ise iyanu',
      'Daniel 11:32',
      'Bibeli Mimo (YO)',
      'Ìmọ̀ Ọlọ́run ló ń fún àwọn ọ̀dọ́ ní agbára.'
    ),
    makeScrambleQuestion(
      'scr-yo-3',
      'Emi le se ohun gbogbo nipa Kristi ti o n fun mi ni agbara',
      'Philippians 4:13',
      'Bibeli Mimo (YO)',
      'Àṣẹ agbára nípasẹ̀ Kristi fún gbogbo onígbàgbọ́.'
    ),
  ],
  HA: [
    makeScrambleQuestion(
      'scr-ha-1',
      'Ubangiji yana tare da kai ya kai jarumi mai karfi',
      'Judges 6:12',
      'Littafi Mai Tsarki (HA)',
      'Kalmar Ubangiji ga Gidiyon kafin ya ceci Isra’ila.'
    ),
    makeScrambleQuestion(
      'scr-ha-2',
      'Mutanen da suka san Allahn su za su yi karfi su yi manyan ayyuka',
      'Daniel 11:32',
      'Littafi Mai Tsarki (HA)',
      'Sanin Allah shi ne tushen ƙarfi da manyan ayyuka.'
    ),
    makeScrambleQuestion(
      'scr-ha-3',
      'Zan iya yin kome ta wurin Almasihu wanda ke karfafa ni',
      'Philippians 4:13',
      'Littafi Mai Tsarki (HA)',
      'Ƙarfin Almasihu yana ba matasa nasara a kowane hali.'
    ),
  ],
  IG: [
    makeScrambleQuestion(
      'scr-ig-1',
      'Onyenwe anyi nonyeere gi gi dike di ike',
      'Judges 6:12',
      'Baịbụl Nsọ (IG)',
      'Okwu Onyenwe anyị gwara Gidiọn tupu mmeri ahụ.'
    ),
    makeScrambleQuestion(
      'scr-ig-2',
      'Ndi maara Chineke ha ga adi ike mee ihe di ukwuu',
      'Daniel 11:32',
      'Baịbụl Nsọ (IG)',
      'Ịmara Chineke na-eweta ike na nnukwu ọrụ.'
    ),
    makeScrambleQuestion(
      'scr-ig-3',
      'Apuru m ime ihe niile site na Kraist onye na enye m ike',
      'Philippians 4:13',
      'Baịbụl Nsọ (IG)',
      'Ike Kraịst na-eme ka ndị ntorobịa nwee mmeri.'
    ),
  ],
};

const SOLO_FALLBACK_PRESETS: Record<LanguageCode, SoloQuizQuestion[]> = {
  EN: [
    {
      id: 'sf-en-1',
      question: 'Where was Gideon threshing wheat when the angel appeared to him?',
      options: ['In the temple', 'By the winepress', 'On Mount Sinai', 'At Jericho'],
      correctAnswerIndex: 1,
      scriptureRef: 'Judges 6:11',
    },
    {
      id: 'sf-en-2',
      question: 'How many warriors remained with Gideon after the water test?',
      options: ['3,000', '1,000', '300', '70'],
      correctAnswerIndex: 2,
      scriptureRef: 'Judges 7:7',
    },
    {
      id: 'sf-en-3',
      question: 'Which prophet declared "the people that do know their God shall be strong, and do exploits"?',
      options: ['Isaiah', 'Daniel', 'Jeremiah', 'Joel'],
      correctAnswerIndex: 1,
      scriptureRef: 'Daniel 11:32',
    },
    {
      id: 'sf-en-4',
      question: 'Which book urges youths: "Let no man despise thy youth; but be thou an example"?',
      options: ['1 Timothy 4:12', 'Titus 2:1', 'Romans 12:1', 'Ephesians 6:10'],
      correctAnswerIndex: 0,
      scriptureRef: '1 Timothy 4:12',
    },
    {
      id: 'sf-en-5',
      question: 'What did Gideon’s 300 men hold in their left hands alongside trumpets?',
      options: ['Spears', 'Torches in pitchers', 'Shields', 'Swords'],
      correctAnswerIndex: 1,
      scriptureRef: 'Judges 7:16',
    },
  ],
  YO: [
    {
      id: 'sf-yo-1',
      question: 'Níbo ni Gídíónì ti ń pakà alikama nígbà tí áńgẹ́lì farahàn án?',
      options: ['Nínú tẹ́ńpìlì', 'Níbi ìfúntí wáìnì', 'Lórí Òkè Sínáì', 'Ní Jẹ́ríkò'],
      correctAnswerIndex: 1,
      scriptureRef: 'Judges 6:11',
    },
    {
      id: 'sf-yo-2',
      question: 'Ọkùnrin mélòó ló kù pẹ̀lú Gídíónì lẹ́yìn ìdánwò omi?',
      options: ['3,000', '1,000', '300', '70'],
      correctAnswerIndex: 2,
      scriptureRef: 'Judges 7:7',
    },
    {
      id: 'sf-yo-3',
      question: 'Wòlíì wo ni ó kọ̀wé pé àwọn tí ó mọ Ọlọ́run wọn yóò ṣe iṣẹ́ ìyanu?',
      options: ['Aísáyà', 'Dáníẹ́lì', 'Jeremáyà', 'Jóẹ́lì'],
      correctAnswerIndex: 1,
      scriptureRef: 'Daniel 11:32',
    },
    {
      id: 'sf-yo-4',
      question: 'Ìwé wo ló sọ pé "Má ṣe jẹ́ kí ẹnikẹ́ni tẹ́ńbẹ́lú ìgbà èwe rẹ"?',
      options: ['1 Tímótì 4:12', 'Títù 2:1', 'Róòmù 12:1', 'Éfésù 6:10'],
      correctAnswerIndex: 0,
      scriptureRef: '1 Timothy 4:12',
    },
    {
      id: 'sf-yo-5',
      question: 'Kí ni àwọn 300 akọni Gídíónì di mú ní ọwọ́ òsì wọn?',
      options: ['Ọ̀kọ̀', 'Ògùṣọ̀ nínú ìkòkò', 'Asà', 'Idà'],
      correctAnswerIndex: 1,
      scriptureRef: 'Judges 7:16',
    },
  ],
  HA: [
    {
      id: 'sf-ha-1',
      question: 'A ina Gidiyon yake sussukar alkama sa’ad da mala’ika ya bayyana?',
      options: ['A haikali', 'A matsewar inabi', 'A Dutsen Sinai', 'A Yeriko'],
      correctAnswerIndex: 1,
      scriptureRef: 'Judges 6:11',
    },
    {
      id: 'sf-ha-2',
      question: 'Jarumawa nawa suka rage tare da Gidiyon bayan gwajin ruwa?',
      options: ['3,000', '1,000', '300', '70'],
      correctAnswerIndex: 2,
      scriptureRef: 'Judges 7:7',
    },
    {
      id: 'sf-ha-3',
      question: 'Wane annabi ne ya ce mutanen da suka san Allahn su za su yi manyan ayyuka?',
      options: ['Ishaya', 'Daniyel', 'Irmiya', 'Yowel'],
      correctAnswerIndex: 1,
      scriptureRef: 'Daniel 11:32',
    },
    {
      id: 'sf-ha-4',
      question: 'Wane littafi ne ya ce "Kada kowa ya raina ƙuruciyarka"?',
      options: ['1 Timotawus 4:12', 'Titus 2:1', 'Romawa 12:1', 'Afisawa 6:10'],
      correctAnswerIndex: 0,
      scriptureRef: '1 Timothy 4:12',
    },
    {
      id: 'sf-ha-5',
      question: 'Me maza 300 na Gidiyon suka riƙe a hannun hagu tare da ƙaho?',
      options: ['Mashi', 'Tocila a cikin tulu', 'Garkuwa', 'Takobi'],
      correctAnswerIndex: 1,
      scriptureRef: 'Judges 7:16',
    },
  ],
  IG: [
    {
      id: 'sf-ig-1',
      question: 'Ebee ka Gidiọn nọ na-azọcha ọka wit mgbe mmụọ ozi pụtara?',
      options: ['N’ụlọ nsọ', 'N’ebe nzọcha mmanya vine', 'N’Ugwu Saịnaị', 'Na Jeriko'],
      correctAnswerIndex: 1,
      scriptureRef: 'Judges 6:11',
    },
    {
      id: 'sf-ig-2',
      question: 'Ndị dike ole fọdụụrụ Gidiọn mgbe ule mmiri gasịrị?',
      options: ['3,000', '1,000', '300', '70'],
      correctAnswerIndex: 2,
      scriptureRef: 'Judges 7:7',
    },
    {
      id: 'sf-ig-3',
      question: 'Onye amụma ole kwuru na ndị maara Chineke ha ga-eme ihe dị ukwuu?',
      options: ['Aịzaya', 'Daniel', 'Jeremaya', 'Joel'],
      correctAnswerIndex: 1,
      scriptureRef: 'Daniel 11:32',
    },
    {
      id: 'sf-ig-4',
      question: 'Ebee ka e dere "Ekwela ka onye ọ bụla leda ntorobịa gị anya"?',
      options: ['1 Timoti 4:12', 'Taịtọs 2:1', 'Ndị Rom 12:1', 'Ndị Efesọs 6:10'],
      correctAnswerIndex: 0,
      scriptureRef: '1 Timothy 4:12',
    },
    {
      id: 'sf-ig-5',
      question: 'Gịnị ka ndị dike 300 nke Gidiọn jidere n’aka ekpe ha?',
      options: ['Ube', 'Ọwa ọkụ n’ime ite', 'Ọta', 'Mma agha'],
      correctAnswerIndex: 1,
      scriptureRef: 'Judges 7:16',
    },
  ],
};

export const PresetGameSessions = {
  getPresetQuestions(
    gameType: GameType,
    language: LanguageCode = 'EN'
  ): MultiplayerQuestion[] {
    const lang: LanguageCode =
      language === 'YO' || language === 'HA' || language === 'IG' ? language : 'EN';
    const list =
      gameType === 'WHO_AM_I'
        ? WHO_AM_I_PRESETS[lang]
        : gameType === 'SCRIPTURE_SCRAMBLE'
        ? SCRAMBLE_PRESETS[lang]
        : TRIVIA_PRESETS[lang];

    return list.map((q) => ({
      ...q,
      options: [...q.options],
      clues: [...q.clues],
      scrambledWords:
        q.gameType === 'SCRIPTURE_SCRAMBLE'
          ? scrambleVerse(q.correctAnswer)
          : [...q.scrambledWords],
    }));
  },

  getSoloFallbackQuestions(language: LanguageCode = 'EN'): SoloQuizQuestion[] {
    const lang: LanguageCode =
      language === 'YO' || language === 'HA' || language === 'IG' ? language : 'EN';
    return SOLO_FALLBACK_PRESETS[lang].map((q) => ({
      ...q,
      options: [...q.options],
    }));
  },
};
